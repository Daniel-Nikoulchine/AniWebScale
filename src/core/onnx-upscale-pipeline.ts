import type * as Ort from 'onnxruntime-web/webgpu';
import { RendererInitializationError, RendererRuntimeError } from './errors';

const FLOAT_BYTES = 4;
const TRANSIENT_INFERENCE_ATTEMPTS = 2;

export type OnnxUpscaleModel = 'animejanai-x2';

export interface OnnxUpscaleModelDefinition {
  readonly id: OnnxUpscaleModel;
  readonly className: 'AnimeJaNaiX2';
  readonly displayName: string;
  readonly modelFile: string;
  readonly coreTileSize: number;
  readonly tilePadding: number;
  readonly outputScale: number;
}

export const ONNX_UPSCALE_MODELS: Record<OnnxUpscaleModel, OnnxUpscaleModelDefinition> = {
  'animejanai-x2': {
    id: 'animejanai-x2',
    className: 'AnimeJaNaiX2',
    displayName: 'AnimeJaNai HD V3.1 Performance x2',
    modelFile: 'models/AnimeJaNai-HD-V3.1-Performance-x2.onnx',
    coreTileSize: 512,
    tilePadding: 16,
    outputScale: 2,
  },
};

export function onnxUpscaleModelForClassName(className: string): OnnxUpscaleModelDefinition | null {
  return Object.values(ONNX_UPSCALE_MODELS).find(model => model.className === className) ?? null;
}

function createPreprocessWGSL(inputTileSize: number): string {
  return `
struct TileParams {
  inputOrigin: vec2i,
  sourceDimensions: vec2u,
  outputOrigin: vec2u,
  validDimensions: vec2u,
}

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> inputTensor: array<f32>;
@group(0) @binding(2) var<uniform> tile: TileParams;

const TILE_SIZE: u32 = ${inputTileSize}u;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= TILE_SIZE || id.y >= TILE_SIZE) { return; }
  let maximum = vec2i(tile.sourceDimensions) - vec2i(1);
  let source = clamp(tile.inputOrigin + vec2i(id.xy), vec2i(0), maximum);
  let color = clamp(textureLoad(sourceTexture, source, 0), vec4f(0.0), vec4f(1.0));
  let planeSize = TILE_SIZE * TILE_SIZE;
  let index = id.y * TILE_SIZE + id.x;
  inputTensor[index] = color.r;
  inputTensor[planeSize + index] = color.g;
  inputTensor[planeSize * 2u + index] = color.b;
}
`;
}

function createPostprocessWGSL(outputTileSize: number, crop: number): string {
  return `
struct TileParams {
  inputOrigin: vec2i,
  sourceDimensions: vec2u,
  outputOrigin: vec2u,
  validDimensions: vec2u,
}

@group(0) @binding(0) var<storage, read> outputTensor: array<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var<uniform> tile: TileParams;

const TILE_SIZE: u32 = ${outputTileSize}u;
const CROP: u32 = ${crop}u;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= tile.validDimensions.x || id.y >= tile.validDimensions.y) { return; }
  let source = id.xy + vec2u(CROP);
  let planeSize = TILE_SIZE * TILE_SIZE;
  let index = source.y * TILE_SIZE + source.x;
  let color = clamp(vec3f(
    outputTensor[index],
    outputTensor[planeSize + index],
    outputTensor[planeSize * 2u + index]
  ), vec3f(0.0), vec3f(1.0));
  textureStore(outputTexture, tile.outputOrigin + id.xy, vec4f(color, 1.0));
}
`;
}

function alignedBufferSize(elements: number): number {
  return Math.ceil(elements * FLOAT_BYTES / 16) * 16;
}

function isTransientBufferMappingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /mapAsync|unmapped before mapping was resolved|Failed to download data from buffer/i.test(message);
}

export interface OnnxUpscaleRuntime {
  readonly device: GPUDevice;
  readonly ort: typeof Ort;
  readonly session: Ort.InferenceSession;
  readonly model?: OnnxUpscaleModelDefinition;
}

export class OnnxUpscalePipeline {
  private outputTexture: GPUTexture;
  private readonly inputBuffer: GPUBuffer;
  private readonly outputBuffer: GPUBuffer;
  private readonly paramsBuffer: GPUBuffer;
  private readonly preprocessPipeline: GPUComputePipeline;
  private readonly postprocessPipeline: GPUComputePipeline;
  private preprocessBindGroup: GPUBindGroup;
  private postprocessBindGroup: GPUBindGroup;
  private readonly inputTensor: Ort.Tensor;
  private readonly outputTensor: Ort.Tensor;
  private destroyed = false;
  private processingPromise: Promise<void> | null = null;
  private cleanupPromise: Promise<void> | null = null;
  private cleanedUp = false;

  private constructor(
    private readonly device: GPUDevice,
    private inputTexture: GPUTexture,
    private readonly ort: typeof Ort,
    private readonly session: Ort.InferenceSession,
    private readonly model: OnnxUpscaleModelDefinition,
  ) {
    const inputTileSize = model.coreTileSize + model.tilePadding * 2;
    const outputTileSize = inputTileSize * model.outputScale;
    const inputElements = 3 * inputTileSize * inputTileSize;
    const outputElements = 3 * outputTileSize * outputTileSize;
    this.inputBuffer = device.createBuffer({
      label: `${model.displayName} input tensor`,
      size: alignedBufferSize(inputElements),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.outputBuffer = device.createBuffer({
      label: `${model.displayName} output tensor`,
      size: alignedBufferSize(outputElements),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.paramsBuffer = device.createBuffer({
      label: `${model.displayName} tile parameters`,
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.outputTexture = device.createTexture({
      label: `${model.displayName} output`,
      size: [inputTexture.width * model.outputScale, inputTexture.height * model.outputScale, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING
        | GPUTextureUsage.STORAGE_BINDING
        | GPUTextureUsage.COPY_SRC,
    });

    this.preprocessPipeline = device.createComputePipeline({
      label: `${model.displayName} texture-to-NCHW`,
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: createPreprocessWGSL(inputTileSize) }), entryPoint: 'main' },
    });
    this.postprocessPipeline = device.createComputePipeline({
      label: `${model.displayName} NCHW-to-texture`,
      layout: 'auto',
      compute: {
        module: device.createShaderModule({
          code: createPostprocessWGSL(outputTileSize, model.tilePadding * model.outputScale),
        }),
        entryPoint: 'main',
      },
    });
    this.preprocessBindGroup = device.createBindGroup({
      layout: this.preprocessPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: { buffer: this.inputBuffer } },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    });
    this.postprocessBindGroup = device.createBindGroup({
      layout: this.postprocessPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.outputBuffer } },
        { binding: 1, resource: this.outputTexture.createView() },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    });
    this.inputTensor = ort.Tensor.fromGpuBuffer(this.inputBuffer, {
      dataType: 'float32',
      dims: [1, 3, inputTileSize, inputTileSize],
    });
    this.outputTensor = ort.Tensor.fromGpuBuffer(this.outputBuffer, {
      dataType: 'float32',
      dims: [1, 3, outputTileSize, outputTileSize],
    });
  }

  public static async prepareRuntime(modelId: OnnxUpscaleModel = 'animejanai-x2'): Promise<OnnxUpscaleRuntime> {
    const model = ONNX_UPSCALE_MODELS[modelId];
    if (!__ANIME4K_BROWSER_ONNX__) {
      throw new RendererInitializationError(
        `${model.displayName} browser runtime is not packaged for this browser. Use the Native backend instead.`,
      );
    }
    try {
      const ort = await import('onnxruntime-web/webgpu');
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = {
        mjs: chrome.runtime.getURL('ort/ort-wasm-simd-threaded.asyncify.mjs'),
        wasm: chrome.runtime.getURL('ort/ort-wasm-simd-threaded.asyncify.wasm'),
      };
      const session = await ort.InferenceSession.create(
        chrome.runtime.getURL(model.modelFile),
        {
          executionProviders: [{ name: 'webgpu', preferredLayout: 'NCHW' }],
          graphOptimizationLevel: 'all',
          logSeverityLevel: 3,
        },
      );
      const device = await ort.env.webgpu.device;
      return { device, ort, session, model };
    } catch (error) {
      throw new RendererInitializationError(
        `${model.displayName} could not initialize: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error as Error },
      );
    }
  }

  public static create(runtime: OnnxUpscaleRuntime, inputTexture: GPUTexture): OnnxUpscalePipeline {
    const { device, ort, session } = runtime;
    const model = runtime.model ?? ONNX_UPSCALE_MODELS['animejanai-x2'];
    if (!OnnxUpscalePipeline.outputFitsDevice(device, inputTexture, model)) {
      void session.release().catch(() => undefined);
      throw new RendererInitializationError(
        `${model.displayName} exceeds this GPU's ${device.limits.maxTextureDimension2D}px texture limit.`,
      );
    }
    try {
      return new OnnxUpscalePipeline(device, inputTexture, ort, session, model);
    } catch (error) {
      void session.release().catch(() => undefined);
      throw error;
    }
  }

  public getOutputTexture(): GPUTexture {
    return this.outputTexture;
  }

  /** Rebind a resized/replaced video texture while keeping the loaded ONNX session. */
  public updateInputTexture(inputTexture: GPUTexture): void {
    if (this.destroyed) throw new RendererRuntimeError(`${this.model.displayName} has already been destroyed.`);
    if (this.processingPromise) {
      throw new RendererRuntimeError(`${this.model.displayName} cannot resize while a frame is being processed.`);
    }
    if (!OnnxUpscalePipeline.outputFitsDevice(this.device, inputTexture, this.model)) {
      throw new RendererRuntimeError(
        `${this.model.displayName} exceeds this GPU's ${this.device.limits.maxTextureDimension2D}px texture limit.`,
      );
    }

    const outputTexture = this.device.createTexture({
      label: `${this.model.displayName} output`,
      size: [
        inputTexture.width * this.model.outputScale,
        inputTexture.height * this.model.outputScale,
        1,
      ],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING
        | GPUTextureUsage.STORAGE_BINDING
        | GPUTextureUsage.COPY_SRC,
    });
    let preprocessBindGroup: GPUBindGroup;
    let postprocessBindGroup: GPUBindGroup;
    try {
      preprocessBindGroup = this.device.createBindGroup({
        layout: this.preprocessPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: { buffer: this.inputBuffer } },
          { binding: 2, resource: { buffer: this.paramsBuffer } },
        ],
      });
      postprocessBindGroup = this.device.createBindGroup({
        layout: this.postprocessPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.outputBuffer } },
          { binding: 1, resource: outputTexture.createView() },
          { binding: 2, resource: { buffer: this.paramsBuffer } },
        ],
      });

    } catch (error) {
      outputTexture.destroy();
      throw error;
    }

    const previousOutput = this.outputTexture;
    this.inputTexture = inputTexture;
    this.outputTexture = outputTexture;
    this.preprocessBindGroup = preprocessBindGroup;
    this.postprocessBindGroup = postprocessBindGroup;
    try {
      previousOutput.destroy();
    } catch {
      // A lost device may already have released the previous output texture.
    }
  }

  private static outputFitsDevice(
    device: GPUDevice,
    inputTexture: GPUTexture,
    model: OnnxUpscaleModelDefinition,
  ): boolean {
    return inputTexture.width * model.outputScale <= device.limits.maxTextureDimension2D
      && inputTexture.height * model.outputScale <= device.limits.maxTextureDimension2D;
  }

  public process(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    if (this.processingPromise) return this.processingPromise;

    const operation = this.processTiles();
    const tracked = operation.finally(() => {
      if (this.processingPromise === tracked) this.processingPromise = null;
    });
    this.processingPromise = tracked;
    return tracked;
  }

  private async runInference(inputName: string, outputName: string): Promise<void> {
    for (let attempt = 1; attempt <= TRANSIENT_INFERENCE_ATTEMPTS; attempt += 1) {
      try {
        await this.session.run(
          { [inputName]: this.inputTensor },
          { [outputName]: this.outputTensor },
        );
        return;
      } catch (error) {
        if (this.destroyed) return;
        if (!isTransientBufferMappingError(error) || attempt === TRANSIENT_INFERENCE_ATTEMPTS) throw error;

        // ORT's WebGPU buffer manager may start a staging-buffer map while work
        // submitted by the surrounding texture pipeline is still completing.
        // Drain the shared queue before retrying the one transient mapping failure.
        await this.device.queue.onSubmittedWorkDone();
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
  }

  private async processTiles(): Promise<void> {
    const inputName = this.session.inputNames[0];
    const outputName = this.session.outputNames[0];
    if (!inputName || !outputName) {
      throw new RendererRuntimeError(`${this.model.displayName} model I/O is unavailable.`);
    }

    try {
      const inputTileSize = this.model.coreTileSize + this.model.tilePadding * 2;
      for (let sourceY = 0; sourceY < this.inputTexture.height; sourceY += this.model.coreTileSize) {
        for (let sourceX = 0; sourceX < this.inputTexture.width; sourceX += this.model.coreTileSize) {
          if (this.destroyed) return;
          const validWidth = Math.min(this.model.coreTileSize, this.inputTexture.width - sourceX)
            * this.model.outputScale;
          const validHeight = Math.min(this.model.coreTileSize, this.inputTexture.height - sourceY)
            * this.model.outputScale;
          const params = new Int32Array([
            sourceX - this.model.tilePadding,
            sourceY - this.model.tilePadding,
            this.inputTexture.width,
            this.inputTexture.height,
            sourceX * this.model.outputScale,
            sourceY * this.model.outputScale,
            validWidth,
            validHeight,
          ]);
          this.device.queue.writeBuffer(this.paramsBuffer, 0, params);

          const preprocessEncoder = this.device.createCommandEncoder({ label: `${this.model.displayName} tile input` });
          const preprocessPass = preprocessEncoder.beginComputePass();
          preprocessPass.setPipeline(this.preprocessPipeline);
          preprocessPass.setBindGroup(0, this.preprocessBindGroup);
          preprocessPass.dispatchWorkgroups(
            Math.ceil(inputTileSize / 8),
            Math.ceil(inputTileSize / 8),
          );
          preprocessPass.end();
          this.device.queue.submit([preprocessEncoder.finish()]);
          // The next operation can make ORT map a staging buffer on models or
          // adapters that need a CPU-side transfer. Do not overlap that map with
          // our write into the shared input buffer.
          await this.device.queue.onSubmittedWorkDone();
          if (this.destroyed) return;

          await this.runInference(inputName, outputName);
          if (this.destroyed) return;

          const postprocessEncoder = this.device.createCommandEncoder({ label: `${this.model.displayName} tile output` });
          const postprocessPass = postprocessEncoder.beginComputePass();
          postprocessPass.setPipeline(this.postprocessPipeline);
          postprocessPass.setBindGroup(0, this.postprocessBindGroup);
          postprocessPass.dispatchWorkgroups(Math.ceil(validWidth / 8), Math.ceil(validHeight / 8));
          postprocessPass.end();
          this.device.queue.submit([postprocessEncoder.finish()]);
          // The same output buffer is rebound for the next tile. Waiting here
          // prevents ORT from unmapping/reusing it while postprocessing still
          // reads the previous tile.
          await this.device.queue.onSubmittedWorkDone();
        }
      }
    } catch (error) {
      if (this.destroyed) return;
      throw new RendererRuntimeError(
        `${this.model.displayName} inference failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error as Error },
      );
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const processing = this.processingPromise;
    this.cleanupPromise = (processing ? processing.catch(() => undefined) : Promise.resolve())
      .then(() => this.releaseResources());
  }

  private async releaseResources(): Promise<void> {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    try {
      await this.device.queue.onSubmittedWorkDone();
    } catch {
      // A lost device has no remaining work that can safely be awaited.
    }
    this.inputBuffer.destroy();
    this.outputBuffer.destroy();
    this.paramsBuffer.destroy();
    this.outputTexture.destroy();
    try {
      await this.session.release();
    } catch (error) {
      console.warn(`[Anime4K] ${this.model.displayName} session cleanup failed:`, error);
    }
  }
}
