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
 *        - Fast path: one batched session.run on the CPU-readback lane
 *          (gpu-buffer outputs off), floats downloaded and composed on CPU
 *          or WASM-SIMD.
 *        - Fallback: the proven per-tile sequential loop, same arithmetic,
 *          when a batched run fails (sticky for this worker's life).
 *        - fp16 fallback: a shader-compile failure on the fp16 model
 *          disables it worker-wide and redoes the frame on fp32.
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

// <generated-tile-geometry>
// GENERATED from src/shared/realesrgan-tile-geometry.js — do not edit.
// Run `node scripts/generate-worker-tiling.mjs` after changing the source.
/**
 * Positions along one axis: maxTile-wide entries stepping by
 * (maxTile - overlap), last position clamped to size - maxTile.
 */
export function tileAxis(size, maxTile, overlap) {
  if (size <= maxTile) return [0];
  const stride = maxTile - overlap;
  const positions = [];
  let position = 0;
  while (position + maxTile < size) {
    positions.push(position);
    position += stride;
  }
  positions.push(size - maxTile);
  return positions;
}

/**
 * Default single-tile gate for a frame (Hebel 1.2): frames that fit a
 * bounded transient (<= 1024x576 pixels, +35% over the 480p cap the browser
 * already runs single-tile) run as one inference instead of two
 * ~fully-overlapping tiles at ~2x cost. Wider frames keep the tile-size
 * gate so large inputs cannot blow the transient budget.
 */
export function defaultSingleTileMaxHeight(width, height, maxTileSize) {
  if (maxTileSize >= 512 && width * height <= 1024 * 576) return 576;
  return Math.min(576, maxTileSize);
}

/**
 * Worker-facing alias: the generated worker copy historically exports this
 * name (bench, tests and the infer path import it). Same rule, one body.
 */
export const singleTileMaxHeightForFrame = defaultSingleTileMaxHeight;

/** Default overlap for a tile size: 24px for both real geometries. */
export function defaultOverlapFor(maxTileSize) {
  return Math.min(24, Math.floor(maxTileSize / 16));
}

/** Feather window the compositor needs for an overlap (output pixels). */
export function featherWindowForOverlap(overlap) {
  return Math.max(1, overlap * 2);
}

/**
 * Tile plan for one frame. Every produced tile has the same stepping rule;
 * uniform tiles are what makes one batched session.run legal for the whole
 * frame. Sources at or below singleTileMaxHeight run whole.
 */
export function planUniformTiles(width, height, maxTileSize, overlap, singleTileMaxHeight) {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`Invalid source width: ${width}`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`Invalid source height: ${height}`);
  }
  if (!Number.isInteger(maxTileSize) || maxTileSize <= 0) {
    throw new Error(`Invalid maxTileSize: ${maxTileSize}`);
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxTileSize) {
    throw new Error(`Invalid overlap: ${overlap} for maxTileSize ${maxTileSize}`);
  }
  if (!Number.isInteger(singleTileMaxHeight) || singleTileMaxHeight <= 0) {
    throw new Error(`Invalid singleTileMaxHeight: ${singleTileMaxHeight}`);
  }
  if (height <= singleTileMaxHeight) {
    return [{ x: 0, y: 0, width, height }];
  }
  const positions = (size) => tileAxis(size, maxTileSize, overlap);
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

/**
 * Complete worker frame geometry: tile size bound, overlap, single-tile
 * gate, tile list and feather window. One call replaces the scattered
 * 384/512 + 24 + gate + 48 literals at the worker call site.
 */
export function planWorkerFrame(width, height) {
  const maxTileSize = width * height >= 1920 * 1080 ? 384 : 512;
  const overlap = defaultOverlapFor(maxTileSize);
  const singleTileMaxHeight = defaultSingleTileMaxHeight(width, height, maxTileSize);
  return {
    maxTileSize,
    overlap,
    singleTileMaxHeight,
    tiles: planUniformTiles(width, height, maxTileSize, overlap, singleTileMaxHeight),
    featherWindow: featherWindowForOverlap(overlap),
  };
}
// </generated-tile-geometry>

// <generated-ort-shape-pinning>
// GENERATED from src/shared/realesrgan-ort-shape-pinning.js — do not edit.
// Run `node scripts/generate-worker-tiling.mjs` after changing the source.

/**
 * Free-dimension overrides pinning ONE exact I/O shape. `outHeight` /
 * `outWidth` are the model's output dims for that input (4x for RealESRGAN).
 */
export function buildFreeDimensionOverrides(options) {
  return {
    batch_size: options.batchSize,
    height: options.height,
    width: options.width,
    out_batch_size: options.batchSize,
    out_height: options.outHeight,
    out_width: options.outWidth,
  };
}
// </generated-ort-shape-pinning>

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
  const sourcePixels = sourceWidth * sourceHeight;
  // Direct row copies into the batch backing (no per-tile intermediate
  // allocation + second copy: extractTilePlanar + batch.set touched every
  // tile pixel twice and GC'd a 3MB buffer per tile at 720p). Dimensions
  // stay the first tile's (uniform batches by construction), exactly like
  // the extractTilePlanar call this replaces.
  for (let b = 0; b < tiles.length; b += 1) {
    const t = tiles[b];
    const base = b * 3 * tilePixels;
    for (let c = 0; c < 3; c += 1) {
      const srcPlaneOffset = c * sourcePixels;
      const dstPlaneOffset = base + c * tilePixels;
      for (let row = 0; row < tile.height; row += 1) {
        const srcOffset = srcPlaneOffset + (t.y + row) * sourceWidth + t.x;
        batch.set(inputRgb.subarray(srcOffset, srcOffset + tile.width), dstPlaneOffset + row * tile.width);
      }
    }
  }
  return batch;
}

// --- CPU compose -------------------------------------------------------------

// Little-endian RGBA8 word packing for the compose pack loops: one 32-bit
// store per pixel instead of four byte stores. Returns null (caller keeps the
// byte lane) on big-endian or a 4-unaligned target.
const IS_LITTLE_ENDIAN = (() => {
  try {
    const probe = new ArrayBuffer(2);
    new DataView(probe).setUint16(0, 1, true);
    return new Uint16Array(probe)[0] === 1;
  } catch {
    return false;
  }
})();
function packedRgbaView(bytes, length) {
  try {
    if (!IS_LITTLE_ENDIAN || bytes.byteOffset % 4 !== 0) return null;
    return new Uint32Array(bytes.buffer, bytes.byteOffset, length);
  } catch {
    return null;
  }
}
function packRgbaWord(r, g, b) {
  return (r | (g << 8) | (b << 16) | 0xff000000) >>> 0;
}

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
  const ramp = (length) => cachedFeatherRamp(length, featherWindow);
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
  const words = packedRgbaView(rgba, outPixels);
  if (words) {
    for (let i = 0; i < outPixels; i += 1) {
      const w = weights[i] || 1;
      const vr = acc[i] / w;
      const vg = acc[outPixels + i] / w;
      const vb = acc[2 * outPixels + i] / w;
      words[i] = packRgbaWord(
        ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0,
        ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0,
        ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0,
      );
    }
    return rgba;
  }
  for (let i = 0; i < outPixels; i += 1) {
    const w = weights[i] || 1;
    // Branchless clamp + truncate-pack, bit-identical to the Math.round /
    // Math.min / Math.max chain (see realesrgan-tensor.ts).
    const vr = acc[i] / w;
    const vg = acc[outPixels + i] / w;
    const vb = acc[2 * outPixels + i] / w;
    rgba[i * 4] = ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0;
    rgba[i * 4 + 1] = ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0;
    rgba[i * 4 + 2] = ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

// Per-(length, window) feather ramps for the CPU compose above: tile
// geometries repeat every frame, so rebuilding the same ramps per tile per
// frame is pure GC churn. Read-only shares (compose only reads them).
const featherRampCache = new Map();
function cachedFeatherRamp(length, featherWindow) {
  const key = length * 4096 + featherWindow;
  const hit = featherRampCache.get(key);
  if (hit) return hit;
  const r = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    r[i] = Math.min(Math.min(i, length - 1 - i) + 1, featherWindow);
  }
  if (featherRampCache.size >= 64) featherRampCache.clear();
  // Shared read-only (see realesrgan-tensor.ts): no Object.freeze, it
  // throws on TypedArrays with elements — the guard would be the bug.
  featherRampCache.set(key, r);
  return r;
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
 * Single-tile fast lane (Hebel E5b): no overlap exists, so the weighted
 * average is algebraically the input itself — convert + pack directly, no
 * accumulator, no weights, no divisions. Bit-identical across engines (no
 * fused multiply-add can form: scale + round only). The full lane stays for
 * multi-tile frames and as the fallback.
 */
export function composeSingleTileToRgba8(rgb, width, height) {
  const pixels = width * height;
  if (!(rgb instanceof Float32Array) || rgb.length !== 3 * pixels) {
    throw new Error(`Invalid single-tile planar input: expected ${3 * pixels} floats.`);
  }
  const rgba = new Uint8Array(4 * pixels);
  const words = packedRgbaView(rgba, pixels);
  if (words) {
    for (let i = 0; i < pixels; i += 1) {
      const vr = rgb[i];
      const vg = rgb[i + pixels];
      const vb = rgb[i + 2 * pixels];
      words[i] = packRgbaWord(
        ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0,
        ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0,
        ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0,
      );
    }
    return rgba;
  }
  for (let i = 0; i < pixels; i += 1) {
    const vr = rgb[i];
    const vg = rgb[i + pixels];
    const vb = rgb[i + 2 * pixels];
    rgba[i * 4] = ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0;
    rgba[i * 4 + 1] = ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0;
    rgba[i * 4 + 2] = ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/**
 * Exact area-average box downscale of packed RGBA8. Each destination pixel
 * averages the source pixels overlapped by its box, with fractional edge
 * coverage weighted in. Uniform regions stay exactly uniform; identity
 * dimensions return a copy. Mirrors the native host's transport-sized
 * output so worker and native frames match pixel for pixel — including the
 * alpha rule: output is always opaque (255), like the host's box pass.
 * Every production input is opaque already (all writers set alpha 255),
 * so this is bit-identical on real frames while keeping the two engines
 * aligned by construction instead of by input luck.
 */
export function downscaleRgba8Box(rgba, srcWidth, srcHeight, dstWidth, dstHeight) {
  const out = new Uint8Array(dstWidth * dstHeight * 4);
  // Integer fast lane for exact power-of-two factors (mirrors the native
  // host's tiled transport-downscale): every weight is exactly 1.0 over a
  // power-of-two area, so integer averaging is bit-identical to the float
  // box below while skipping per-pixel fractional math.
  const isPow2 = (v) => v > 0 && (v & (v - 1)) === 0;
  if (srcWidth % dstWidth === 0 && srcHeight % dstHeight === 0
      && isPow2(srcWidth / dstWidth) && isPow2(srcHeight / dstHeight)) {
    const fx = srcWidth / dstWidth;
    const fy = srcHeight / dstHeight;
    const area = fx * fy;
    const half = area / 2;
    for (let dy = 0; dy < dstHeight; dy += 1) {
      for (let dx = 0; dx < dstWidth; dx += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let sy = 0; sy < fy; sy += 1) {
          const srcRow = ((dy * fy + sy) * srcWidth + dx * fx) * 4;
          for (let sx = 0; sx < fx; sx += 1) {
            const srcOffset = srcRow + sx * 4;
            r += rgba[srcOffset];
            g += rgba[srcOffset + 1];
            b += rgba[srcOffset + 2];
          }
        }
        const dstOffset = (dy * dstWidth + dx) * 4;
        out[dstOffset] = (r + half) / area | 0;
        out[dstOffset + 1] = (g + half) / area | 0;
        out[dstOffset + 2] = (b + half) / area | 0;
        out[dstOffset + 3] = 255;
      }
    }
    return out;
  }
  for (let dy = 0; dy < dstHeight; dy += 1) {
    const yStart = (dy * srcHeight) / dstHeight;
    const yEnd = ((dy + 1) * srcHeight) / dstHeight;
    for (let dx = 0; dx < dstWidth; dx += 1) {
      const xStart = (dx * srcWidth) / dstWidth;
      const xEnd = ((dx + 1) * srcWidth) / dstWidth;
      let r = 0;
      let g = 0;
      let b = 0;
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
          area += weight;
        }
      }
      const dstOffset = (dy * dstWidth + dx) * 4;
      out[dstOffset] = Math.round(r / area);
      out[dstOffset + 1] = Math.round(g / area);
      out[dstOffset + 2] = Math.round(b / area);
      out[dstOffset + 3] = 255;
    }
  }
  return out;
}

/** Fetch a tensor's floats regardless of its location (gpu-buffer or cpu). */
async function tensorFloats(tensor) {
  if (typeof tensor.download === 'function') {
    return await tensor.download();
  }
  return tensor.data;
}

// --- ORT session management -------------------------------------------------

let ort = null;
// cacheKey -> { session, ep, preferGpuOutputs, url }. Geometries per video
// are few (fixed frame size + hysteretic crops), but the worker outlives
// pipelines across SPA navigations, so cap the map: evict the stalest entry
// past the cap (a revisit just rebuilds it — cost, never incorrectness).
const sessions = new Map();
const MAX_CACHED_SESSIONS = 16;
function cacheSession(cacheKey, entry) {
  if (sessions.has(cacheKey)) sessions.delete(cacheKey);
  sessions.set(cacheKey, entry);
  while (sessions.size > MAX_CACHED_SESSIONS) {
    const oldest = sessions.keys().next();
    if (oldest.done) break;
    sessions.delete(oldest.value);
  }
}

/**
 * Drop every cached session whose cache key pins this base model URL. The
 * cache key is the joined session spec (modelUrl | modelUrlFp16 | shapes |
 * gpu-buffer flag), so a prefix match covers all shape/gpu-buffer variants
 * created from that model. This is the ONLY sanctioned way to invalidate the
 * session cache; nothing type-checks the key format, so keep purges here.
 * Exported for unit tests (boundary matching); production callers are the
 * shape-pinned rebuild closures below.
 */
export function purgeModelSessions(modelUrl) {
  // Boundary-anchored match: the key is `modelUrl|fp16|shapes|flag`, so a
  // bare prefix would also evict a future model whose URL merely extends
  // this one (e.g. `…/x4.onnx` vs `…/x4.onnx2`).
  const prefix = `${modelUrl}|`;
  for (const key of [...sessions.keys()]) {
    if (key === modelUrl || key.startsWith(prefix)) sessions.delete(key);
  }
}

/** Drop every cached session that resolved to exactly this model URL. */
function purgeSessionsResolvedTo(url) {
  for (const [key, entry] of sessions) {
    if (entry.url === url) sessions.delete(key);
  }
}

// Sticky fp16 skip: a shader-compile failure (Clip kernel on Tint) proves the
// fp16 model cannot run on this device; stop attempting it for this life.
let fp16Disabled = false;
// Bound for InferenceSession.create: a hung create (seen after a device-side
// shader failure) must not wedge the worker forever.
let sessionCreateTimeoutMs = 30000;

// Worker reply error codes for { ok: false } replies. Canonical table lives
// in realesrgan-worker-protocol.js; this file cannot import it (Blob-URL,
// import-free), so the literals are pinned by tests/realesrgan-worker-frame
// and the client classifies per code instead of parsing prose.
const WORKER_REPLY_TIMEOUT = 'worker-timeout';
const WORKER_REPLY_FAILED = 'worker-failed';

/** Error carrying its reply code so handleInfer can tag the response. */
function workerError(code, message) {
  const error = new Error(message);
  error.replyCode = code;
  return error;
}

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
  // The cache key pins the exact I/O shape plus the gpu-buffer flag (shape
  // rationale in the generated shape-pinning block above). Batched
  // gpu-buffer stays disabled until E2E'd (see handleInfer).
  const cacheKey = [
    modelUrl,
    modelUrlFp16 ?? '',
    inputBatch, inputHeight, inputWidth,
    outputHeight, outputWidth,
    wantGpuBuffer ? 'gpu-buffer' : 'gpu',
  ].join('|');
  const cached = sessions.get(cacheKey);
  if (cached) {
    // Refresh recency so the steady-state session is never the eviction pick.
    sessions.delete(cacheKey);
    sessions.set(cacheKey, cached);
    return cached;
  }
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
    // Skip fp16 attempts the moment an earlier one proved the model
    // unrunnable (set just below); the second fp16 variant would fail the
    // same shader compile.
    if (fp16Disabled && modelUrlFp16 && attempt.url === modelUrlFp16) continue;
    try {
      const pendingCreate = ort.InferenceSession.create(attempt.url, {
        executionProviders: ['webgpu'],
        ...(attempt.useGpuBuffer ? { preferredOutputLocation: 'gpu-buffer', enableMemPattern: false } : { enableMemPattern: false }),
        // Shape pinning rationale lives in the generated shape-pinning
        // block above; one builder serves the worker and the main thread.
        freeDimensionOverrides: buildFreeDimensionOverrides({
          batchSize: inputBatch,
          height: inputHeight,
          width: inputWidth,
          outHeight: outputHeight,
          outWidth: outputWidth,
        }),
      });
      // A late success after the timeout below is adopted when the key is
      // still unserved and policy still allows the URL (an fp16 attempt
      // that meanwhile proved unrunnable stays dropped); otherwise it is
      // released with the race instead of lingering uncached.
      let timedOut = false;
      void pendingCreate.then(
        late => {
          if (!timedOut || sessions.has(cacheKey)) return;
          if (fp16Disabled && attempt.url === modelUrlFp16) return;
          cacheSession(cacheKey, {
            session: late,
            ep: 'webgpu',
            preferGpuOutputs: attempt.useGpuBuffer,
            url: attempt.url,
          });
        },
        () => {},
      );
      let timer;
      let session;
      try {
        session = await Promise.race([
          pendingCreate,
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              reject(workerError(WORKER_REPLY_TIMEOUT, `RealESRGAN session creation timed out after ${sessionCreateTimeoutMs}ms (${attempt.url})`));
            }, sessionCreateTimeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      const entry = {
        session,
        ep: 'webgpu',
        preferGpuOutputs: attempt.useGpuBuffer,
        url: attempt.url,
      };
      cacheSession(cacheKey, entry);
      return entry;
    } catch (error) {
      // A create-time shader failure proves the fp16 model unrunnable here,
      // exactly like the run-time failure the outer cascade handles: disable
      // it worker-wide now instead of paying a doomed fp16 create per shape.
      if (!fp16Disabled && modelUrlFp16 && modelUrlFp16 !== modelUrl
        && attempt.url === modelUrlFp16 && isShaderCompileError(error)) {
        fp16Disabled = true;
        purgeSessionsResolvedTo(modelUrlFp16);
      }
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
    // Hebel E5: pixel-kernel module URL (optional). Loading stays lazy at
    // first compose so a missing/blocked file cannot delay init; absence
    // only costs the SIMD speedup, never a frame.
    if (typeof message.pixelsUrl === 'string' && message.pixelsUrl) {
      pixelsWasmUrl = message.pixelsUrl;
    }
    self.postMessage({ type: 'init', ok: true });
  } catch (error) {
    self.postMessage({ type: 'init', ok: false, error: String(error) });
  }
}

/**
 * ORT-boundary classifier (the ONLY prose match on this path): the runtime
 * tags nothing, so the shape-pinned output-buffer hit and the run-timeout we
 * armed ourselves with are recognized by message here, once, and converted
 * into control flow. Everything downstream of this helper decides per
 * replyCode, never per prose.
 */
function isShapePinnedBufferError(error) {
  return /Shape mismatch attempting to re-use buffer|timed out after 8s/i.test(String(error));
}

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
  // The timer is cleared on settle so successful runs don't retain its
  // closure for the full 8 s each.
  const RUN_TIMEOUT_MS = 8000;
  const runWithTimeout = (sess) => {
    let timer;
    const result = Promise.race([
      sess.run({ [inputName]: tensor }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(workerError(WORKER_REPLY_TIMEOUT, 'RealESRGAN session.run timed out after 8s')), RUN_TIMEOUT_MS);
      }),
    ]);
    return result.finally(() => clearTimeout(timer));
  };
  try {
    return await runWithTimeout(session);
  } catch (error) {
    if (!isShapePinnedBufferError(error)) throw error;
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

// Sticky batch downgrade (Hebel 2.2): one failed batched run (OOM/shape on
// an untested device) must not cost a failed attempt on every frame; the
// sequential loop below is proven and takes over for this worker's life.
// Timeouts are NOT sticky evidence (transient slowness): they downgrade
// only after repeated strikes, so one slow frame cannot retire batching.
let batchedTilesDisabled = false;
let batchedDowngradeLogged = false;
let batchedTimeoutStreak = 0;
const BATCHED_TIMEOUT_STRIKES = 3;

/** Timeout-coded failures (transient slowness) vs batch-breaking ones. */
function isBatchTimeout(error) {
  return !!error && (error.replyCode === WORKER_REPLY_TIMEOUT
    || (typeof error.message === 'string' && /timed out after \d+s/i.test(error.message)));
}

// --- WASM-SIMD compose (Hebel E5) --------------------------------------------
// pixels.wasm (built from native/wasm-pixels) accelerates the feathered
// compose; the JS functions above stay as the proven fallback. Loading is
// lazy and non-fatal (missing file, CSP, no SIMD128 -> JS serves every
// frame); a trapping module disables itself sticky for this worker's life.

let pixelsWasmUrl = null;
let pixelsModule = null;
let pixelsDowngradeLogged = false;
let pixelsLoader = null;
// In-flight load shared by concurrent first frames (single-flight), plus a
// retry cooldown: one transient fetch hiccup must not disable wasm for the
// worker's life, but a persistently broken URL must not cost a fetch per
// frame either.
let pixelsLoadPromise = null;
let pixelsNextRetryAt = 0;
const PIXELS_LOAD_RETRY_COOLDOWN_MS = 60_000;

/** Injectable so tests can supply a fake module without WebAssembly. */
export function __setPixelsLoaderForTests(loader) {
  pixelsLoader = loader;
}

/** Injectable so tests can arm a fake module directly (bypasses fetch). */
export function __setPixelsModuleForTests(mod) {
  pixelsModule = mod;
}

const PIXELS_EXPORTS = ['memory', 'stage_ptr', 'compose_exec', 'compose_single_exec', 'compose_output_ptr', 'compose_output_len'];

async function defaultPixelsLoader(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`pixels.wasm fetch failed: ${response.status}`);
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}

async function ensurePixelsModule() {
  if (pixelsModule) return pixelsModule;
  if (pixelsLoadPromise) return pixelsLoadPromise;
  if (Date.now() < pixelsNextRetryAt) return null;
  pixelsLoadPromise = loadPixelsModule().finally(() => {
    pixelsLoadPromise = null;
  });
  return pixelsLoadPromise;
}

async function loadPixelsModule() {
  try {
    if (!pixelsWasmUrl) return null;
    const load = pixelsLoader ?? defaultPixelsLoader;
    const mod = await load(pixelsWasmUrl);
    for (const name of PIXELS_EXPORTS) {
      if (!mod || typeof mod[name] === 'undefined') throw new Error(`pixels.wasm missing export ${name}`);
    }
    pixelsModule = mod;
  } catch (error) {
    console.warn('[RealESRGAN worker] pixels.wasm unavailable; JS compose fallback', error);
    pixelsModule = null;
    pixelsNextRetryAt = Date.now() + PIXELS_LOAD_RETRY_COOLDOWN_MS;
  }
  return pixelsModule;
}

function disablePixelsModule(error) {
  if (pixelsModule !== null) {
    if (!pixelsDowngradeLogged) {
      pixelsDowngradeLogged = true;
      console.warn('[RealESRGAN worker] pixels.wasm failed; JS compose fallback for this worker life', error);
    }
    pixelsModule = null;
  }
}

/** Fresh views per call: exec may grow memory and detach earlier views. */
function pixelsViews(mod) {
  return {
    u8: () => new Uint8Array(mod.memory.buffer),
    f32: () => new Float32Array(mod.memory.buffer),
    u32: () => new Uint32Array(mod.memory.buffer),
  };
}

function composeSingleWasm(mod, rgb, width, height) {
  const views = pixelsViews(mod);
  const staged = mod.stage_ptr(0, rgb.byteLength);
  views.u8().set(new Uint8Array(rgb.buffer, rgb.byteOffset, rgb.byteLength), staged);
  mod.compose_single_exec(width * height);
  const ptr = mod.compose_output_ptr();
  const len = mod.compose_output_len();
  if (len !== width * height * 4) throw new Error(`pixels.wasm single output ${len}, expected ${width * height * 4}.`);
  return pixelsViews(mod).u8().slice(ptr, ptr + len);
}

function composeMultiWasm(mod, batched, planTiles, tileOutW, tileOutH, outWidth, outHeight, featherWindow) {
  const views = pixelsViews(mod);
  const batchOff = mod.stage_ptr(0, batched.byteLength);
  views.u8().set(new Uint8Array(batched.buffer, batched.byteOffset, batched.byteLength), batchOff);
  const descs = new Uint32Array(planTiles.length * 2);
  planTiles.forEach((tile, index) => {
    descs[index * 2] = tile.x * 4;
    descs[index * 2 + 1] = tile.y * 4;
  });
  const descOff = mod.stage_ptr(1, descs.byteLength);
  views.u32().set(descs, descOff / 4);
  mod.compose_exec(outWidth, outHeight, featherWindow, planTiles.length, tileOutW, tileOutH);
  const ptr = mod.compose_output_ptr();
  const len = mod.compose_output_len();
  if (len !== outWidth * outHeight * 4) {
    throw new Error(`pixels.wasm multi output ${len}, expected ${outWidth * outHeight * 4}.`);
  }
  return pixelsViews(mod).u8().slice(ptr, ptr + len);
}

/**
 * Compose one frame's tile results to RGBA8, fastest available implementation
 * first: WASM-SIMD single/multi lane, then the proven JS lanes. Returns the
 * bytes plus the path label for the onFramePath log. `inferred` is
 * { tiles, batched } from runBatchedTiles (batched null on the sequential
 * downgrade path, which always serves JS).
 */
async function composeFrameOutput(inferred, planTiles, tileW, tileH, outWidth, outHeight, featherWindow) {
  const mod = await ensurePixelsModule();
  // Single tile: fast lane (no overlap, no divisions).
  if (planTiles.length === 1 && inferred.tiles.length === 1) {
    const rgb = inferred.tiles[0].rgb;
    if (mod !== null) {
      try {
        return { rgba: composeSingleWasm(mod, rgb, outWidth, outHeight), path: 'cpu-single-wasm' };
      } catch (error) {
        disablePixelsModule(error);
      }
    }
    return { rgba: composeSingleTileToRgba8(rgb, outWidth, outHeight), path: 'cpu-single-gpu' };
  }
  // Multi tile: full feathered compose.
  if (mod !== null && inferred.batched) {
    try {
      return {
        rgba: composeMultiWasm(mod, inferred.batched, planTiles, tileW * 4, tileH * 4, outWidth, outHeight, featherWindow),
        path: 'cpu-tiles-wasm',
      };
    } catch (error) {
      disablePixelsModule(error);
    }
  }
  return {
    rgba: composeTilesToRgba8(inferred.tiles, outWidth, outHeight, featherWindow),
    // `batched: null` marks the post-downgrade sequential lane: same
    // arithmetic, but one session.run per tile instead of one batched
    // launch. Label it distinctly — the old shared 'cpu-tiles-batched-gpu'
    // blinded E2E/log diagnostics to the downgrade.
    path: planTiles.length > 1
      ? (inferred.batched ? 'cpu-tiles-batched-gpu' : 'cpu-tiles-sequential-gpu')
      : 'cpu-tiles-gpu',
  };
}

/**
 * Hebel 2.2: ONE session.run for the whole frame. All (uniform) tiles are
 * stacked into a [B,3,h,w] batch: same weights, same per-tile arithmetic as
 * the sequential loop, but one launch, one validation, one output-buffer
 * dance instead of N. `probe` receives the serving session's URL so the
 * caller can attribute shader failures to the fp16/fp32 attempt.
 */
async function runBatchedTiles(message, tiles, tileW, tileH, probe) {
  const batchCount = tiles.length;
  const sessInfo = await getSession(
    message.modelUrl, message.modelUrlFp16, batchCount, tileH, tileW, tileH * 4, tileW * 4, false,
  );
  probe.url = sessInfo.url;
  const session = sessInfo.session;
  const inputName = session.inputNames[0] ?? 'input';
  const outputName = session.outputNames[0] ?? 'output';
  const batch = stackTilesToBatch(message.data, message.width, message.height, tiles);
  const tensor = new ort.Tensor('float32', batch, [batchCount, 3, tileH, tileW]);
  const result = await runShapePinned(session, inputName, tensor, outputName, async () => {
    purgeModelSessions(message.modelUrl);
    const fresh = await getSession(
      message.modelUrl, message.modelUrlFp16, batchCount, tileH, tileW, tileH * 4, tileW * 4, false,
    );
    // The rebuild may resolve to a different precision than the poisoned
    // session (fp16 create flaky on retry, fp32 fallback): the caller's
    // served-precision report must see the session that actually served.
    probe.url = fresh.url;
    return fresh;
  });
  const output = result[outputName];
  if (!output) throw new Error('RealESRGAN inference returned no output tensor.');
  const batched = await tensorFloats(output);
  return { tiles: splitBatchedOutput(batched, tiles), batched };
}

/**
 * Proven per-tile loop: one session.run per tile. Slow path and fallback
 * when batching is unavailable; bit-identical arithmetic to runBatchedTiles.
 */
async function runSequentialTiles(message, tiles, tileW, tileH, probe) {
  const sessInfo = await getSession(
    message.modelUrl, message.modelUrlFp16, 1, tileH, tileW, tileH * 4, tileW * 4, false,
  );
  probe.url = sessInfo.url;
  const session = sessInfo.session;
  const inputName = session.inputNames[0] ?? 'input';
  const outputName = session.outputNames[0] ?? 'output';
  const composed = [];
  for (const tile of tiles) {
    const tileRgb = extractTilePlanar(message.data, message.width, message.height, tile.x, tile.y, tile.width, tile.height);
    const tensor = new ort.Tensor('float32', tileRgb, [1, 3, tile.height, tile.width]);
    const result = await runShapePinned(session, inputName, tensor, outputName, async () => {
      purgeModelSessions(message.modelUrl);
      const fresh = await getSession(
        message.modelUrl, message.modelUrlFp16, 1, tileH, tileW, tileH * 4, tileW * 4, false,
      );
      probe.url = fresh.url;
      return fresh;
    });
    const output = result[outputName];
    if (!output) throw new Error('RealESRGAN inference returned no output tensor.');
    composed.push({ ...tile, rgb: await tensorFloats(output) });
  }
  return composed;
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
    // Conservative tile geometry from the canonical module: the dynamic
    // model accepts any shape, so tiles only bound memory, not the session.
    const { tiles, featherWindow } = planWorkerFrame(width, height);
    const tileH = tiles[0].height;
    const tileW = tiles[0].width;

    // GPU path: batched gpu-buffer stays off — per-tile GPU without
    // gpu-buffer is verified on RX 6750 XT (single-shape incl. gpu-buffer
    // outputs OK on RDNA-2); batched mixing plus compose-from-gpu-buffer
    // is untested, so downloads floats and CPU-composes. Revisit only
    // with hardware E2E, never behind a silent flag. (Hebel 2.2 batches on
    // the CPU-readback lane instead: no gpu-buffer involved.)
    let lastFramePath = 'cpu-tiles-gpu';
    let rgba = null;
    // Served-precision report for the pipeline's overlay label (set inside
    // the loop where probe is in scope; read at the reply below).
    let servedFp16 = false;
    // fp16 fallback: a shader-compile failure proves the fp16 model unrunnable
    // here. Disable it worker-wide, drop its cached sessions, and redo the
    // frame on fp32 instead of failing it.
    for (let fp16Fallback = 0; ; fp16Fallback += 1) {
      const probe = { url: null };
      try {
        let inferred;
        if (!batchedTilesDisabled) {
          try {
            inferred = await runBatchedTiles(message, tiles, tileW, tileH, probe);
            batchedTimeoutStreak = 0;
          } catch (batchError) {
            // Shader failures belong to the fp16 cascade below, not to
            // batching: rethrow so the attempt is retried on fp32 with
            // batching still enabled.
            if (isShaderCompileError(batchError)) throw batchError;
            if (isBatchTimeout(batchError) && batchedTimeoutStreak + 1 < BATCHED_TIMEOUT_STRIKES) {
              // One slow frame is transient slowness, not proof batching is
              // broken: serve this frame sequentially but keep batching
              // armed for the next frame.
              batchedTimeoutStreak += 1;
            } else {
              // Sticky sequential downgrade for anything else (OOM/shape, or
              // repeated timeouts): the same frame is served sequentially
              // right away, later frames skip the doomed batch attempt
              // entirely.
              if (!batchedDowngradeLogged) {
                batchedDowngradeLogged = true;
                console.warn('[RealESRGAN worker] batched tiles failed; sequential fallback for this worker life', batchError);
              }
              batchedTilesDisabled = true;
              batchedTimeoutStreak = 0;
            }
            inferred = {
              tiles: await runSequentialTiles(message, tiles, tileW, tileH, probe),
              batched: null,
            };
          }
        } else {
          inferred = {
            tiles: await runSequentialTiles(message, tiles, tileW, tileH, probe),
            batched: null,
          };
        }
        const composedResult = await composeFrameOutput(
          inferred, tiles, tileW, tileH, outWidth, outHeight, featherWindow,
        );
        rgba = composedResult.rgba;
        lastFramePath = composedResult.path;
        // probe.url holds the session URL that served the frame (set per
        // attempt in runBatchedTiles/runSequentialTiles, final attempt wins
        // after an fp16 retry), so the pipeline labels the stats window
        // truthfully instead of assuming fp32 whenever a runner served.
        servedFp16 = message.modelUrlFp16 != null
          && message.modelUrlFp16 !== message.modelUrl
          && probe.url === message.modelUrlFp16;
        break;
      } catch (error) {
        const ranFp16 = message.modelUrlFp16 != null
          && message.modelUrlFp16 !== message.modelUrl
          && probe.url === message.modelUrlFp16;
        if (fp16Fallback === 0 && ranFp16 && isShaderCompileError(error)) {
          fp16Disabled = true;
          purgeSessionsResolvedTo(message.modelUrlFp16);
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
      // Suffix, not a rename: keep which lane served (wasm/single/batched/
      // sequential) visible on downscaled frames too.
      lastFramePath = `${lastFramePath}-downscaled`;
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
        fp16: servedFp16,
      },
      [rgba.buffer],
    );
  } catch (error) {
    // Reply errors carry their taxonomy code (see WORKER_REPLY_* above):
    // the client classifies per code instead of parsing prose, so a reworded
    // message can never flip transient timeouts into permanent runner death.
    const code = error && error.replyCode ? error.replyCode : WORKER_REPLY_FAILED;
    self.postMessage({ type: 'infer', id: message.id, ok: false, code, error: String(error) });
  }
}

export function resetWorkerStateForTests() {
  ort = null;
  sessions.clear();
  fp16Disabled = false;
  batchedTilesDisabled = false;
  batchedDowngradeLogged = false;
  batchedTimeoutStreak = 0;
  pixelsWasmUrl = null;
  pixelsModule = null;
  pixelsLoadPromise = null;
  pixelsNextRetryAt = 0;
  pixelsDowngradeLogged = false;
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
