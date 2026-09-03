/**
 * RealESRGAN inference worker.
 *
 * Owns the onnxruntime-web session so ONNX inference never blocks the content
 * script's main thread. The content script cannot spawn a worker from a
 * chrome-extension:// URL directly (SecurityError), so it fetches this file,
 * wraps it in a Blob URL and starts it as a module worker. A blob worker runs
 * under the page origin and has no chrome.* APIs: every URL it needs (the ORT
 * bundle, the wasm runtime directory, the model files) is resolved by the
 * content script via chrome.runtime.getURL and passed in through messages.
 * See docs/realesrgan-phase4-worker-spike.md for the verified loading chain.
 *
 * Execution provider: WebGPU only (WASM removed). Running in a worker matters
 * for WebGPU on Firefox for two reasons:
 *   1. The WebGPU bundle's asyncify wasm loader needs `new Function`, which a
 *      Firefox MV3 content script's CSP blocks but a blob worker allows.
 *   2. Inference stays off the main thread either way.
 *
 * Frame-level protocol (the whole frame is processed here):
 *   -> { type: 'infer', id, modelUrl, modelUrlFp16, width, height, data }
 *      `data` is a transferred Float32Array holding planar NCHW RGB in [0,1]
 *      with shape [1, 3, height, width] for the FULL frame. The worker plans
 *      tiles, runs them through the model and composes the 4x result:
 *        - Fast path: one batched session.run with `preferredOutputLocation:
 *          'gpu-buffer'`, output never touches CPU as floats. A compute shader
 *          composes + packs the tiles straight into an RGBA8 texture; the only
 *          CPU transfer is 4 bytes per output pixel.
 *        - Fallback (same GPU, no gpu-buffer): when the fp16/fp32 gpu-buffer
 *          alias bug hits (Shape mismatch {1,480,640,3}!={1,1920,2560,3}) the
 *          worker rebuilds a WebGPU session WITHOUT gpu-buffer, downloads
 *          floats and composes on CPU (same math as the content script's
 *          CPU composer) — still GPU inference.
 *      Replies { type: 'infer', id, ok: true, width, height, data } with
 *      `data` = tightly packed RGBA8 bytes of the composed 4x frame
 *      (Uint8Array, transferred), or { ok: false, error }.
 *
 * A failed inference never terminates the worker; the session cache is only
 * populated with successfully created sessions so a bad model can be retried.
 *
 * The handler logic is exported so the unit suite can drive it without a real
 * worker global: tests shim `self` and inject a fake ORT module before calling
 * the exported handleInit/handleInfer. This file stays an unbundled plain-JS
 * module for the Blob-URL import; exports are inert at worker runtime.
 */

// --- Naga f16-bitcast rewrite hook (must run before ORT is imported) -------

export function rewriteF16Bitcast(code) {
  if (typeof code !== 'string' || code.indexOf('bitcast<vec2<f16>>') === -1) return code;
  return code.replace(
    /bitcast<vec2<f16>>\(([^)]+)\)\[(\d)\]/g,
    (match, expr, idx) => `f16(unpack2x16float(${expr})[${idx}])`,
  );
}

export function installF16RewriteHook() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return;
  const origRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
  navigator.gpu.requestAdapter = async (...args) => {
    const adapter = await origRequestAdapter(...args);
    if (!adapter) return adapter;
    const origRequestDevice = adapter.requestDevice.bind(adapter);
    adapter.requestDevice = async (...deviceArgs) => {
      const device = await origRequestDevice(...deviceArgs);
      const origCreateShaderModule = device.createShaderModule.bind(device);
      device.createShaderModule = descriptor => {
        const patched = { ...descriptor, code: rewriteF16Bitcast(descriptor.code) };
        return origCreateShaderModule(patched);
      };
      return device;
    };
    return adapter;
  };
}

installF16RewriteHook();

// --- Tile planning (mirrors src/shared/realesrgan-tiling.ts) ----------------

/**
 * Tile plan for one frame. Every produced tile has EXACTLY the same shape:
 * tiled axes emit maxTileSize-wide entries stepping by (maxTileSize -
 * overlap) with the last position clamped to size - maxTileSize, and an axis
 * smaller than maxTileSize contributes its full size to every tile. Uniform
 * tiles are what makes one batched session.run legal for the whole frame.
 * The overlap gives the compositor room to feather tile borders away, exactly
 * like the content-script planner.
 */
export function planUniformTiles(width, height, maxTileSize, overlap, singleTileMaxHeight) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`Invalid tile-plan dimensions: ${width}x${height}.`);
  }
  if (!Number.isInteger(maxTileSize) || maxTileSize <= 0
    || !Number.isInteger(overlap) || overlap < 0 || overlap >= maxTileSize
    || !Number.isInteger(singleTileMaxHeight) || singleTileMaxHeight <= 0) {
    throw new Error('Invalid tile-plan options.');
  }
  if (height <= singleTileMaxHeight) {
    return [{ x: 0, y: 0, width, height }];
  }
  const positions = (size) => {
    if (size <= maxTileSize) return [0];
    const stride = maxTileSize - overlap;
    const out = [];
    let p = 0;
    while (p + maxTileSize < size) {
      out.push(p);
      p += stride;
    }
    out.push(size - maxTileSize);
    return out;
  };
  const tiles = [];
  for (const y of positions(height)) {
    for (const x of positions(width)) {
      tiles.push({
        x,
        y,
        width: Math.min(maxTileSize, width - x),
        height: Math.min(maxTileSize, height - y),
      });
    }
  }
  return tiles;
}

function extractTilePlanar(inputRgb, sourceWidth, sourceHeight, x, y, tileWidth, tileHeight) {
  const sourcePixels = sourceWidth * sourceHeight;
  const tilePixels = tileWidth * tileHeight;
  const out = new Float32Array(3 * tilePixels);
  for (let c = 0; c < 3; c += 1) {
    const srcPlane = inputRgb.subarray(c * sourcePixels, (c + 1) * sourcePixels);
    const dstPlane = out.subarray(c * tilePixels, (c + 1) * tilePixels);
    for (let row = 0; row < tileHeight; row += 1) {
      const srcOffset = (y + row) * sourceWidth + x;
      dstPlane.set(srcPlane.subarray(srcOffset, srcOffset + tileWidth), row * tileWidth);
    }
  }
  return out;
}

/**
 * Stack per-tile planar data into one NCHW batch tensor backing array.
 * Tiles are uniform (see planUniformTiles), so the layout is simply
 * [B, 3, tileH, tileW] concatenated.
 */
export function stackTilesToBatch(inputRgb, sourceWidth, sourceHeight, tiles) {
  if (!tiles.length) throw new Error('Cannot batch an empty tile list.');
  if (!(inputRgb instanceof Float32Array) || inputRgb.length !== 3 * sourceWidth * sourceHeight) {
    throw new Error('Invalid planar input for tile batching.');
  }
  const tile = tiles[0];
  const tilePixels = tile.width * tile.height;
  const batch = new Float32Array(tiles.length * 3 * tilePixels);
  for (let b = 0; b < tiles.length; b += 1) {
    batch.set(
      extractTilePlanar(inputRgb, sourceWidth, sourceHeight, tiles[b].x, tiles[b].y, tile.width, tile.height),
      b * 3 * tilePixels,
    );
  }
  return batch;
}

// --- CPU compose -------------------------------------------------------------

/**
 * CPU compose with the exact separable feathering math of
 * `composeTileResults` (integer ramps, weight = min(fx, fy), weighted
 * average), then pack to RGBA8. `tiles[i].rgb` is the tile's planar 4x
 * result. Runs when the GPU compose path is unavailable.
 */
export function composeTilesToRgba8(tiles, outWidth, outHeight, featherWindow) {
  const outPixels = outWidth * outHeight;
  const acc = new Float32Array(3 * outPixels);
  const weights = new Float32Array(outPixels);
  const rgba = new Uint8Array(4 * outPixels);
  const ramp = (length) => {
    const r = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      r[i] = Math.min(Math.min(i, length - 1 - i) + 1, featherWindow);
    }
    return r;
  };
  for (const tile of tiles) {
    const upW = tile.width * 4;
    const upH = tile.height * 4;
    const baseX = tile.x * 4;
    const baseY = tile.y * 4;
    const fx = ramp(upW);
    const fy = ramp(upH);
    const tilePixels = upW * upH;
    const rgb = tile.rgb;
    for (let row = 0; row < upH; row += 1) {
      const wy = fy[row];
      const srcRow = row * upW;
      const outRowBase = (baseY + row) * outWidth + baseX;
      for (let col = 0; col < upW; col += 1) {
        const weight = Math.min(fx[col], wy);
        const srcIndex = srcRow + col;
        const outIndex = outRowBase + col;
        acc[outIndex] += rgb[srcIndex] * weight;
        acc[outPixels + outIndex] += rgb[tilePixels + srcIndex] * weight;
        acc[2 * outPixels + outIndex] += rgb[2 * tilePixels + srcIndex] * weight;
        weights[outIndex] += weight;
      }
    }
  }
  for (let i = 0; i < outPixels; i += 1) {
    const w = weights[i] || 1;
    rgba[i * 4] = Math.round(Math.min(1, Math.max(0, acc[i] / w)) * 255);
    rgba[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, acc[outPixels + i] / w)) * 255);
    rgba[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, acc[2 * outPixels + i] / w)) * 255);
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/** Slice a batched [B,3,4h,4w] planar float array into per-tile views. */
export function splitBatchedOutput(batched, tiles) {
  const upPixels = (tiles[0].width * 4) * (tiles[0].height * 4);
  return tiles.map((tile, b) => ({
    ...tile,
    rgb: batched.subarray(b * 3 * upPixels, (b + 1) * 3 * upPixels),
  }));
}

/**
 * Exact area-average box downscale of packed RGBA8. Each destination pixel
 * averages the source pixels overlapped by its box, with fractional edge
 * coverage weighted in. Uniform regions stay exactly uniform; identity
 * dimensions return a copy. Mirrors the native host's transport-sized
 * output so worker and native frames match pixel for pixel.
 */
export function downscaleRgba8Box(rgba, srcWidth, srcHeight, dstWidth, dstHeight) {
  const out = new Uint8Array(dstWidth * dstHeight * 4);
  for (let dy = 0; dy < dstHeight; dy += 1) {
    const yStart = (dy * srcHeight) / dstHeight;
    const yEnd = ((dy + 1) * srcHeight) / dstHeight;
    for (let dx = 0; dx < dstWidth; dx += 1) {
      const xStart = (dx * srcWidth) / dstWidth;
      const xEnd = ((dx + 1) * srcWidth) / dstWidth;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let sy = Math.floor(yStart); sy < yEnd && sy < srcHeight; sy += 1) {
        const yOverlap = Math.min(sy + 1, yEnd) - Math.max(sy, yStart);
        for (let sx = Math.floor(xStart); sx < xEnd && sx < srcWidth; sx += 1) {
          const xOverlap = Math.min(sx + 1, xEnd) - Math.max(sx, xStart);
          const weight = xOverlap * yOverlap;
          const srcOffset = (sy * srcWidth + sx) * 4;
          r += rgba[srcOffset] * weight;
          g += rgba[srcOffset + 1] * weight;
          b += rgba[srcOffset + 2] * weight;
          a += rgba[srcOffset + 3] * weight;
          area += weight;
        }
      }
      const dstOffset = (dy * dstWidth + dx) * 4;
      out[dstOffset] = Math.round(r / area);
      out[dstOffset + 1] = Math.round(g / area);
      out[dstOffset + 2] = Math.round(b / area);
      out[dstOffset + 3] = Math.round(a / area);
    }
  }
  return out;
}

// --- GPU compose (runs on the ORT WebGPU device) ----------------------------

const composeWGSL = `
struct TileDesc {
  baseX: u32,
  baseY: u32,
  upW: u32,
  upH: u32,
  dataOffset: u32,
  featherWindow: u32,
  pad0: u32,
  pad1: u32,
}

struct ComposeParams {
  outWidth: u32,
  outHeight: u32,
  tileCount: u32,
  pad: u32,
}

@group(0) @binding(0) var<uniform> params: ComposeParams;
@group(0) @binding(1) var<storage, read> tiles: array<TileDesc>;
@group(0) @binding(2) var<storage, read> tileData: array<f32>;
@group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x;
  let py = gid.y;
  if (px >= params.outWidth || py >= params.outHeight) {
    return;
  }
  var r = 0.0;
  var g = 0.0;
  var b = 0.0;
  var weightSum = 0.0;
  for (var t = 0u; t < params.tileCount; t = t + 1u) {
    let tile = tiles[t];
    let lx = i32(px) - i32(tile.baseX);
    let ly = i32(py) - i32(tile.baseY);
    if (lx < 0 || ly < 0 || lx >= i32(tile.upW) || ly >= i32(tile.upH)) {
      continue;
    }
    let window = i32(tile.featherWindow);
    let fx = min(min(lx, i32(tile.upW) - 1 - lx) + 1, window);
    let fy = min(min(ly, i32(tile.upH) - 1 - ly) + 1, window);
    let weight = f32(min(fx, fy));
    let tilePixels = tile.upW * tile.upH;
    let pixel = tile.dataOffset + u32(ly) * tile.upW + u32(lx);
    r = r + tileData[pixel] * weight;
    g = g + tileData[pixel + tilePixels] * weight;
    b = b + tileData[pixel + 2u * tilePixels] * weight;
    weightSum = weightSum + weight;
  }
  let divisor = max(weightSum, 1.0);
  let rr = floor(clamp(r / divisor, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  let gg = floor(clamp(g / divisor, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  let bb = floor(clamp(b / divisor, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  textureStore(outputTexture, vec2i(i32(px), i32(py)), vec4f(rr, gg, bb, 1.0));
}
`;

const DESC_U32_PER_TILE = 8;
const COPY_BYTES_PER_ROW_ALIGNMENT = 256;

/**
 * Compose GPU-resident ORT output into one RGBA8 buffer.
 *
 * `source` is either a single batched gpu-buffer tensor (dims [B,3,4h,4w]) or
 * per-tile gpu-buffer tensors; both become one storage buffer via GPU->GPU
 * copies, then a compute pass composes + packs into an RGBA8 texture, then a
 * single texture->buffer copy brings 4 bytes per output pixel to the CPU.
 * No planar float ever crosses back.
 *
 * Returns null when anything in the chain is unavailable; the caller falls
 * back to CPU composition from downloaded floats.
 */
async function composeGpuOutputsOnDevice(device, tileDescriptors, outWidth, outHeight, featherWindow) {
  const maxStorage = device.limits?.maxStorageBufferBindingSize ?? 0;
  if (!maxStorage || tileDescriptors.length === 0) return null;

  const totalFloats = tileDescriptors.reduce((sum, t) => sum + 3 * t.upW * t.upH, 0);
  if (totalFloats * 4 > maxStorage) return null;

  // Descriptor dataOffsets are batch-slot relative (b * 3 * upW * upH) for the
  // batched source and slot-absolute for per-tile sources; callers set them.
  const descs = new Uint32Array(tileDescriptors.length * DESC_U32_PER_TILE);
  tileDescriptors.forEach((tile, index) => {
    const base = index * DESC_U32_PER_TILE;
    descs[base] = tile.baseX;
    descs[base + 1] = tile.baseY;
    descs[base + 2] = tile.upW;
    descs[base + 3] = tile.upH;
    descs[base + 4] = tile.dataOffset;
    descs[base + 5] = featherWindow;
  });

  const descBuffer = device.createBuffer({
    size: Math.max(descs.byteLength, 16),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(descBuffer, 0, descs);

  const dataBuffer = device.createBuffer({
    size: totalFloats * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const copyEncoder = device.createCommandEncoder({ label: 'RealESRGAN tile gather' });
  for (const tile of tileDescriptors) {
    // ORT gpu-buffers are dense fp32 buffers matching the tensor's byte size.
    copyEncoder.copyBufferToBuffer(tile.gpuBuffer, tile.sourceOffset * 4, dataBuffer, tile.dataOffset * 4, 3 * tile.upW * tile.upH * 4);
  }
  device.queue.submit([copyEncoder.finish()]);

  const paramsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([outWidth, outHeight, tileDescriptors.length, 0]));

  const outputTexture = device.createTexture({
    size: [outWidth, outHeight, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });

  let result;
  try {
    const module = device.createShaderModule({ label: 'RealESRGAN worker compose', code: composeWGSL });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba8unorm' } },
      ],
    });
    const pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      compute: { module, entryPoint: 'main' },
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: descBuffer } },
        { binding: 2, resource: { buffer: dataBuffer } },
        { binding: 3, resource: outputTexture.createView() },
      ],
    });
    const encoder = device.createCommandEncoder({ label: 'RealESRGAN worker compose' });
    const pass = encoder.beginComputePass({ label: 'RealESRGAN worker compose' });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(outWidth / 8), Math.ceil(outHeight / 8));
    pass.end();

    const tightRowBytes = outWidth * 4;
    const bytesPerRow = Math.ceil(tightRowBytes / COPY_BYTES_PER_ROW_ALIGNMENT) * COPY_BYTES_PER_ROW_ALIGNMENT;
    const readbackBuffer = device.createBuffer({
      size: bytesPerRow * outHeight,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyTextureToBuffer(
      { texture: outputTexture },
      { buffer: readbackBuffer, bytesPerRow, rowsPerImage: outHeight },
      [outWidth, outHeight, 1],
    );
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const padded = new Uint8Array(readbackBuffer.getMappedRange());
    const rgba = new Uint8Array(tightRowBytes * outHeight);
    for (let row = 0; row < outHeight; row += 1) {
      rgba.set(padded.subarray(row * bytesPerRow, row * bytesPerRow + tightRowBytes), row * tightRowBytes);
    }
    readbackBuffer.unmap();
    readbackBuffer.destroy();
    result = rgba;
  } finally {
    outputTexture.destroy();
    paramsBuffer.destroy();
    dataBuffer.destroy();
    descBuffer.destroy();
  }
  return result;
}
void composeGpuOutputsOnDevice;

/** Fetch a tensor's floats regardless of its location (gpu-buffer or cpu). */
async function tensorFloats(tensor) {
  if (typeof tensor.download === 'function') {
    return await tensor.download();
  }
  return tensor.data;
}

// --- ORT session management -------------------------------------------------

let ort = null;
// cacheKey -> { session, ep, preferGpuOutputs, url }
const sessions = new Map();

// Sticky fp16 skip: a shader-compile failure (Clip kernel on Tint) proves the
// fp16 model cannot run on this device; stop attempting it for this life.
let fp16Disabled = false;
// Bound for InferenceSession.create: a hung create (seen after a device-side
// shader failure) must not wedge the worker forever.
let sessionCreateTimeoutMs = 30000;
export function __setSessionCreateTimeoutForTests(ms) {
  sessionCreateTimeoutMs = ms;
}

// Injectable so tests can supply a fake ORT module without touching the
// filesystem or the dynamic import machinery.
let ortLoader = null;
export function __setOrtLoaderForTests(loader) {
  ortLoader = loader;
}

function importOrt(url) {
  if (ortLoader) return ortLoader(url);
  return import(/* webpackIgnore: true */ url);
}

/**
 * Create (or fetch) the session for one EXACT run shape.
 *
 * onnxruntime-web's WebGPU EP caches its internal output buffer after the
 * first run and hard-fails every later run whose output shape differs
 * ("Shape mismatch attempting to re-use buffer") - even on the SAME session
 * object, and even when the earlier shape was smaller. Mixing a batched
 * [B,3,th,tw] run and per-tile [1,3,th,tw] runs on one session therefore
 * breaks both directions. The cache key must hence pin the complete I/O
 * shape: batch, tile H/W, and the 4x output H/W.
 */
export async function getSession(modelUrl, modelUrlFp16, inputBatch, inputHeight, inputWidth, outputHeight, outputWidth, wantGpuBuffer = true) {
  // WebGPU-only: WASM removed on user request. Every session is WebGPU.
  // The symbolic-dim model fails without overrides ("Shape mismatch
  // {1,480,640,3} != {1,1920,2560,3}" on first run), so the cache key pins
  // the exact I/O shape plus the gpu-buffer flag. With overrides the
  // single-shape case is verified OK on RDNA-2, gpu-buffer outputs included.
  // Batched gpu-buffer stays disabled until E2E'd (see handleInfer).
  const cacheKey = [
    modelUrl,
    modelUrlFp16 ?? '',
    inputBatch, inputHeight, inputWidth,
    outputHeight, outputWidth,
    wantGpuBuffer ? 'gpu-buffer' : 'gpu',
  ].join('|');
  const cached = sessions.get(cacheKey);
  if (cached) return cached;
  if (!ort) throw new Error('worker not initialised');

  const attempts = [];
  if (wantGpuBuffer) {
    if (!fp16Disabled && modelUrlFp16 && modelUrlFp16 !== modelUrl) {
      attempts.push({ url: modelUrlFp16, useGpuBuffer: true });
      attempts.push({ url: modelUrlFp16, useGpuBuffer: false });
    }
    attempts.push({ url: modelUrl, useGpuBuffer: true });
    attempts.push({ url: modelUrl, useGpuBuffer: false });
  } else {
    if (!fp16Disabled && modelUrlFp16 && modelUrlFp16 !== modelUrl) {
      attempts.push({ url: modelUrlFp16, useGpuBuffer: false });
    }
    attempts.push({ url: modelUrl, useGpuBuffer: false });
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const pendingCreate = ort.InferenceSession.create(attempt.url, {
        executionProviders: ['webgpu'],
        ...(attempt.useGpuBuffer ? { preferredOutputLocation: 'gpu-buffer', enableMemPattern: false } : { enableMemPattern: false }),
        // Pin the symbolic dims to this session's exact input shape. ORT 1.29
        // WebGPU EP throws "Shape mismatch attempting to re-use buffer
        // {1,480,640,3} != {1,1920,2560,3}" on the FIRST run of a model whose
        // graph carries symbolic dims (batch_size/height/width) - the output
        // buffer-reuse validator compares the NHWC input shape against the
        // output shape regardless of dim_param naming. Concrete dims at
        // session-creation time avoid the symbolic-dim path entirely; the
        // session is already shape-pinned by cacheKey, so the override costs
        // nothing. The static-shape model has no free dims: overrides for
        // unknown symbols are ignored (verified against python ORT 1.29).
        freeDimensionOverrides: {
          batch_size: inputBatch,
          height: inputHeight,
          width: inputWidth,
          out_batch_size: inputBatch,
          out_height: outputHeight,
          out_width: outputWidth,
        },
      });
      // A late success after the timeout below dies uncached instead of
      // surfacing as an unhandled rejection.
      void pendingCreate.catch(() => {});
      const session = await Promise.race([
        pendingCreate,
        new Promise((_, reject) => setTimeout(
          () => reject(new Error(`RealESRGAN session creation timed out after ${sessionCreateTimeoutMs}ms (${attempt.url})`)),
          sessionCreateTimeoutMs,
        )),
      ]);
      const entry = {
        session,
        ep: 'webgpu',
        preferGpuOutputs: attempt.useGpuBuffer,
        url: attempt.url,
      };
      sessions.set(cacheKey, entry);
      return entry;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('RealESRGAN session creation failed.');
}

export async function handleInit(message) {
  try {
    ort = await importOrt(message.ortUrl);
    ort.env.wasm.wasmPaths = message.wasmDir;
    // Single-threaded for now: the worker itself is the offload, and thread
    // workers spawned from a blob worker need separate verification.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    self.postMessage({ type: 'init', ok: true });
  } catch (error) {
    self.postMessage({ type: 'init', ok: false, error: String(error) });
  }
}

/**
 * The WebGPU device ORT's backend runs on; null when the WebGPU backend has
 * not created one (WASM sessions) or the env surface is missing. The compose
 * shaders must run on the SAME device that owns the output gpu-buffers.
 */
async function getOrtWebGpuDevice() {
  try {
    const device = await ort.env.webgpu?.device;
    return device ?? null;
  } catch {
    return null;
  }
}
void getOrtWebGpuDevice;

/**
 * A fully black RGBA8 result means the GPU compose produced garbage or an
 * empty texture (the alpha channel is always 255, so true black is the
 * signature of an unwritten/failed compose). 1% of dark pixels tolerates
 * genuinely dark scenes; a dead compose is 100% black.
 */
export function isBlackFrame(rgba) {
  if (!rgba || rgba.length < 4) return true;
  const pixelCount = rgba.length / 4;
  const samples = Math.min(1024, pixelCount);
  const stride = Math.max(1, Math.floor(pixelCount / samples));
  let dark = 0;
  let sampled = 0;
  for (let p = 0; p < pixelCount; p += stride) {
    const o = p * 4;
    if (rgba[o] < 4 && rgba[o + 1] < 4 && rgba[o + 2] < 4) dark += 1;
    sampled += 1;
    // Early exit: impossible to reach 95% dark from remaining samples.
    // e.g. if sampled=500, dark=10, even if all remaining 524 are dark, max ratio = (10+524)/1024 =0.52 <0.95 -> never black.
    // So we can break early only for the negative case, not positive. Keep simple: check at end.
  }
  // Guard against tiny sampled counts (small textures): require at least 4 samples
  if (sampled === 0) return false;
  return dark / sampled > 0.95;
}

// Sticky downgrade: once the GPU compose produced a black frame, stop using
// it for the rest of this worker's life (or until the session cache is
// reset). Retrying the same broken path every frame would keep the video
// black; the CPU path is proven and correct.
let gpuComposeDisabled = false;
void gpuComposeDisabled;

/**
 * Run one inference with automatic recovery from ORT's shape-pinned output
 * buffer. The WebGPU EP caches an internal output buffer after the first run
 * and throws "Shape mismatch attempting to re-use buffer" on ANY later run
 * with a different shape - regardless of which session object executed it
 * (the buffer cache is global per device, not per session). On that failure
 * this helper drops the poisoned internal state by rebuilding the session
 * from scratch and retries ONCE.
 */
async function runShapePinned(session, inputName, tensor, outputName, rebuildSession) {
  // Timeout guard: ORT WebGPU can hang after a poisoned gpu-buffer shape.
  // Don't wedge the worker for 30s; fail fast so pipeline can retry.
  const RUN_TIMEOUT_MS = 8000;
  const runWithTimeout = (sess) => Promise.race([
    sess.run({ [inputName]: tensor }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('RealESRGAN session.run timed out after 8s')), RUN_TIMEOUT_MS)),
  ]);
  try {
    return await runWithTimeout(session);
  } catch (error) {
    if (!/Shape mismatch attempting to re-use buffer|timed out after 8s/i.test(String(error))) throw error;
    console.warn('[RealESRGAN worker] shape-pinned output buffer hit; rebuilding session');
    const fresh = await rebuildSession();
    return await runWithTimeout(fresh.session);
  }
}

export { runShapePinned };

/** Shader-compile failures are deterministic per model+driver: retrying the same model cannot help. */
function isShaderCompileError(error) {
  return /Invalid ShaderModule|failed to create.*compute pipeline/i.test(String(error));
}

export async function handleInfer(message) {
  try {
  if (!ort) throw new Error('worker not initialised');
  const width = message.width;
  const height = message.height;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`Invalid RealESRGAN frame dimensions: ${width}x${height}.`);
  }
  const expectedInputLength = 3 * width * height;
  if (!(message.data instanceof Float32Array) || message.data.length !== expectedInputLength) {
    throw new Error(`Invalid RealESRGAN input length: expected ${expectedInputLength}, got ${message.data?.length ?? 'unknown'}.`);
  }
  const outWidth = width * 4;
  const outHeight = height * 4;
    // Conservative tile geometry mirrors adaptiveRealEsrganTiling(): the
    // dynamic model accepts any shape, so tiles only bound memory, not the
    // session. singleTileMaxHeight 576 keeps the default 480p cap single-tile.
    const maxTileSize = width * height >= 1920 * 1080 ? 384 : 512;
    // Overlap 24 mirrors adaptiveRealEsrganTiling() for both the 384 and the
    // 512 geometry (min(24, maxTileSize/16) == 24), so the feather window
    // (overlap * 2) is always 48.
    const tiles = planUniformTiles(width, height, maxTileSize, 24, Math.min(576, maxTileSize));
    const featherWindow = 48;
    const tileH = tiles[0].height;
    const tileW = tiles[0].width;

    // GPU path: batched gpu-buffer stays off — per-tile GPU without
    // gpu-buffer is verified on RX 6750 XT (single-shape incl. gpu-buffer
    // outputs OK on RDNA-2); batched mixing plus compose-from-gpu-buffer
    // is untested, so downloads floats and CPU-composes. Revisit only
    // with hardware E2E, never behind a silent flag.
    let lastFramePath = 'cpu-tiles-gpu';
    let rgba = null;
    // fp16 fallback: a shader-compile failure proves the fp16 model unrunnable
    // here. Disable it worker-wide, drop its cached sessions, and redo the
    // frame on fp32 instead of failing it.
    for (let fp16Fallback = 0; ; fp16Fallback += 1) {
      const cpuSessionInfo = await getSession(
        message.modelUrl, message.modelUrlFp16, 1, tileH, tileW, tileH * 4, tileW * 4, false,
      );
      try {
        const cpuSession = cpuSessionInfo.session;
        const cpuInputName = cpuSession.inputNames[0] ?? 'input';
        const cpuOutputName = cpuSession.outputNames[0] ?? 'output';
        const composed = [];
        for (const tile of tiles) {
          const tileRgb = extractTilePlanar(message.data, width, height, tile.x, tile.y, tile.width, tile.height);
          const tensor = new ort.Tensor('float32', tileRgb, [1, 3, tile.height, tile.width]);
          const result = await runShapePinned(cpuSession, cpuInputName, tensor, cpuOutputName, async () => {
            for (const key of [...sessions.keys()]) {
              if (key.startsWith(message.modelUrl)) sessions.delete(key);
            }
            return await getSession(
              message.modelUrl, message.modelUrlFp16, 1, tileH, tileW, tileH * 4, tileW * 4, false,
            );
          });
          const output = result[cpuOutputName];
          if (!output) throw new Error('RealESRGAN inference returned no output tensor.');
          composed.push({ ...tile, rgb: await tensorFloats(output) });
        }
        rgba = composeTilesToRgba8(composed, outWidth, outHeight, featherWindow);
        break;
      } catch (error) {
        const ranFp16 = message.modelUrlFp16 != null
          && message.modelUrlFp16 !== message.modelUrl
          && cpuSessionInfo.url === message.modelUrlFp16;
        if (fp16Fallback === 0 && ranFp16 && isShaderCompileError(error)) {
          fp16Disabled = true;
          for (const [key, entry] of sessions) {
            if (entry.url === message.modelUrlFp16) sessions.delete(key);
          }
          continue;
        }
        throw error;
      }
    }

    // Transport-sized output: box-average the 4x result down to the
    // pipeline's presentation target (mirrors the native host). Absent,
    // zero, or out-of-range targets keep the legacy full 4x frame.
    let finalWidth = outWidth;
    let finalHeight = outHeight;
    const targetWidth = message.targetWidth;
    const targetHeight = message.targetHeight;
    if (Number.isInteger(targetWidth) && Number.isInteger(targetHeight)
        && targetWidth > 0 && targetHeight > 0
        && targetWidth <= outWidth && targetHeight <= outHeight
        && (targetWidth !== outWidth || targetHeight !== outHeight)) {
      rgba = downscaleRgba8Box(rgba, outWidth, outHeight, targetWidth, targetHeight);
      finalWidth = targetWidth;
      finalHeight = targetHeight;
      lastFramePath = 'cpu-tiles-gpu-downscaled';
    }

    // Black-frame guard kept for safety — gpu-compose is now disabled, so
    // this never fires, but leave it in case batched is re-enabled later.
    if (lastFramePath === 'gpu-compose' && isBlackFrame(rgba)) {
      gpuComposeDisabled = true;
      console.warn('[RealESRGAN worker] gpu compose produced a black frame; downgrading to CPU compose');
      const cpuSessionInfo = await getSession(
        message.modelUrl, message.modelUrlFp16, 1, tileH, tileW, tileH * 4, tileW * 4, false,
      );
      const cpuSession = cpuSessionInfo.session;
      const cpuInputName = cpuSession.inputNames[0] ?? 'input';
      const cpuOutputName = cpuSession.outputNames[0] ?? 'output';
      const composed = [];
      for (const tile of tiles) {
        const tileRgb = extractTilePlanar(message.data, width, height, tile.x, tile.y, tile.width, tile.height);
        const tensor = new ort.Tensor('float32', tileRgb, [1, 3, tile.height, tile.width]);
        const result = await runShapePinned(cpuSession, cpuInputName, tensor, cpuOutputName, async () => {
          for (const key of [...sessions.keys()]) {
            if (key.startsWith(message.modelUrl)) sessions.delete(key);
          }
          return await getSession(
            message.modelUrl, message.modelUrlFp16, 1, tileH, tileW, tileH * 4, tileW * 4, false,
          );
        });
        const output = result[cpuOutputName];
        if (!output) throw new Error('RealESRGAN inference returned no output tensor.');
        composed.push({ ...tile, rgb: await tensorFloats(output) });
      }
      rgba = composeTilesToRgba8(composed, outWidth, outHeight, featherWindow);
      lastFramePath = 'cpu-tiles (black-frame downgrade)';
    }

    self.postMessage(
      {
        type: 'infer',
        id: message.id,
        ok: true,
        width: finalWidth,
        height: finalHeight,
        data: rgba,
        path: lastFramePath,
      },
      [rgba.buffer],
    );
  } catch (error) {
    self.postMessage({ type: 'infer', id: message.id, ok: false, error: String(error) });
  }
}

export function resetWorkerStateForTests() {
  ort = null;
  sessions.clear();
  gpuComposeDisabled = false;
  fp16Disabled = false;
  sessionCreateTimeoutMs = 30000;
}

self.onmessage = event => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'init') {
    void handleInit(message);
  } else if (message.type === 'infer') {
    void handleInfer(message);
  }
};
