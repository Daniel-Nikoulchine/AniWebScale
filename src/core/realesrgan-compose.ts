/**
 * GPU tile composition for the RealESRGAN inference path.
 *
 * After the (CPU-side) ONNX inference has produced per-tile planar RGB
 * results, this composer blends them into the output texture with a single
 * compute dispatch instead of the CPU's per-pixel feathering loop. Each
 * output pixel walks the tile descriptors and reproduces the exact
 * separable feathering math of `composeTiledResult` (integer ramps,
 * weight = min(fx, fy), weighted average), so the GPU result matches the
 * CPU composer within float32 rounding.
 *
 * The pass needs no f32 atomics: one invocation owns one output pixel and
 * accumulates in registers. That also pins the accumulation order to the
 * tile order, exactly like the CPU loop, which keeps the two paths
 * bit-compatible.
 */

export interface RealEsrganComposeTile {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Planar RGB floats of the 4x-4x-upscaled tile, channel-major, in [0,1]. */
  rgb: Float32Array;
}

export interface ComposeBuffers {
  /** 8 u32 per tile: baseX, baseY, upW, upH, dataOffset, featherWindow, pad, pad. */
  descs: Uint32Array;
  /** Concatenated planar tile floats, in tile order. */
  data: Float32Array;
}

const DESC_U32_PER_TILE = 8;
const WORKGROUP_SIZE_X = 8;
const WORKGROUP_SIZE_Y = 8;

/**
 * Pack tile descriptors and tile pixel data for the compute shader. Pure
 * CPU-side planning, exported separately so it can be unit tested without a
 * GPUDevice.
 */
export function buildComposeBuffers(tiles: RealEsrganComposeTile[], featherWindow: number): ComposeBuffers {
  let totalFloats = 0;
  for (const tile of tiles) {
    totalFloats += 3 * (tile.width * 4) * (tile.height * 4);
  }
  const descs = new Uint32Array(tiles.length * DESC_U32_PER_TILE);
  const data = new Float32Array(totalFloats);
  let offset = 0;
  tiles.forEach((tile, index) => {
    const upW = tile.width * 4;
    const upH = tile.height * 4;
    const expected = 3 * upW * upH;
    if (tile.rgb.length !== expected) {
      throw new Error(`buildComposeBuffers: tile ${index} expected ${expected} floats, got ${tile.rgb.length}.`);
    }
    const base = index * DESC_U32_PER_TILE;
    descs[base] = tile.x * 4;
    descs[base + 1] = tile.y * 4;
    descs[base + 2] = upW;
    descs[base + 3] = upH;
    descs[base + 4] = offset;
    descs[base + 5] = featherWindow;
    descs[base + 6] = 0;
    descs[base + 7] = 0;
    data.set(tile.rgb, offset);
    offset += expected;
  });
  return { descs, data };
}

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

@compute @workgroup_size(${WORKGROUP_SIZE_X}, ${WORKGROUP_SIZE_Y})
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
    // Integer ramps identical to the CPU featherRamp(): distance from the
    // tile edge + 1, clamped to the feather window.
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
  // Match the CPU composer: clamp to [0,1], round half up to 0..255, then
  // hand exact k/255 values to the unorm store.
  let rr = floor(clamp(r / divisor, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  let gg = floor(clamp(g / divisor, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  let bb = floor(clamp(b / divisor, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  textureStore(outputTexture, vec2i(i32(px), i32(py)), vec4f(rr, gg, bb, 1.0));
}
`;

/**
 * Feathered tile composition on the GPU. Created opportunistically via
 * `tryCreate`; when construction fails (no compute support, validation
 * error) the pipeline keeps using the CPU composer.
 */
export class RealEsrganGpuComposer {
  private readonly device: GPUDevice;
  private readonly outputTexture: GPUTexture;
  private readonly computePipeline: GPUComputePipeline;
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private readonly paramsBuffer: GPUBuffer;
  private descBuffer: GPUBuffer | null = null;
  private descCapacity = 0;
  private dataBuffer: GPUBuffer | null = null;
  private dataCapacity = 0;
  private destroyed = false;

  public static tryCreate(device: GPUDevice, outputTexture: GPUTexture): RealEsrganGpuComposer | null {
    try {
      return new RealEsrganGpuComposer(device, outputTexture);
    } catch {
      return null;
    }
  }

  private constructor(device: GPUDevice, outputTexture: GPUTexture) {
    this.device = device;
    this.outputTexture = outputTexture;
    const module = device.createShaderModule({ label: 'RealESRGAN compose', code: composeWGSL });
    this.bindGroupLayout = device.createBindGroupLayout({
      label: 'RealESRGAN compose',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba8unorm' } },
      ],
    });
    this.computePipeline = device.createComputePipeline({
      label: 'RealESRGAN compose',
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      compute: { module, entryPoint: 'main' },
    });
    this.paramsBuffer = device.createBuffer({
      label: 'RealESRGAN compose params',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Compose all tiles into the output texture. Returns false when the frame
   * cannot be handled on the GPU (oversized tile data for the storage
   * binding limit, empty input, destroyed); the caller falls back to the
   * CPU composer then.
   */
  public compose(
    tiles: RealEsrganComposeTile[],
    outWidth: number,
    outHeight: number,
    featherWindow: number,
  ): boolean {
    if (this.destroyed || tiles.length === 0) return false;
    const { descs, data } = buildComposeBuffers(tiles, featherWindow);
    const bindingLimit = this.device.limits?.maxStorageBufferBindingSize ?? Number.POSITIVE_INFINITY;
    if (data.byteLength > bindingLimit) return false;

    this.ensureDescBuffer(tiles.length);
    this.ensureDataBuffer(data.length);
    const descBuffer = this.descBuffer!;
    const dataBuffer = this.dataBuffer!;

    this.device.queue.writeBuffer(this.paramsBuffer, 0, new Uint32Array([outWidth, outHeight, tiles.length, 0]));
    this.device.queue.writeBuffer(descBuffer, 0, descs);
    this.device.queue.writeBuffer(dataBuffer, 0, data);

    const bindGroup = this.device.createBindGroup({
      label: 'RealESRGAN compose',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: descBuffer } },
        { binding: 2, resource: { buffer: dataBuffer } },
        { binding: 3, resource: this.outputTexture.createView() },
      ],
    });
    const encoder = this.device.createCommandEncoder({ label: 'RealESRGAN compose' });
    const pass = encoder.beginComputePass({ label: 'RealESRGAN compose' });
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(outWidth / WORKGROUP_SIZE_X),
      Math.ceil(outHeight / WORKGROUP_SIZE_Y),
    );
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    return true;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.paramsBuffer.destroy();
    this.descBuffer?.destroy();
    this.dataBuffer?.destroy();
  }

  private ensureDescBuffer(tileCount: number): void {
    if (this.descCapacity >= tileCount) return;
    this.descBuffer?.destroy();
    this.descCapacity = Math.max(tileCount, this.descCapacity * 2, 16);
    this.descBuffer = this.device.createBuffer({
      label: 'RealESRGAN compose tile descriptors',
      size: this.descCapacity * DESC_U32_PER_TILE * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  private ensureDataBuffer(floatCount: number): void {
    if (this.dataCapacity >= floatCount) return;
    this.dataBuffer?.destroy();
    this.dataCapacity = Math.max(floatCount, this.dataCapacity * 2);
    this.dataBuffer = this.device.createBuffer({
      label: 'RealESRGAN compose tile data',
      size: this.dataCapacity * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }
}
