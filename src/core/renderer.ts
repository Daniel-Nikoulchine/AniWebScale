import type { Dimensions, EnhancementEffect, RenderStats } from '../types';
import {
  scheduleEffectsForTarget,
  scheduledEffectPipelineKey,
} from '../shared/effect-scheduling';
import { createAnime4KShaderDevice } from '../shared/wgsl-fidelity';
import { RendererInitializationError, RendererRuntimeError } from './errors';
import { loadPipelineConstructor } from './pipeline-loader';
import type { Anime4KPipeline } from './pipeline-types';

const fullscreenQuadWGSL = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
  const positions = array(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  const uvs = array(
    vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0),
    vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(1.0, 0.0)
  );
  var output: VertexOutput;
  output.position = vec4f(positions[index], 0.0, 1.0);
  output.uv = uvs[index];
  return output;
}
`;

const adaptivePresentationWGSL = `
@group(0) @binding(0) var sourceSampler: sampler;
@group(0) @binding(1) var previousTexture: texture_2d<f32>;
@group(0) @binding(2) var currentTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> interpolationFactor: vec4f;

fn catmullRomWeight(value: f32) -> f32 {
  let x = abs(value);
  if (x < 1.0) {
    return 1.5 * x * x * x - 2.5 * x * x + 1.0;
  }
  if (x < 2.0) {
    return -0.5 * x * x * x + 2.5 * x * x - 4.0 * x + 2.0;
  }
  return 0.0;
}

fn sampleCurrentCatmullRom(uv: vec2f, dimensions: vec2f) -> vec4f {
  let texelPosition = uv * dimensions - vec2f(0.5);
  let base = floor(texelPosition);
  let fraction = texelPosition - base;
  var accumulated = vec4f(0.0);
  var weightSum = 0.0;

  for (var y: i32 = -1; y <= 2; y += 1) {
    for (var x: i32 = -1; x <= 2; x += 1) {
      let offset = vec2f(f32(x), f32(y));
      let weight = catmullRomWeight(offset.x - fraction.x)
        * catmullRomWeight(offset.y - fraction.y);
      let sampleUv = (base + offset + vec2f(0.5)) / dimensions;
      accumulated += textureSampleLevel(currentTexture, sourceSampler, sampleUv, 0.0) * weight;
      weightSum += weight;
    }
  }

  return accumulated / max(weightSum, 0.00001);
}

fn sampleCurrentAdaptiveArea(uv: vec2f, dimensions: vec2f, footprint: vec2f) -> vec4f {
  let countX = select(1u, u32(clamp(ceil(footprint.x * 2.0), 2.0, 8.0)), footprint.x > 1.05);
  let countY = select(1u, u32(clamp(ceil(footprint.y * 2.0), 2.0, 8.0)), footprint.y > 1.05);
  var accumulated = vec4f(0.0);
  for (var y: u32 = 0u; y < 8u; y += 1u) {
    if (y >= countY) { continue; }
    let offsetY = ((f32(y) + 0.5) / f32(countY) - 0.5) * footprint.y;
    for (var x: u32 = 0u; x < 8u; x += 1u) {
      if (x >= countX) { continue; }
      let offsetX = ((f32(x) + 0.5) / f32(countX) - 0.5) * footprint.x;
      accumulated += textureSampleLevel(
        currentTexture,
        sourceSampler,
        uv + vec2f(offsetX, offsetY) / dimensions,
        0.0,
      );
    }
  }
  return accumulated / f32(countX * countY);
}

fn samplePreviousAdaptiveArea(uv: vec2f, dimensions: vec2f, footprint: vec2f) -> vec4f {
  let countX = select(1u, u32(clamp(ceil(footprint.x * 2.0), 2.0, 8.0)), footprint.x > 1.05);
  let countY = select(1u, u32(clamp(ceil(footprint.y * 2.0), 2.0, 8.0)), footprint.y > 1.05);
  var accumulated = vec4f(0.0);
  for (var y: u32 = 0u; y < 8u; y += 1u) {
    if (y >= countY) { continue; }
    let offsetY = ((f32(y) + 0.5) / f32(countY) - 0.5) * footprint.y;
    for (var x: u32 = 0u; x < 8u; x += 1u) {
      if (x >= countX) { continue; }
      let offsetX = ((f32(x) + 0.5) / f32(countX) - 0.5) * footprint.x;
      accumulated += textureSampleLevel(
        previousTexture,
        sourceSampler,
        uv + vec2f(offsetX, offsetY) / dimensions,
        0.0,
      );
    }
  }
  return accumulated / f32(countX * countY);
}

fn luma(color: vec3f) -> f32 {
  return dot(color, vec3f(0.299, 0.587, 0.114));
}

fn motionError(uv: vec2f, offset: vec2f, texel: vec2f) -> f32 {
  var error = 0.0;
  let taps = array(vec2f(0.0), vec2f(2.0, 0.0), vec2f(-2.0, 0.0), vec2f(0.0, 2.0), vec2f(0.0, -2.0));
  for (var index: u32 = 0u; index < 5u; index += 1u) {
    let previous = textureSampleLevel(previousTexture, sourceSampler, uv + taps[index] * texel, 0.0).rgb;
    let current = textureSampleLevel(currentTexture, sourceSampler, uv + (taps[index] + offset) * texel, 0.0).rgb;
    error += abs(luma(previous) - luma(current));
  }
  return error / 5.0;
}

fn sampleMotionIntermediate(uv: vec2f, factor: f32, dimensions: vec2f) -> vec4f {
  let texel = 1.0 / dimensions;
  var bestOffset = vec2f(0.0);
  var bestError = 1000.0;
  for (var y: i32 = -2; y <= 2; y += 2) {
    for (var x: i32 = -2; x <= 2; x += 2) {
      let candidate = vec2f(f32(x), f32(y));
      let error = motionError(uv, candidate, texel);
      if (error < bestError) {
        bestError = error;
        bestOffset = candidate;
      }
    }
  }
  let motion = bestOffset * texel;
  let previous = textureSampleLevel(previousTexture, sourceSampler, uv - motion * factor, 0.0);
  let current = textureSampleLevel(currentTexture, sourceSampler, uv + motion * (1.0 - factor), 0.0);
  let confidence = 1.0 - smoothstep(0.035, 0.16, bestError);
  return mix(current, mix(previous, current, factor), confidence);
}

@fragment
fn fragmentMain(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dimensions = vec2f(textureDimensions(currentTexture));
  let factor = clamp(interpolationFactor.x, 0.0, 1.0);
  let rawSourcePixelsPerOutput = dimensions * vec2f(abs(dpdx(uv).x), abs(dpdy(uv).y));
  if ((factor <= 0.001 || factor >= 0.999)
      && all(abs(rawSourcePixelsPerOutput - vec2f(1.0)) < vec2f(0.001))) {
    if (factor < 0.5) {
      return textureSampleLevel(previousTexture, sourceSampler, uv, 0.0);
    }
    return textureSampleLevel(currentTexture, sourceSampler, uv, 0.0);
  }
  let sourcePixelsPerOutput = max(
    vec2f(1.0),
    rawSourcePixelsPerOutput,
  );
  if (factor > 0.001 && factor < 0.999) {
    return sampleMotionIntermediate(uv, factor, dimensions);
  }
  if (max(sourcePixelsPerOutput.x, sourcePixelsPerOutput.y) > 1.05) {
    if (factor < 0.5) {
      return samplePreviousAdaptiveArea(uv, dimensions, sourcePixelsPerOutput);
    }
    return sampleCurrentAdaptiveArea(uv, dimensions, sourcePixelsPerOutput);
  }
  if (factor < 0.5) {
    return textureSampleLevel(previousTexture, sourceSampler, uv, 0.0);
  }
  return sampleCurrentCatmullRom(uv, dimensions);
}
`;

const historyCopyWGSL = `
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var targetTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let dimensions = textureDimensions(targetTexture);
  if (id.x >= dimensions.x || id.y >= dimensions.y) { return; }
  textureStore(targetTexture, id.xy, textureLoad(sourceTexture, vec2i(id.xy), 0));
}
`;

const PRESENT_CURRENT_FRAME = new Float32Array([1, 0, 0, 0]);
const PRESENT_PREVIOUS_FRAME = new Float32Array([0, 0, 0, 0]);
const PRESENT_INTERMEDIATE_FRAME = new Float32Array([0.5, 0, 0, 0]);

export interface RendererOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  effects: EnhancementEffect[];
  targetDimensions: Dimensions;
  frameGenerationEnabled: boolean;
  onError?: (error: Error) => void;
  onFirstFrameRendered?: (source: HTMLVideoElement) => void;
  onProgress?: (stage: string | null, current?: number, total?: number) => void;
  onStats?: (stats: RenderStats) => void;
}

export class Renderer {
  private video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private effects: EnhancementEffect[];
  private targetDimensions: Dimensions;
  private frameGenerationEnabled: boolean;
  private readonly onError?: (error: Error) => void;
  private readonly onFirstFrameRendered?: (source: HTMLVideoElement) => void;
  private readonly onProgress?: RendererOptions['onProgress'];
  private readonly onStats?: RendererOptions['onStats'];

  private device!: GPUDevice;
  private anime4kDevice!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;
  private videoFrameTexture!: GPUTexture;
  private pipelines: Anime4KPipeline[] = [];
  private finalTexture!: GPUTexture;
  private renderPipeline!: GPURenderPipeline;
  private renderBindGroup!: GPUBindGroup;
  private renderBindGroupLayout!: GPUBindGroupLayout;
  private historyPresentationBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private historyPresentationIndex = 0;
  private sampler!: GPUSampler;
  private presentationUniform!: GPUBuffer;
  private historyPipeline!: GPUComputePipeline;
  private historyTextures: [GPUTexture, GPUTexture] | null = null;
  private previousHistoryTexture: GPUTexture | null = null;
  private currentHistoryTexture: GPUTexture | null = null;
  private currentHistoryBindGroup: GPUBindGroup | null = null;
  private previousHistoryBindGroup: GPUBindGroup | null = null;
  private historyReady = false;
  private generatedFrameAnimationId: number | null = null;
  private frameGenerationStartedAt = 0;
  private playbackFlushPending = false;
  private pipelineTextures = new Set<GPUTexture>();
  private buildingPipelineTextures: Set<GPUTexture> | null = null;
  private pipelineEffectKey = '';

  private destroyed = false;
  private frameCallbackId: number | null = null;
  private videoSourceRevision = 0;
  private videoFrameHandler: VideoFrameRequestCallback;
  private frameProcessing = false;
  private pendingFrame = false;
  private latestMetadata: VideoFrameCallbackMetadata | null = null;
  private useImageBitmap = false;
  private firstFrameRendered = false;
  private rebuilding = false;
  private recoveryAttempted = false;
  private stateUpdateChain: Promise<void> = Promise.resolve();
  private cleanupScheduled = false;
  private readonly playbackStoppedHandler = () => this.handlePlaybackStopped();

  private renderedSinceSample = 0;
  private statsWindowStarted = performance.now();
  private smoothedRenderMs = 0;
  private droppedFrames = 0;
  private lastStatsEmit = 0;
  private lastCallbackMediaTime: number | null = null;
  private frameBudgetMs = 1000 / 24;
  private overloadedSince: number | null = null;
  private warning = false;

  private constructor(options: RendererOptions) {
    this.video = options.video;
    this.canvas = options.canvas;
    this.effects = options.effects;
    this.targetDimensions = options.targetDimensions;
    this.frameGenerationEnabled = options.frameGenerationEnabled;
    this.onError = options.onError;
    this.onFirstFrameRendered = options.onFirstFrameRendered;
    this.onProgress = options.onProgress;
    this.onStats = options.onStats;
    this.videoFrameHandler = this.createVideoFrameHandler(this.video, this.videoSourceRevision);
    this.video.addEventListener('pause', this.playbackStoppedHandler);
    this.video.addEventListener('ended', this.playbackStoppedHandler);
  }

  public static async create(options: RendererOptions): Promise<Renderer> {
    const renderer = new Renderer(options);
    try {
      await renderer.initialize();
      return renderer;
    } catch (error) {
      renderer.destroy();
      if (error instanceof RendererInitializationError) throw error;
      throw new RendererInitializationError(
        error instanceof Error ? error.message : 'WebGPU renderer initialization failed.',
        { cause: error as Error },
      );
    }
  }

  private async initialize(): Promise<void> {
    if (!navigator.gpu) throw new RendererInitializationError('WebGPU is not available in this browser.');
    if (this.video.readyState < this.video.HAVE_METADATA) {
      await new Promise<void>((resolve, reject) => {
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('The video metadata could not be loaded.')); };
        const cleanup = () => {
          this.video.removeEventListener('loadedmetadata', loaded);
          this.video.removeEventListener('error', failed);
        };
        this.video.addEventListener('loadedmetadata', loaded, { once: true });
        this.video.addEventListener('error', failed, { once: true });
      });
    }

    this.onProgress?.('Initializing WebGPU...');
    await this.createDevice();
    this.context = this.canvas.getContext('webgpu') as unknown as GPUCanvasContext;
    if (!this.context) throw new RendererInitializationError('Could not create a WebGPU canvas context.');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.configureContext();
    this.createSourceTexture();
    await this.buildPipelines();
    await this.createPresentationPipeline();
    this.createPresentationBindGroup();
    this.onProgress?.(null);

    await this.processFrame();
    this.startFrameCallbacks();
  }

  private async createDevice(): Promise<void> {
    let adapter: GPUAdapter | null;
    try {
      // A default request is the most compatible option on Windows. Explicit
      // power preferences can be rejected by fallback/software adapters.
      adapter = await navigator.gpu.requestAdapter();
    } catch (error) {
      throw new RendererInitializationError(
        'WebGPU could not request an adapter. Use the Auto or Native backend when browser hardware acceleration is disabled.',
        { cause: error as Error },
      );
    }
    if (!adapter) {
      throw new RendererInitializationError(
        'No WebGPU adapter was found. Use the Auto or Native backend when browser hardware acceleration is disabled.',
      );
    }

    try {
      // Anime4K only needs the WebGPU default limits. Requesting every maximum
      // reported by the adapter can make requestDevice() fail on fallback and
      // software adapters, especially with browser hardware acceleration off.
      this.device = await adapter.requestDevice();
    } catch (error) {
      throw new RendererInitializationError(
        'WebGPU could not create a device. Use the Auto or Native backend when browser hardware acceleration is disabled.',
        { cause: error as Error },
      );
    }
    this.finishDeviceSetup();
  }

  private finishDeviceSetup(): void {
    this.anime4kDevice = createAnime4KShaderDevice(this.device, texture => {
      this.buildingPipelineTextures?.add(texture);
    });
    this.useImageBitmap = false;
    void this.device.lost.then(info => {
      if (!this.destroyed && info.reason !== 'destroyed') {
        void this.enqueueStateUpdate(() => this.recoverDevice(info.message));
      }
    });
  }

  private configureContext(): void {
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });
  }

  private createSourceTexture(): void {
    this.videoFrameTexture?.destroy();
    this.videoFrameTexture = this.device.createTexture({
      label: 'Anime4K video frame',
      size: [Math.max(1, this.video.videoWidth), Math.max(1, this.video.videoHeight), 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING
        | GPUTextureUsage.COPY_DST
        | GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  private async buildPipelines(): Promise<void> {
    const scheduled = scheduleEffectsForTarget(
      this.effects,
      { width: this.video.videoWidth, height: this.video.videoHeight },
      this.targetDimensions,
    );
    this.onProgress?.('Compiling enhancement shaders...', 0, scheduled.effects.length);
    const pipelines: Anime4KPipeline[] = [];
    const pipelineTextures = new Set<GPUTexture>();
    let currentTexture = this.videoFrameTexture;
    let width = this.video.videoWidth;
    let height = this.video.videoHeight;

    this.buildingPipelineTextures = pipelineTextures;
    try {
      for (let index = 0; index < scheduled.effects.length; index += 1) {
        const effect = scheduled.effects[index];
        this.onProgress?.(`Compiling ${effect.name}...`, index + 1, scheduled.effects.length);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        if (this.destroyed) throw new Error('Renderer was destroyed while compiling enhancement shaders.');
        const Constructor = await loadPipelineConstructor(effect.className);
        if (!Constructor) {
          throw new RendererInitializationError(`Exact WebGPU kernel ${effect.className} is unavailable.`);
        }
        const pipeline = new Constructor({
          device: this.anime4kDevice,
          inputTexture: currentTexture,
          nativeDimensions: { width, height },
          targetDimensions: this.targetDimensions,
        });
        pipelines.push(pipeline);
        currentTexture = pipeline.getOutputTexture();
        width *= effect.upscaleFactor ?? 1;
        height *= effect.upscaleFactor ?? 1;
      }
    } catch (error) {
      this.destroyPipelineTextures(pipelineTextures);
      throw error;
    } finally {
      this.buildingPipelineTextures = null;
    }

    this.destroyPipelineTextures(this.pipelineTextures);
    this.pipelineTextures = pipelineTextures;
    this.pipelines = pipelines;
    this.finalTexture = currentTexture;
    this.pipelineEffectKey = scheduledEffectPipelineKey(
      this.effects,
      { width: this.video.videoWidth, height: this.video.videoHeight },
      this.targetDimensions,
    );
  }

  private destroyPipelineTextures(textures: Set<GPUTexture>): void {
    for (const texture of textures) {
      try {
        texture.destroy();
      } catch {
        // A lost/destroyed device may already have released this allocation.
      }
    }
    textures.clear();
  }

  private async createPresentationPipeline(): Promise<void> {
    this.renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });
    this.renderPipeline = await this.device.createRenderPipelineAsync({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.renderBindGroupLayout] }),
      vertex: {
        module: this.device.createShaderModule({ code: fullscreenQuadWGSL }),
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: this.device.createShaderModule({ code: adaptivePresentationWGSL }),
        entryPoint: 'fragmentMain',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
    });
    this.sampler = this.device.createSampler({
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      minFilter: 'linear',
      magFilter: 'linear',
    });
    this.presentationUniform?.destroy();
    this.presentationUniform = this.device.createBuffer({
      label: 'Frame interpolation factor',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.historyPipeline = await this.device.createComputePipelineAsync({
      label: 'Frame generation history copy',
      layout: 'auto',
      compute: { module: this.device.createShaderModule({ code: historyCopyWGSL }), entryPoint: 'main' },
    });
    this.createHistoryResources();
  }

  private createPresentationBinding(previous: GPUTexture, current: GPUTexture): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: previous.createView() },
        { binding: 2, resource: current.createView() },
        { binding: 3, resource: { buffer: this.presentationUniform } },
      ],
    });
  }

  private createPresentationBindGroup(): void {
    if (this.frameGenerationEnabled && this.historyPresentationBindGroups) {
      this.renderBindGroup = this.historyPresentationBindGroups[this.historyPresentationIndex];
      return;
    }
    this.renderBindGroup = this.createPresentationBinding(this.finalTexture, this.finalTexture);
  }

  private destroyHistoryResources(): void {
    this.stopGeneratedFrameAnimation();
    this.historyTextures?.forEach(texture => texture.destroy());
    this.historyTextures = null;
    this.previousHistoryTexture = null;
    this.currentHistoryTexture = null;
    this.previousHistoryBindGroup = null;
    this.currentHistoryBindGroup = null;
    this.historyPresentationBindGroups = null;
    this.historyPresentationIndex = 0;
    this.historyReady = false;
  }

  private createHistoryResources(): void {
    this.destroyHistoryResources();
    if (!this.frameGenerationEnabled || !this.historyPipeline || !this.finalTexture) return;
    const descriptor: GPUTextureDescriptor = {
      label: 'Frame generation history',
      size: [this.finalTexture.width, this.finalTexture.height, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    };
    this.historyTextures = [this.device.createTexture(descriptor), this.device.createTexture(descriptor)];
    [this.previousHistoryTexture, this.currentHistoryTexture] = this.historyTextures;
    const layout = this.historyPipeline.getBindGroupLayout(0);
    this.previousHistoryBindGroup = this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: this.finalTexture.createView() },
        { binding: 1, resource: this.previousHistoryTexture.createView() },
      ],
    });
    this.currentHistoryBindGroup = this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: this.finalTexture.createView() },
        { binding: 1, resource: this.currentHistoryTexture.createView() },
      ],
    });
    this.historyPresentationBindGroups = [
      this.createPresentationBinding(this.historyTextures[0], this.historyTextures[1]),
      this.createPresentationBinding(this.historyTextures[1], this.historyTextures[0]),
    ];
  }

  private isSecurityError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'SecurityError'
      || error instanceof Error && (
        error.name === 'SecurityError'
        || /cross-origin|tainted|protected content/i.test(error.message)
      );
  }

  private async copyCurrentVideoFrame(): Promise<void> {
    const size: GPUExtent3D = [this.video.videoWidth, this.video.videoHeight, 1];
    if (this.useImageBitmap) {
      const bitmap = await createImageBitmap(this.video);
      try {
        this.device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: this.videoFrameTexture }, size);
      } finally {
        bitmap.close();
      }
      return;
    }

    try {
      this.device.queue.copyExternalImageToTexture({ source: this.video }, { texture: this.videoFrameTexture }, size);
    } catch (error) {
      if (this.isSecurityError(error)) throw error;
      const bitmap = await createImageBitmap(this.video);
      try {
        this.device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: this.videoFrameTexture }, size);
        this.useImageBitmap = true;
      } finally {
        bitmap.close();
      }
    }
  }

  private encodeHistoryCopy(encoder: GPUCommandEncoder, bindGroup: GPUBindGroup): void {
    const pass = encoder.beginComputePass({ label: 'Frame generation history copy' });
    pass.setPipeline(this.historyPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(this.finalTexture.width / 8),
      Math.ceil(this.finalTexture.height / 8),
    );
    pass.end();
  }

  private prepareFrameGenerationHistory(encoder: GPUCommandEncoder): boolean {
    if (!this.frameGenerationEnabled || !this.previousHistoryBindGroup || !this.currentHistoryBindGroup) {
      this.device.queue.writeBuffer(this.presentationUniform, 0, PRESENT_CURRENT_FRAME);
      return false;
    }
    this.stopGeneratedFrameAnimation();
    if (!this.historyReady) {
      this.encodeHistoryCopy(encoder, this.previousHistoryBindGroup);
      this.encodeHistoryCopy(encoder, this.currentHistoryBindGroup);
      this.historyReady = true;
      this.device.queue.writeBuffer(this.presentationUniform, 0, PRESENT_CURRENT_FRAME);
      return false;
    }

    [this.previousHistoryTexture, this.currentHistoryTexture] = [
      this.currentHistoryTexture,
      this.previousHistoryTexture,
    ];
    [this.previousHistoryBindGroup, this.currentHistoryBindGroup] = [
      this.currentHistoryBindGroup,
      this.previousHistoryBindGroup,
    ];
    this.encodeHistoryCopy(encoder, this.currentHistoryBindGroup);
    this.historyPresentationIndex = this.historyPresentationIndex === 0 ? 1 : 0;
    this.createPresentationBindGroup();
    this.device.queue.writeBuffer(this.presentationUniform, 0, PRESENT_PREVIOUS_FRAME);
    return true;
  }

  private encodePresentation(encoder: GPUCommandEncoder): void {
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.draw(6);
    renderPass.end();
  }

  private renderHistoryFrame(factor: Float32Array, label: string): void {
    if (this.destroyed || !this.frameGenerationEnabled || !this.historyReady || this.rebuilding) return;
    this.device.queue.writeBuffer(this.presentationUniform, 0, factor);
    const encoder = this.device.createCommandEncoder({ label });
    this.encodePresentation(encoder);
    this.device.queue.submit([encoder.finish()]);
  }

  private renderGeneratedIntermediate(): void {
    this.renderHistoryFrame(PRESENT_INTERMEDIATE_FRAME, 'Generated intermediate frame');
  }

  private handlePlaybackStopped(): void {
    this.stopGeneratedFrameAnimation();
    this.playbackFlushPending = true;
    this.flushStoppedPlayback();
  }

  private flushStoppedPlayback(): void {
    if (!this.playbackFlushPending) return;
    if (!this.video.paused && !this.video.ended) {
      this.playbackFlushPending = false;
      return;
    }
    if (this.destroyed || !this.frameGenerationEnabled || !this.historyReady) {
      this.playbackFlushPending = false;
      return;
    }
    if (this.frameProcessing || this.rebuilding) return;
    this.playbackFlushPending = false;
    this.renderHistoryFrame(PRESENT_CURRENT_FRAME, 'Frame generation pause flush');
  }

  private scheduleGeneratedFrame(): void {
    if (!this.frameGenerationEnabled || this.destroyed || this.video.paused || this.video.ended) return;
    this.frameGenerationStartedAt = performance.now();
    const tick = (now: number) => {
      this.generatedFrameAnimationId = null;
      if (this.destroyed || !this.frameGenerationEnabled || this.rebuilding) return;
      if (this.video.paused || this.video.ended) {
        this.handlePlaybackStopped();
        return;
      }
      if (now - this.frameGenerationStartedAt >= this.frameBudgetMs * 0.5) {
        this.renderGeneratedIntermediate();
        return;
      }
      this.generatedFrameAnimationId = requestAnimationFrame(tick);
    };
    this.generatedFrameAnimationId = requestAnimationFrame(tick);
  }

  private stopGeneratedFrameAnimation(): void {
    if (this.generatedFrameAnimationId !== null) {
      cancelAnimationFrame(this.generatedFrameAnimationId);
      this.generatedFrameAnimationId = null;
    }
  }

  private async processFrame(): Promise<boolean> {
    if (this.destroyed || this.rebuilding || this.video.readyState < this.video.HAVE_CURRENT_DATA) return false;
    if (this.video.videoWidth !== this.videoFrameTexture.width
      || this.video.videoHeight !== this.videoFrameTexture.height) {
      await this.rebuildForSourceResize();
      return false;
    }

    const started = performance.now();
    await this.copyCurrentVideoFrame();
    if (this.destroyed) return false;
    const encoder = this.device.createCommandEncoder({ label: 'Anime4K frame' });
    this.pipelines.forEach(pipeline => pipeline.pass(encoder));
    const generateIntermediate = this.prepareFrameGenerationHistory(encoder);
    this.encodePresentation(encoder);
    this.device.queue.submit([encoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    if (this.destroyed) return false;
    if (generateIntermediate) this.scheduleGeneratedFrame();

    const renderMs = performance.now() - started;
    this.recordStats(renderMs);
    if (!this.firstFrameRendered) {
      this.firstFrameRendered = true;
      this.onFirstFrameRendered?.(this.video);
    }
    return true;
  }

  private recordStats(renderMs: number): void {
    const now = performance.now();
    this.smoothedRenderMs = this.smoothedRenderMs === 0
      ? renderMs
      : this.smoothedRenderMs * 0.8 + renderMs * 0.2;
    this.renderedSinceSample += 1;

    if (this.smoothedRenderMs > this.frameBudgetMs) {
      if (this.overloadedSince === null) this.overloadedSince = now;
      if (now - this.overloadedSince >= 2000) this.warning = true;
    } else {
      this.overloadedSince = null;
      this.warning = false;
    }

    if (now - this.lastStatsEmit >= 500) {
      const elapsed = Math.max(1, now - this.statsWindowStarted);
      this.onStats?.({
        fps: this.renderedSinceSample * 1000 / elapsed,
        renderMs: this.smoothedRenderMs,
        droppedFrames: this.droppedFrames,
        warning: this.warning,
      });
      this.lastStatsEmit = now;
      this.statsWindowStarted = now;
      this.renderedSinceSample = 0;
    }
  }

  private startFrameCallbacks(): void {
    if (this.destroyed || this.frameCallbackId !== null) return;
    this.frameCallbackId = this.video.requestVideoFrameCallback(this.videoFrameHandler);
  }

  private stopFrameCallbacks(): void {
    if (this.frameCallbackId !== null) {
      this.video.cancelVideoFrameCallback(this.frameCallbackId);
      this.frameCallbackId = null;
    }
    this.pendingFrame = false;
    this.latestMetadata = null;
  }

  private createVideoFrameHandler(
    source: HTMLVideoElement,
    revision: number,
  ): VideoFrameRequestCallback {
    return (now, metadata) => this.handleVideoFrame(source, revision, now, metadata);
  }

  private handleVideoFrame(
    source: HTMLVideoElement,
    revision: number,
    _now: DOMHighResTimeStamp,
    metadata: VideoFrameCallbackMetadata,
  ): void {
    // cancelVideoFrameCallback cannot retract a callback that the browser has
    // already queued. Keep callbacks scoped to the video that scheduled them.
    if (this.destroyed || revision !== this.videoSourceRevision || source !== this.video) return;
    this.frameCallbackId = null;
    this.startFrameCallbacks();
    // A pause event may run after the browser queued this callback. Mark the
    // real frame for a final current-frame presentation, but still process it:
    // browsers also deliver legitimate rVFCs while scrubbing a paused video.
    if (this.video.paused || this.video.ended) {
      this.stopGeneratedFrameAnimation();
      this.playbackFlushPending = true;
    }
    if (this.lastCallbackMediaTime !== null && metadata.mediaTime > this.lastCallbackMediaTime) {
      const interval = (metadata.mediaTime - this.lastCallbackMediaTime) * 1000;
      if (interval <= 200) this.frameBudgetMs = Math.min(100, Math.max(8, interval));
    }
    this.lastCallbackMediaTime = metadata.mediaTime;
    if (this.frameProcessing || this.rebuilding) {
      if (this.pendingFrame) this.droppedFrames += 1;
      this.pendingFrame = true;
      this.latestMetadata = metadata;
      return;
    }
    void this.drainFrames(metadata);
  }

  private async drainFrames(initial: VideoFrameCallbackMetadata): Promise<void> {
    this.frameProcessing = true;
    let metadata: VideoFrameCallbackMetadata | null = initial;
    try {
      while (metadata && !this.destroyed) {
        this.pendingFrame = false;
        this.latestMetadata = null;
        await this.processFrame();
        metadata = this.pendingFrame ? this.latestMetadata : null;
      }
    } catch (error) {
      if (this.destroyed) return;
      const runtimeError = new RendererRuntimeError(
        error instanceof Error ? `Frame import or rendering failed: ${error.message}` : 'Frame rendering failed.',
        { cause: error as Error },
      );
      this.stopFrameCallbacks();
      this.onError?.(runtimeError);
    } finally {
      this.frameProcessing = false;
      this.flushStoppedPlayback();
    }
  }

  private takePendingFrame(): VideoFrameCallbackMetadata | null {
    if (!this.pendingFrame || !this.latestMetadata) return null;
    const metadata = this.latestMetadata;
    this.pendingFrame = false;
    this.latestMetadata = null;
    return metadata;
  }

  private async waitForFrameIdle(): Promise<void> {
    while (this.frameProcessing) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  private enqueueStateUpdate(operation: () => Promise<void>): Promise<void> {
    const result = this.stateUpdateChain.then(operation, operation);
    this.stateUpdateChain = result.catch(() => undefined);
    return result;
  }

  private async rebuildForSourceResize(): Promise<void> {
    if (this.rebuilding || this.destroyed) return;
    this.rebuilding = true;
    try {
      await this.device.queue.onSubmittedWorkDone();
      if (this.destroyed) return;
      this.createSourceTexture();
      await this.buildPipelines();
      this.createHistoryResources();
      this.createPresentationBindGroup();
    } finally {
      this.rebuilding = false;
      this.flushStoppedPlayback();
    }
  }

  public updateConfiguration(options: {
    effects: EnhancementEffect[];
    targetDimensions: Dimensions;
    frameGenerationEnabled: boolean;
  }): Promise<void> {
    return this.enqueueStateUpdate(() => this.applyConfiguration(options));
  }

  private async applyConfiguration(options: {
    effects: EnhancementEffect[];
    targetDimensions: Dimensions;
    frameGenerationEnabled: boolean;
  }): Promise<void> {
    if (this.destroyed) return;
    const unchanged = JSON.stringify(this.effects) === JSON.stringify(options.effects)
      && this.targetDimensions.width === options.targetDimensions.width
      && this.targetDimensions.height === options.targetDimensions.height
      && this.frameGenerationEnabled === options.frameGenerationEnabled;
    if (unchanged) return;

    this.stopFrameCallbacks();
    await this.waitForFrameIdle();
    if (this.destroyed) return;
    const previousEffects = this.effects;
    const previousTargetDimensions = this.targetDimensions;
    const previousFrameGenerationEnabled = this.frameGenerationEnabled;
    let gpuStateChanged = false;
    let configurationCommitted = false;
    let postConfigurationError: RendererRuntimeError | null = null;
    this.rebuilding = true;
    try {
      const nextPipelineEffectKey = scheduledEffectPipelineKey(
        options.effects,
        { width: this.video.videoWidth, height: this.video.videoHeight },
        options.targetDimensions,
      );
      this.effects = options.effects;
      this.targetDimensions = options.targetDimensions;
      const frameGenerationChanged = this.frameGenerationEnabled !== options.frameGenerationEnabled;
      this.frameGenerationEnabled = options.frameGenerationEnabled;
      if (nextPipelineEffectKey !== this.pipelineEffectKey) {
        await this.device.queue.onSubmittedWorkDone();
        await this.buildPipelines();
        gpuStateChanged = true;
        this.createHistoryResources();
        this.createPresentationBindGroup();
      } else if (frameGenerationChanged) {
        await this.device.queue.onSubmittedWorkDone();
        gpuStateChanged = true;
        this.createHistoryResources();
        this.createPresentationBindGroup();
      }
      this.canvas.width = options.targetDimensions.width;
      this.canvas.height = options.targetDimensions.height;
      configurationCommitted = true;
    } catch (error) {
      this.effects = previousEffects;
      this.targetDimensions = previousTargetDimensions;
      this.frameGenerationEnabled = previousFrameGenerationEnabled;
      // buildPipelines commits atomically, so a compile failure leaves the old
      // renderer usable. Once GPU resources were swapped, a partial rollback
      // would pair stale state with new/destroyed textures; fail closed instead.
      if (gpuStateChanged) this.destroy();
      throw error;
    } finally {
      this.rebuilding = false;
      const pendingMetadata = this.takePendingFrame();
      if (configurationCommitted && !this.destroyed) {
        // Resizing a canvas clears it, and a paused video may not produce
        // another callback. Re-present the new configuration immediately.
        this.firstFrameRendered = false;
        if (pendingMetadata) {
          await this.drainFrames(pendingMetadata);
        } else {
          // A callback cancelled before compilation may already be queued and
          // can re-arm itself. Hold the processing lock across this immediate
          // render so such a callback is coalesced instead of running a second
          // GPU submission concurrently.
          this.frameProcessing = true;
          try {
            await this.processFrame();
          } catch (error) {
            this.destroy();
            postConfigurationError = new RendererRuntimeError('Rendering the updated configuration failed.', {
              cause: error as Error,
            });
          } finally {
            this.frameProcessing = false;
          }
          const followUpMetadata = this.takePendingFrame();
          if (followUpMetadata && !this.destroyed) await this.drainFrames(followUpMetadata);
        }
      } else if (pendingMetadata && !this.destroyed) {
        // A paused seek can queue its only callback while compilation is in
        // progress. Drain it even when compilation failed and the old pipeline
        // remains active; waiting for another callback could freeze the frame.
        await this.drainFrames(pendingMetadata);
      }
      this.flushStoppedPlayback();
      this.startFrameCallbacks();
    }
    if (postConfigurationError) throw postConfigurationError;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public hasRenderedCurrentSource(): boolean {
    return this.firstFrameRendered;
  }

  public updateVideoSource(newVideo: HTMLVideoElement): Promise<void> {
    return this.enqueueStateUpdate(() => this.applyVideoSource(newVideo));
  }

  private async applyVideoSource(newVideo: HTMLVideoElement): Promise<void> {
    if (this.destroyed) return;
    // Invalidate the current handler before yielding. A callback that was
    // already queued can otherwise re-arm the old video while we wait for an
    // in-flight frame to finish and occupy frameCallbackId indefinitely.
    this.videoSourceRevision += 1;
    this.stopFrameCallbacks();
    await this.waitForFrameIdle();
    if (this.destroyed) return;
    this.video.removeEventListener('pause', this.playbackStoppedHandler);
    this.video.removeEventListener('ended', this.playbackStoppedHandler);
    this.video = newVideo;
    this.videoFrameHandler = this.createVideoFrameHandler(this.video, this.videoSourceRevision);
    this.video.addEventListener('pause', this.playbackStoppedHandler);
    this.video.addEventListener('ended', this.playbackStoppedHandler);
    this.useImageBitmap = false;
    this.firstFrameRendered = false;
    this.lastCallbackMediaTime = null;
    this.frameBudgetMs = 1000 / 24;
    await this.rebuildForSourceResize();
    await this.processFrame();
    this.startFrameCallbacks();
  }

  private async recoverDevice(message: string): Promise<void> {
    if (this.destroyed || this.recoveryAttempted) {
      if (!this.destroyed) this.onError?.(new RendererRuntimeError(`WebGPU device lost: ${message}`));
      return;
    }
    this.recoveryAttempted = true;
    this.stopFrameCallbacks();
    await this.waitForFrameIdle();
    if (this.destroyed) return;
    try {
      await this.createDevice();
      this.configureContext();
      this.createSourceTexture();
      await this.buildPipelines();
      await this.createPresentationPipeline();
      this.createPresentationBindGroup();
      this.startFrameCallbacks();
    } catch (error) {
      this.onError?.(new RendererRuntimeError('WebGPU device recovery failed.', { cause: error as Error }));
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.video.removeEventListener('pause', this.playbackStoppedHandler);
    this.video.removeEventListener('ended', this.playbackStoppedHandler);
    this.stopFrameCallbacks();
    this.stopGeneratedFrameAnimation();
    this.playbackFlushPending = false;
    if (this.cleanupScheduled) return;
    this.cleanupScheduled = true;
    void this.waitForFrameIdle().then(() => this.releaseResources());
  }

  private releaseResources(): void {
    try {
      this.destroyHistoryResources();
      this.destroyPipelineTextures(this.pipelineTextures);
      if (this.buildingPipelineTextures) this.destroyPipelineTextures(this.buildingPipelineTextures);
      this.videoFrameTexture?.destroy();
      this.presentationUniform?.destroy();
      this.context?.unconfigure();
      this.device?.destroy();
    } catch (error) {
      console.warn('[Anime4K] Renderer cleanup failed:', error);
    }
    this.pipelines = [];
  }
}
