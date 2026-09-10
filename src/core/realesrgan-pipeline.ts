/**
 * RealESRGAN ONNX inference pipeline.
 *
 * Bridges the synchronous `Anime4KPipeline.pass(encoder)` contract with the
 * asynchronous ONNX inference path. Each frame, `pass()` encodes a GPU
 * readback of the input texture into a staging buffer. After the renderer
 * submits, the staging buffer is mapped, the frame runs through the ONNX
 * model, and the composed 4x result is written back into a stable output
 * texture that the presentation pass samples.
 *
 * Inference offload: when the worker client is available the WHOLE frame is
 * handed to the worker (tile planning, batched inference, feathered
 * composition and RGBA8 packing all run there - the GPU path keeps tensors on
 * the worker's WebGPU device end to end). The main-thread session is the
 * fallback and composes with the in-process GPU/CPU composers.
 *
 * Pacing is latest-frame-wins: while an inference is in flight, newly
 * arriving frames are skipped and the last completed result keeps being
 * presented. When inference finishes, its result is dropped if a newer frame
 * has already arrived.
 *
 * Optional `params.maxInferenceHeight` caps the resolution fed into the
 * network: the input is downscaled on the GPU (single bilinear pass) before
 * readback, so inference cost scales with the cap instead of the source
 * resolution. The presentation pass upsamples the smaller result to the
 * canvas with its adaptive area sampler.
 */
import type { InferenceSession } from 'onnxruntime-web';
import type { RealEsrganPhaseStats, RealEsrganPrecision } from '../types';
import { RealEsrganBufferPool } from '../shared/realesrgan-buffer-pool';
import { RealEsrganFrameScheduler } from '../shared/realesrgan-pacing';
import { planReadback, type ReadbackFormat } from '../shared/realesrgan-readback';
import { LetterboxTracker } from '../shared/realesrgan-letterbox';
import { StillframeTracker } from '../shared/realesrgan-stillframe';
import {
  colorDiagStatsFromPlanar,
  colorDiagStatsFromRgba,
  formatColorDiag,
} from '../shared/realesrgan-color-diagnostic';
import { formatRealEsrganError, REALESRGAN_ERROR_CODES } from '../shared/realesrgan-error-codes';
import { RealEsrganGpuComposer } from './realesrgan-compose';
import { RealEsrganOutputWriter, FATAL_INFERENCE_FAILURES } from './realesrgan-output-writer';
import { RealEsrganStagingSlots, type RealEsrganStagingClaim } from './realesrgan-staging-slots';
import type { RealEsrganInferenceRunner, RealEsrganFrameResult } from './realesrgan-worker-client';
import type { RealEsrganModelAssets } from './realesrgan-model-assets';
import { RealEsrganFrameJobRunner } from './realesrgan-frame-job';
import type { RealEsrganExecutionConfig } from './realesrgan-session';
import { RealEsrganRunnerGuard } from './realesrgan-runner-guard';
import { RealEsrganInferenceCoordinator } from './realesrgan-inference-coordinator';
import { RealEsrganDrainProcessor } from './realesrgan-drain-processor';
import type { Anime4KPipeline, PipelineConstructor, PipelineGpuDevice } from './pipeline-types';

export interface RealEsrganTilingConfig {
  maxTileSize: number;
  overlap: number;
  singleTileMaxHeight: number;
}

export const DEFAULT_REALESRGAN_TILING: RealEsrganTilingConfig = {
  maxTileSize: 512,
  // 24px is what adaptiveRealEsrganTiling() computes for both geometries
  // (min(24, maxTileSize/16)); the worker plans with the same value, so both
  // paths place tiles and feather identically. singleTileMaxHeight stays 512
  // deliberately: this config feeds the MAIN-THREAD fallback path (weakest
  // devices, no E2E for larger single transients), while the worker takes
  // Hebel 1.2's bounded 576 gate via singleTileMaxHeightForFrame().
  overlap: 24,
  singleTileMaxHeight: 512,
};

/**
 * Hard ceiling for the per-pipeline scratch-buffer pool. The per-size cap
 * alone is unbounded across the many distinct geometries a long session can
 * see (crop rectangles, upload row padding); this keeps the pool from
 * pinning every buffer it ever touched while still caching the large
 * per-frame buffers the hot path reuses. 512 MiB covers one full accumulator
 * plus the input/readback/weight buffers at 1080p.
 */
const POOL_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

/**
 * Compartment-safe error text: Firefox throws "Permission denied to access
 * property constructor" when `instanceof` touches a cross-compartment/Xray
 * error object, which would mask the original failure. Never let the
 * introspection itself throw.
 */
function errorMessage(error: unknown): string {
  // NOTE: no `instanceof` anywhere here on purpose. A foreign-compartment
  // Error fails `instanceof Error` (different Error class) and an Xray
  // wrapper throws on the constructor lookup, both masking the real failure.
  try {
    const message = (error as { message?: unknown })?.message;
    if (typeof message === 'string' && message) return message;
  } catch { /* cross-compartment: fall through to String() */ }
  try {
    return String(error);
  } catch {
    return '<unreadable cross-compartment error>';
  }
}

/** Best-effort stack for live diagnosis; never throws (see errorMessage). */
function errorStack(error: unknown): string {
  try {
    const stack = (error as { stack?: unknown })?.stack;
    if (typeof stack === 'string' && stack) return `\n${stack}`;
  } catch { /* cross-compartment: no stack */ }
  return '';
}

const downscaleWGSL = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
  const positions = array(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0)
  );
  const uvs = array(
    vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0),
    vec2f(1.0, 0.0), vec2f(0.0, 0.0), vec2f(1.0, 1.0)
  );
  var output: VertexOutput;
  output.position = vec4f(positions[index], 0.0, 1.0);
  output.uv = uvs[index];
  return output;
}

@group(0) @binding(0) var sourceSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;

@fragment
fn fragmentMain(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(sourceTexture, sourceSampler, uv);
}
`;

interface PipelineDescriptor {
  device: PipelineGpuDevice;
  inputTexture: GPUTexture;
  nativeDimensions?: { width: number; height: number };
  targetDimensions?: { width: number; height: number };
  params?: { [key: string]: unknown };
  /** Recovery hook: fired once when a WebGPU op fails with "Context lost". */
  onDeviceContextLost?: () => void;
  /**
   * Fatal hook: fired once when inference has failed repeatedly without a
   * single successful result. The renderer surfaces it as a runtime error so
   * the configured fallback (native path / plain video) takes over.
   */
  onFatalInferenceFailure?: () => void;
}

function isReadbackFormat(format: GPUTextureFormat): format is ReadbackFormat {
  return format === 'rgba8unorm' || format === 'rgba16float';
}

function parseMaxInferenceHeight(params: { [key: string]: unknown } | undefined): number | null {
  const value = params?.maxInferenceHeight;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

/**
 * Transport-downscale capability, read from the explicit adapter identity
 * (see RealEsrganInferenceRunner.kind) instead of the legacy
 * `supportsTargetDownscale` rendering flag. The native Vulkan host is the
 * only adapter that box-averages its result down to the requested
 * targetWidth/targetHeight before returning; the ORT worker and the
 * main-thread session ignore the target, so their output stays full 4x.
 */
function runnerSupportsTargetDownscale(runner: RealEsrganInferenceRunner | null | undefined): boolean {
  return runner?.kind === 'native';
}

/**
 * Runner offload binding: a live Runner (native Vulkan host or ORT worker —
 * chosen by the Runner-Broker) plus the Modell-Auswahl that decides which
 * model asset serves each frame. The binding never mixes runner identity
 * with asset knowledge: the runner interface stays model-agnostic and the
 * assets module owns resolution/verification/per-frame pick.
 */
export interface RealEsrganRunnerBinding {
  runner: RealEsrganInferenceRunner;
  modelAssets: RealEsrganModelAssets;
  /**
   * Runner-Guard escalation: the guard's "runner dead" verdict is global
   * (runners are process-lifetime singletons shared across pipelines), so
   * the loader wires this to the broker to drop the cached runner — the
   * next resolveRunner() re-runs the preference order instead of re-serving
   * the runner the guard just buried.
   */
  onRunnerDead?: (runner: RealEsrganInferenceRunner) => unknown;
}

export function createRealEsrganPipelineClass(
  binding: RealEsrganRunnerBinding | null = null,
  getSession: ((width: number, height: number) => Promise<InferenceSession>) | null = null,
  execution: RealEsrganExecutionConfig | null = null,
): PipelineConstructor {
  return class RealEsrganPipeline implements Anime4KPipeline {
    // Declared capabilities: the renderer's capability accessors trust this
    // instead of probing each method. RealESRGAN offers every optional member.
    public readonly capabilities = {
      afterSubmit: true,
      outputDimensions: true,
      phaseStats: true,
      skippedFrames: true,
    } as const;
    private readonly device: PipelineGpuDevice;
    private readonly inputTexture: GPUTexture;
    private readonly outputTexture: GPUTexture;
    private readonly stagingSlots: RealEsrganStagingSlots;
    // Eight staging slots match the native runner's maxInFlight (depth 8):
    // frames arrive in groups of ~10 every ~530 ms (headless rVFC batching)
    // and depth 4 refused 60% of each group (depth 12 measured identical
    // to 8 — arrival-bound). Worker/main-thread paths stay at depth 1 via
    // their own maxInFlight (see inferenceDepth).
    private readonly stagingBufferCount = 8;
    private readonly readbackFormat: ReadbackFormat;
    private readonly readbackBytesPerRow: number;
    private readonly readbackByteLength: number;
    // The claim is the frame job's capture handle: pass() encodes into it,
    // afterSubmit() hands it through, drain() releases it.
    private readonly frameJobs = new RealEsrganFrameJobRunner<RealEsrganStagingClaim, void>(
      new RealEsrganFrameScheduler(),
    );
    // Broker escalation hook (see RealEsrganRunnerBinding.onRunnerDead).
    // Assigned in the constructor; the guard callback reads it at call time.
    private onRunnerDead: ((runner: RealEsrganInferenceRunner) => unknown) | null = null;
    // Inference orchestration (runner wrappers, fallback session cache,
    // build/run timeouts, lazy ORT import). Wired in the constructor; the
    // guard's warmFallback and the constructor warmup both await it.
    private inference!: RealEsrganInferenceCoordinator;
    // Per-frame drain orchestration (map→unpack→crop→still→path→present).
    // Wired in the constructor over the narrow RealEsrganDrainHost seam.
    private drainProcessor!: RealEsrganDrainProcessor;
    // Full-frame scratch buffers are pooled: at 1080p the accumulator alone is
    // ~100 MB, and re-allocating it every processed frame hammers the GC.
    // Dimensions are fixed per pipeline instance, so the pool hits every frame
    // after the first. Tile extraction buffers stay fresh on purpose: they are
    // handed to the ONNX runtime as tensor backing and may still be read
    // asynchronously after run() resolves.
    private readonly pool = new RealEsrganBufferPool(2, POOL_MAX_TOTAL_BYTES);
    private readonly inputWidth: number;
    private readonly inputHeight: number;
    // Inference runs on these dimensions. Equal to the input unless a
    // maxInferenceHeight cap forced a GPU downscale.
    private readonly inferenceWidth: number;
    private readonly inferenceHeight: number;
    // Output texture dimensions (p8: target-sized when the runner supports
    // transport downscaling, otherwise the full 4x frame).
    private readonly outputWidth: number;
    private readonly outputHeight: number;
    // tw/th sent to the host (0 = legacy full-4x frames).
    private readonly transportTargetWidth: number;
    private readonly transportTargetHeight: number;
    private readonly downscaleTexture: GPUTexture | null = null;
    private readonly downscalePipeline: GPURenderPipeline | null = null;
    private readonly downscaleBindGroup: GPUBindGroup | null = null;
    // Shared bind-group layout (sampler + texture) for the downscale and the
    // output-prime passes.
    private readonly downscaleBindGroupLayout: GPUBindGroupLayout;
    // Black-frame guard: one bilinear upscale pass that primes the output
    // texture with the source frame (see primeOutputTexture).
    private readonly primePipeline: GPURenderPipeline;
    private readonly primeBindGroup: GPUBindGroup;
    // All output-texture writes (prime, RGBA/planar results, crop paste, bar
    // fill, stretch fallbacks) and the GPU composer live in this module; the
    // pipeline stays the coordinator that decides WHAT to write.
    private readonly outputWriter: RealEsrganOutputWriter;
    private colorDiagDone = false;
    private colorDiagOutputDone = false;
    // Set once ANY inference result was written to the output texture; the
    // prime pass stops refreshing after that point.
    private firstResultLanded = false;
    // Runner offload (native Vulkan host or ORT worker); null on Firefox
    // when the worker file is missing or no runner could start. Mutable so
    // a broken runner can be disabled at runtime, falling back to the
    // main-thread session for good (same pattern as gpuComposer).
    private runner: RealEsrganInferenceRunner | null;
    private readonly modelAssets: RealEsrganModelAssets | null;
    // Failover policy (retry budget, disable, fallback warmup) lives in the
    // guard module; the callbacks below keep the pipeline's log lines and
    // detach the dead runner. Test the policy through the guard, not
    // through a GPU-constructed pipeline.
    private readonly runnerGuard = new RealEsrganRunnerGuard({
      onTimeout: (attempt, max, error) => {
        console.warn(formatRealEsrganError(REALESRGAN_ERROR_CODES.WORKER_TIMEOUT,
          `runner inference timed out (${attempt}/${max}); retrying runner next frame`),
          error,
        );
      },
      onRunnerDead: async error => {
        // Teardown errors must not escape the dying pipeline: a destroyed
        // instance detaches silently instead of logging fatal codes, warming
        // sessions, or parking the broker's shared runner for live pipelines
        // (E2E: auto-cap rebuilds killed the shared native client for 30 s
        // and failed the verdict with another pipeline's death rattle).
        if (this.destroyed) {
          this.runner = null;
          return;
        }
        console.warn(formatRealEsrganError(REALESRGAN_ERROR_CODES.WORKER_FAILED,
          'runner inference failed; disabling runner, main-thread session takes over'), error);
        const dead = this.runner;
        this.runner = null;
        // The runner is a shared singleton: escalate so the broker drops it
        // and the next pipeline build re-resolves instead of re-serving a
        // runner the guard just declared dead. Awaited: markRunnerDead
        // compares cached promises asynchronously, and a fire-and-forget
        // escalation lets the next resolveRunner() re-serve the dead runner.
        if (dead) await this.onRunnerDead?.(dead);
      },
      warmFallback: async () => {
        if (this.destroyed) return;
        await this.inference.ensureFallbackSession();
      },
    });
    private frameCounter = 0;
    private inferenceErrors = 0;
    // Hebel 1.1: letterbox content rect. Full frame until a hysteretic shrink
    // is adopted; the runners take arbitrary shapes, so one implementation
    // here covers the worker, native and main-thread paths with no protocol
    // change. Frame geometry is fixed per instance, hence per-instance state.
    private readonly cropTracker = new LetterboxTracker();
    // Throttled skip telemetry (diagnosability): a session that silently
    // stops enhancing (wedged slots, saturated scheduler) looks identical
    // to a frozen video without it. Fires at most every 60 skips.
    private skippedNoSlot = 0;
    private skippedBusy = 0;
    private skippedQueue = 0;
    private skipLogAt = 0;
    // Presentation drops: frames whose inference COMPLETED but claimPresentation
    // refused them because a newer frame had already presented. This is the
    // only correct "completed but unseen" count now that presentation is
    // out-of-band.
    private presentedDropped = 0;
    // Backlog veterans bailed before inference (both stale-skip exits):
    // counted here so getSkippedFrames sees every skipped arrival.
    private staleSkippedFrames = 0;
    // Hebel 1.4: still-frame gate over the exact runner-input bytes.
    private readonly stillTracker = new StillframeTracker();
    private destroyed = false;
    // The renderer reads the most recent stat window via `getPhaseStats()` and
    // ships it in `RenderStats.realesrgan`, which feeds the live-stats overlay
    // when `statsEnabled` is on. Aggregation window is owned by the renderer
    // (it already emits RenderStats every 500ms).
    private phaseAccumulator: {
      n: number;
      c: number; r: number; k: number;
      g: number; m: number; u: number;
      runnerCount: number;
      nativeCount: number;
      workerFp16Count: number;
      gpuComposeCount: number;
    } | null = null;
    // Renderer-provided recovery hook (see PipelineConstructor docs). Fired
    // once when a WebGPU operation fails with "Context lost" - Firefox's
    // device.lost event does not always resolve on RDNA2, so without this the
    // renderer would keep drawing into a zombie device (black canvas).
    private readonly onDeviceContextLost: (() => void) | null;
    private contextLostReported = false;
    // Fatal-inference hook: fired once when many inferences failed without a
    // single successful result - the enhancement is doing nothing visible and
    // the renderer should fall back to the native path instead of showing a
    // black/static canvas.
    private readonly onFatalInferenceFailure: (() => void) | null;
    private fatalReported = false;
    // Execution config auto-selected per device/EP by the session factory.
    // Labels phase stats (int8 vs fp32) and gates the worker's fp16 probe.
    private readonly execution: RealEsrganExecutionConfig | null;

    constructor({ device, inputTexture, params, targetDimensions, onDeviceContextLost, onFatalInferenceFailure }: PipelineDescriptor) {
      this.device = device;
      this.execution = execution;
      this.inputTexture = inputTexture;
      this.onDeviceContextLost = onDeviceContextLost ?? null;
      this.onFatalInferenceFailure = onFatalInferenceFailure ?? null;
      this.inputWidth = inputTexture.width;
      this.inputHeight = inputTexture.height;

      if (!isReadbackFormat(inputTexture.format)) {
        throw new Error(`RealESRGAN cannot read back texture format ${inputTexture.format}.`);
      }
      this.readbackFormat = inputTexture.format;

      const maxHeight = parseMaxInferenceHeight(params);
      if (maxHeight !== null && this.inputHeight > maxHeight) {
        this.inferenceHeight = maxHeight;
        this.inferenceWidth = Math.max(1, Math.round(this.inputWidth * maxHeight / this.inputHeight));
      } else {
        this.inferenceHeight = this.inputHeight;
        this.inferenceWidth = this.inputWidth;
      }

      // p8 transport-sized output: when the presentation target is known and
      // a native host runner can box-average before download, the pipeline
      // allocates its output texture at the TARGET size and uploads the
      // downscaled frames 1:1. The presentation pass then samples a
      // target-sized texture instead of a 4x one, and the whole transport
      // shrinks accordingly (59 MB -> ~12 MB at 720p inference). The host
      // clamps tw/th to the 4x output, so a target LARGER than 4x silently
      // degrades to the full frame. When the runner cannot downscale (worker
      // path, main-thread session), the target is ignored and the output
      // texture keeps the full 4x size.
      const fullOutW = this.inferenceWidth * 4;
      const fullOutH = this.inferenceHeight * 4;
      const canDownscale = runnerSupportsTargetDownscale(binding?.runner);
      const targetW = Math.floor(targetDimensions?.width ?? 0);
      const targetH = Math.floor(targetDimensions?.height ?? 0);
      if (canDownscale && targetW > 0 && targetH > 0 && (targetW < fullOutW || targetH < fullOutH)) {
        // Preserve aspect via the network output; the presentation pass
        // letterboxes any remainder.
        const byWidth = Math.min(targetW, fullOutW);
        const byHeight = Math.round(byWidth * fullOutH / fullOutW);
        if (byHeight <= targetH) {
          this.outputWidth = byWidth;
          this.outputHeight = byHeight;
        } else {
          this.outputHeight = Math.min(targetH, fullOutH);
          this.outputWidth = Math.round(this.outputHeight * fullOutW / fullOutH);
        }
        this.transportTargetWidth = this.outputWidth;
        this.transportTargetHeight = this.outputHeight;
      } else {
        this.outputWidth = fullOutW;
        this.outputHeight = fullOutH;
        this.transportTargetWidth = 0;
        this.transportTargetHeight = 0;
      }

      // Shared by the downscale pass (when the inference cap shrinks the
      // frame) and the output-prime pass (black-frame guard).
      this.downscaleBindGroupLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        ],
      });

      if (this.inferenceWidth !== this.inputWidth || this.inferenceHeight !== this.inputHeight) {
        // One bilinear pass. A multi-step or mipmap downscale would alias less
        // on >2x reductions, but the network reconstructs detail anyway and
        // the extra passes would eat into the frame budget this cap buys.
        // (The renderer may hand us a wgsl-fidelity-proxied device whose
        // createShaderModule rewrites WGSL — benign for these passes.)
        this.downscaleTexture = device.createTexture({
          label: 'RealESRGAN inference downscale',
          size: [this.inferenceWidth, this.inferenceHeight, 1],
          format: this.readbackFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        this.downscalePipeline = device.createRenderPipeline({
          label: 'RealESRGAN downscale',
          layout: device.createPipelineLayout({ bindGroupLayouts: [this.downscaleBindGroupLayout] }),
          vertex: {
            module: device.createShaderModule({ code: downscaleWGSL }),
            entryPoint: 'vertexMain',
          },
          fragment: {
            module: device.createShaderModule({ code: downscaleWGSL }),
            entryPoint: 'fragmentMain',
            targets: [{ format: this.readbackFormat }],
          },
          primitive: { topology: 'triangle-list' },
        });
        this.downscaleBindGroup = device.createBindGroup({
          layout: this.downscaleBindGroupLayout,
          entries: [
            { binding: 0, resource: device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) },
            { binding: 1, resource: this.inputTexture.createView() },
          ],
        });
      }

      const plan = planReadback(this.inferenceWidth, this.inferenceHeight, this.readbackFormat);
      this.readbackBytesPerRow = plan.bytesPerRow;
      this.readbackByteLength = plan.byteLength;
      this.stagingSlots = new RealEsrganStagingSlots(device, {
        count: this.stagingBufferCount,
        size: Math.max(1, plan.byteLength),
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        label: 'RealESRGAN readback staging',
      });

      this.outputTexture = device.createTexture({
        label: 'RealESRGAN output',
        size: [this.outputWidth, this.outputHeight, 1],
        format: 'rgba8unorm',
        // STORAGE_BINDING lets the GPU composer write the composed result
        // directly; TEXTURE_BINDING + COPY_DST keep the presentation pass
        // sampling and the CPU fallback's writeTexture path working.
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      // Black-frame guard setup: a bilinear sampler that stretches the source
      // frame over the whole 4x output. The source texture already carries
      // the first frame when the renderer builds pipelines (copyCurrentVideo
      // Frame runs before pass()).
      this.primePipeline = device.createRenderPipeline({
        label: 'RealESRGAN output prime',
        layout: device.createPipelineLayout({ bindGroupLayouts: [this.downscaleBindGroupLayout] }),
        vertex: {
          module: device.createShaderModule({ code: downscaleWGSL }),
          entryPoint: 'vertexMain',
        },
        fragment: {
          module: device.createShaderModule({ code: downscaleWGSL }),
          entryPoint: 'fragmentMain',
          targets: [{ format: 'rgba8unorm' }],
        },
        primitive: { topology: 'triangle-list' },
      });
      this.primeBindGroup = device.createBindGroup({
        layout: this.downscaleBindGroupLayout,
        entries: [
          { binding: 0, resource: device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) },
          { binding: 1, resource: this.inputTexture.createView() },
        ],
      });
      // Opportunistic: when compute is unavailable (Firefox WASM build,
      // validation failure) this returns null and the CPU composer stays in
      // charge. The GPU path is a pure optimization, never a correctness
      // dependency. The composer is handed to the output writer, its only
      // owner; on a fake device tryCreate fails closed to null.
      const gpuComposer = RealEsrganGpuComposer.tryCreate(device as unknown as GPUDevice, this.outputTexture);
      this.outputWriter = new RealEsrganOutputWriter({
        device: this.device,
        outputTexture: this.outputTexture,
        outputWidth: this.outputWidth,
        outputHeight: this.outputHeight,
        inputWidth: this.inputWidth,
        inputHeight: this.inputHeight,
        inferenceWidth: this.inferenceWidth,
        inferenceHeight: this.inferenceHeight,
        pool: this.pool,
        primePipeline: this.primePipeline,
        primeBindGroup: this.primeBindGroup,
        isDestroyed: () => this.destroyed,
        isFirstResultLanded: () => this.firstResultLanded,
        notePresentedDropped: () => { this.presentedDropped += 1; },
      }, gpuComposer);
      this.runner = binding?.runner ?? null;
      this.modelAssets = binding?.modelAssets ?? null;
      this.onRunnerDead = binding?.onRunnerDead ?? null;
      // Inference orchestration is wired before the oversize guard/warmup so
      // the guard's warmFallback and the constructor's warmup can await the
      // shared fallback-session handle. getRunner is a read-through accessor:
      // the oversize guard and a Runner-Guard verdict both null `runner`.
      this.inference = new RealEsrganInferenceCoordinator({
        getRunner: () => this.runner,
        guardInference: task => this.runnerGuard.guard(task),
        inferenceWidth: this.inferenceWidth,
        inferenceHeight: this.inferenceHeight,
      }, getSession);
      // Oversize guard: the native host rejects frames beyond its input limit
      // with an untagged throw, which the Runner-Guard reads as "runner
      // permanently dead" and escalates GLOBALLY — one 8k video would bury
      // the shared singleton for every other (small) video too. Crops only
      // ever shrink, so checking the full inference dims here covers every
      // frame. Only adapters that declare maxFrameDim are size-limited (the
      // native host; the worker tiles arbitrary inputs): this instance drops
      // such a runner and serves oversize inputs from its main-thread
      // session, never calling (hence never killing) it.
      const maxFrameDim = this.runner?.maxFrameDim;
      if (maxFrameDim !== undefined
        && (this.inferenceWidth > maxFrameDim || this.inferenceHeight > maxFrameDim)) {
        console.warn(`[RealESRGAN] inference ${this.inferenceWidth}x${this.inferenceHeight} exceeds the runner limit ${maxFrameDim}; this video uses the main-thread session.`);
        this.runner = null;
      }
      // Warm the main-thread fallback session for THIS pipeline's inference
      // shape when no runner serves frames. The memoized promise pays the
      // ORT session cost once per size instead of stalling the first frame;
      // the drain path and the guard's warmFallback await the same handle.
      if (!this.runner && getSession) {
        void this.inference.ensureFallbackSession().then(
          () => undefined,
          (error) => {
            console.warn('[RealESRGAN] fallback session warmup failed; first frame will build it', error);
          },
        );
      }
      // Wire the runner path-label diagnostics (once per distinct value) so
      // the console tells us which composition path served frames without
      // any debugger wiring. Adapters without path labels simply never fire.
      if (this.runner) {
        this.runner.onFramePath = path => {
          console.info('[RealESRGAN] runner composition path:', path);
        };
        // One line per pipeline: runner kind, frame-job depth and geometry
        // so E2E runs can verify overlap is actually engaged (depth 2 on
        // the native path, 1 elsewhere). No parens: the verdict regexes
        // parse onFramePath lines.
        const kind = typeof this.runner.runFrameRgba === 'function' ? 'native' : 'worker';
        console.info(`[RealESRGAN] pipeline runner=${kind} depth=${this.inferenceDepth()} `
          + `infer=${this.inferenceWidth}x${this.inferenceHeight}`);
      }
      // Drain orchestration over the narrow host seam. The host object is the
      // pipeline's adapter to the drain processor: every mutable field keeps
      // its single owner here and is read/updated through an accessor or hook,
      // so no state is duplicated across the seam.
      this.drainProcessor = new RealEsrganDrainProcessor({
        readbackFormat: this.readbackFormat,
        readbackByteLength: this.readbackByteLength,
        inferenceWidth: this.inferenceWidth,
        inferenceHeight: this.inferenceHeight,
        transportTargetWidth: this.transportTargetWidth,
        transportTargetHeight: this.transportTargetHeight,
        pool: this.pool,
        cropTracker: this.cropTracker,
        stillTracker: this.stillTracker,
        outputWriter: this.outputWriter,
        modelAssets: this.modelAssets,
        execution: this.execution,
        tiling: DEFAULT_REALESRGAN_TILING,
        getRunner: () => this.runner,
        isDestroyed: () => this.destroyed,
        isFirstResultLanded: () => this.firstResultLanded,
        markFirstResultLanded: () => { this.firstResultLanded = true; },
        shouldStaleSkip: (frame, threshold) => this.frameJobs.shouldStaleSkip(frame, threshold),
        claimPresentation: frame => this.frameJobs.claimPresentation(frame),
        notePresentedDropped: () => { this.presentedDropped += 1; },
        noteStaleSkipped: () => { this.staleSkippedFrames += 1; },
        releaseStagingClaim: claim => { this.stagingSlots.release(claim); },
        recordPhaseSample: (tCopy, tUnpack, tKernel, tCompose, tUpload, composeUsedGpu, inferUsedRunner, servedNative, servedWorkerFp16) => {
          this.recordPhaseSample(tCopy, tUnpack, tKernel, tCompose, tUpload, composeUsedGpu, inferUsedRunner, servedNative, servedWorkerFp16);
        },
        logInputColorDiag: planar => { this.logInputColorDiag(planar); },
        logOutputColorDiag: result => { this.logOutputColorDiag(result); },
        handleInferenceError: (error, stage) => { this.handleInferenceError(error, stage); },
      }, this.inference);
    }

    public pass(encoder: GPUCommandEncoder): void {
      if (this.destroyed) return;
      this.frameCounter += 1;
      const frame = this.frameCounter;
      // Black-frame guard: before the first inference result lands the output
      // texture is transparent black, and the presentation pass samples it
      // every frame - the user sees a black canvas for the whole ORT warm-up.
      // Prime it with a bilinear upscale of the current source frame once.
      this.outputWriter.primeOutputTexture(encoder, this.frameCounter);
      // Ask the scheduler before recording the frame: shouldProcess() gates on
      // free slots below the runner depth, then noteSkipped() records a
      // rejected frame and counts it when work is in flight. The scheduler
      // owns the in-flight slots; the pipeline keeps no separate busy flag.
      //
      // A staging slot is only usable when neither mapped (CPU-side read in
      // drain()) nor written by an encoded-but-not-yet-executed copy. Both
      // conditions are cleared at the END of drain(); if no slot is free the
      // frame is skipped (latest-frame-wins makes that safe). Blindly
      // rotating to the next slot produced "buffer is still mapped"
      // validation errors once worker round-trips stretched past one frame:
      // the encoder wrote into the slot drain() had mapped, the validation
      // error killed the WHOLE submit, and the output texture stayed empty
      // (black screen).
      // Belt-and-braces: if a previous frame's pending claim never reached
      // afterSubmit() (a renderer path dropped the frame between pass() and
      // submit), its slot would leak into "no free slot". Release it here —
      // the normal flow already consumed it, so this is a no-op every frame
      // the contract holds.
      const leaked = this.stagingSlots.releasePending();
      if (leaked) {
        // The renderer dropped a frame between pass() and afterSubmit(): it
        // was seen here but never reached the scheduler's markStarted, so the
        // next gap count would silently swallow it. Record it as skipped.
        this.frameJobs.noteSkipped(leaked.frame);
        this.noteSkip('queue');
      }
      const claim = this.stagingSlots.claim();
      if (!claim) {
        // Every slot is still owned by an in-flight drain; skip this frame.
        this.frameJobs.noteSkipped(frame);
        this.noteSkip('slot');
        return;
      }
      try {
        this.encodeReadbackCopy(encoder, claim, frame);
      } catch (error) {
        // A throwing encode (lost device, validation, still-mapped buffer)
        // must not leak the claimed slot: afterSubmit() only releases slots
        // with a pending entry, so without this the pipeline wedges into
        // "no free slot" after stagingBufferCount such failures. The
        // renderer counts the dropped frame; rethrow to keep that accounting.
        this.stagingSlots.release(claim);
        this.frameJobs.noteSkipped(frame);
        this.noteSkip('queue');
        throw error;
      }
    }

    /**
     * Encode the optional inference downscale plus the readback copy for a
     * claimed slot, recording the pending claim for afterSubmit().
     */
    private encodeReadbackCopy(encoder: GPUCommandEncoder, claim: RealEsrganStagingClaim, frame: number): void {
      const stagingBuffer = claim.buffer;
      let readbackSource = this.inputTexture;
      if (this.downscaleTexture && this.downscalePipeline && this.downscaleBindGroup) {
        const renderPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.downscaleTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
          }],
        });
        renderPass.setPipeline(this.downscalePipeline);
        renderPass.setBindGroup(0, this.downscaleBindGroup);
        renderPass.draw(6);
        renderPass.end();
        readbackSource = this.downscaleTexture;
      }
      encoder.copyTextureToBuffer(
        { texture: readbackSource },
        { buffer: stagingBuffer, bytesPerRow: this.readbackBytesPerRow },
        [this.inferenceWidth, this.inferenceHeight, 1],
      );
      // Defer the onSubmittedWorkDone registration to afterSubmit(): the
      // renderer calls it AFTER submitting this encoder, so the promise is
      // guaranteed to cover our copy. (This used to be a queueMicrotask
      // racing the renderer's submit — the ordering is now an interface
      // contract, Anime4KPipeline.afterSubmit.)
      this.stagingSlots.markPending(claim, frame);
    }

    /**
     * Renderer contract (see Anime4KPipeline.afterSubmit): called exactly
     * once per frame after the encoder that carried pass()'s copy was
     * submitted. Registering onSubmittedWorkDone HERE is what makes the
     * promise cover the copy — and what makes the ordering testable instead
     * of a microtask race.
     */
    public afterSubmit(): void {
      const pending = this.stagingSlots.takePending();
      if (!pending) return;
      const { claim, frame } = pending;
      if (this.destroyed) {
        this.stagingSlots.release(claim);
        return;
      }
      void this.device.queue.onSubmittedWorkDone().then(() => {
        const submitted = this.frameJobs.submit({
          frame,
          capture: async () => claim,
          infer: claim => this.drainProcessor.drain(claim, frame),
          // Presentation is out-of-band via the frame-job's claimPresentation.
        }, this.inferenceDepth());
        if (!submitted) {
          // Skipped (inference busy): no drain will run, so free the slot now.
          // Without this the pipeline leaks slots and wedges into "no free slot"
          // after 2 frames, freezing the output to the first frame.
          this.stagingSlots.release(claim);
          this.noteSkip('busy');
        }
      }).catch(() => {
        // Device lost or queue error: the copy never completed, so drain()
        // will never run to release the slot. Free it here so the pipeline
        // does not wedge into "no free slot" after 2 frames. The scheduler
        // still needs to know this frame was skipped.
        this.stagingSlots.release(claim);
        this.frameJobs.noteSkipped(frame);
        this.noteSkip('queue');
      });
    }

    /**
     * Throttled skip telemetry: which gate drops arrivals, every 60 skips.
     * Distinguishes "video frozen" (silence here) from "pipeline starved"
     * (slot = staging slots wedged, busy = scheduler at depth, queue =
     * copy never completed) without spamming the console per frame.
     */
    private noteSkip(reason: 'slot' | 'busy' | 'queue'): void {
      if (reason === 'slot') this.skippedNoSlot += 1;
      else if (reason === 'busy') this.skippedBusy += 1;
      else this.skippedQueue += 1;
      const total = this.skippedNoSlot + this.skippedBusy + this.skippedQueue;
      if (total - this.skipLogAt >= 60) {
        this.skipLogAt = total;
        console.info(
          `[RealESRGAN] skipping arrivals: ${total} total `
          + `(no-slot ${this.skippedNoSlot}, busy ${this.skippedBusy}, queue ${this.skippedQueue})`,
        );
      }
    }

    /**
     * One-shot input half of the color diagnostic. The pipeline owns the
     * one-shot flags; the drain calls this whenever it has planar input.
     */
    private logInputColorDiag(planarRgb: Float32Array): void {
      if (this.colorDiagDone || this.colorDiagOutputDone || this.destroyed) return;
      this.colorDiagDone = true;
      try {
        console.log(formatColorDiag('in', this.inferenceWidth, this.inferenceHeight,
          colorDiagStatsFromPlanar(planarRgb, this.inferenceWidth, this.inferenceHeight)));
      } catch (e) {
        console.warn('[RealESRGAN] colordiag input failed', e);
      }
    }

    /**
     * One-shot output half of the color diagnostic; consumes the output flag
     * so it runs at most once per pipeline.
     */
    private logOutputColorDiag(result: RealEsrganFrameResult): void {
      if (!this.colorDiagDone || this.colorDiagOutputDone) return;
      this.colorDiagOutputDone = true;
      try {
        console.log(formatColorDiag('out', result.width, result.height,
          colorDiagStatsFromRgba(result.data, result.width, result.height)));
      } catch (e) {
        console.warn('[RealESRGAN] colordiag output failed', e);
      }
    }

    /**
     * Pipeline-owned error recovery for a failed drain: count the failure,
     * detect unrecoverable context loss, and trip the fatal-inference hook.
     * Destroyed pipelines stay silent: teardown races must not count toward
     * the fatal budget or trigger renderer fallback.
     */
    private handleInferenceError(error: unknown, stage: string): void {
      if (this.destroyed) return;
      this.inferenceErrors += 1;
      const message = errorMessage(error);
      // Context-loss detection. The authoritative signal is the renderer's
      // `device.lost` event; this hook exists only because Firefox/RDNA2 can
      // fail a buffer map with "Context lost" WITHOUT ever resolving
      // device.lost, leaving the renderer presenting from a zombie device
      // (permanently black canvas). WebGPU exposes no structured code for
      // this (the rejection is an untagged DOMException), so the message
      // match is the last-resort fallback, not a policy classification.
      // Producers cannot tag it here: the error surfaces from the raw
      // buffer.mapAsync() call, not from a runner. New policy code should
      // never branch on this prose.
      if (!this.contextLostReported && /context lost/i.test(message)) {
        // Firefox (RDNA2) can fail buffer maps with "Context lost" without
        // ever resolving device.lost - the renderer would then keep
        // presenting from a zombie device: permanently black canvas. Route
        // this into the renderer's device recovery instead.
        this.contextLostReported = true;
        console.warn('[RealESRGAN] WebGPU context lost; requesting device recovery', error);
        this.onDeviceContextLost?.();
      } else {
        console.warn(formatRealEsrganError(REALESRGAN_ERROR_CODES.PIPELINE_INFER_RETRY,
          'inference failed; retrying on next frame'
          + ` at drain stage=${stage}` + errorStack(error)), error);
      }
      // Chronic-failure guard: if inference keeps failing and not a single
      // result ever landed, the enhancement is invisible - the canvas shows
      // only the primed (static) frame. Tell the renderer so it can fall
      // back to the native path instead of silently degrading forever.
      if (!this.fatalReported && !this.firstResultLanded
          && this.inferenceErrors >= FATAL_INFERENCE_FAILURES) {
        this.fatalReported = true;
        console.error(
          '[RealESRGAN] %d inference failures without a single result; giving up on this pipeline',
          this.inferenceErrors,
        );
        this.onFatalInferenceFailure?.();
      }
    }

    /**
     * Hebel 2.4: pipeline depth follows the active runner. The native host
     * serves two in-flight requests (upload N+1 overlaps compute N); the
     * worker path stays at 1 (ORT's global output-buffer cache) as does the
     * main-thread fallback (shared session). Depth never exceeds the staging
     * slots: without a free readback slot the frame is skipped before it can
     * start either way. +1 frame glass-to-glass latency at depth 2 —
     * irrelevant for video.
     */
    private inferenceDepth(): number {
      const runnerDepth = this.runner?.maxInFlight ?? 1;
      const depth = Number.isInteger(runnerDepth) ? runnerDepth : 1;
      return Math.min(this.stagingSlots.count, Math.max(1, depth));
    }

    private recordPhaseSample(
      tCopy: number, tUnpack: number, tKernel: number,
      tCompose: number, tUpload: number,
      composeUsedGpu: boolean, inferUsedRunner: boolean, servedNative: boolean,
      servedWorkerFp16: boolean,
    ): void {
      const a = this.phaseAccumulator ?? {
        n: 0, c: 0, r: 0, k: 0, g: 0, m: 0, u: 0,
        runnerCount: 0, nativeCount: 0, workerFp16Count: 0, gpuComposeCount: 0,
      };
      a.n += 1;
      a.c += tCopy;
      a.r += tUnpack;
      a.k += tKernel;
      if (composeUsedGpu) {
        a.g += tCompose;
      } else {
        // CPU path bundles compose + writeTexture. Surface the cost in
        // composeMs; the overlay hides the upload field on the CPU path.
        a.m += tCompose;
        a.u += tUpload;
      }
      if (inferUsedRunner) a.runnerCount += 1;
      if (servedNative) a.nativeCount += 1;
      if (servedWorkerFp16) a.workerFp16Count += 1;
      if (composeUsedGpu) a.gpuComposeCount += 1;
      this.phaseAccumulator = a;
    }

    /**
     * Average phase timings over the window since the last call. The renderer
     * pulls this once per stats emit (every 500ms) and resets the accumulator
     * — this mutation-on-read is owned by the renderer's single poll. Returns
     * null when no frames were measured in this window, so the overlay falls
     * back to the basic FPS/renderMs line. `enhancedFps` is deliberately NOT
     * set here: it is derived by the renderer from its own window.
     */
    public getPhaseStats(): RealEsrganPhaseStats | null {
      const a = this.phaseAccumulator;
      if (!a || a.n === 0) return null;
      // Precision reflects what actually SERVED this window. Runner frames
      // carry the worker's own report (fp16 model URL won or the silent
      // fp16→fp32 fallback did); the native client reports nothing and
      // counts as fp32 here — its share is tracked separately in
      // nativePct anyway. Session frames serve the execution config's
      // auto-selected model (int8 on the WASM fallback, else fp32). Majority
      // vote across the window.
      const runnerServed = a.runnerCount * 2 >= a.n;
      const workerFp16Served = a.runnerCount > 0 && a.workerFp16Count * 2 >= a.runnerCount;
      const precision: RealEsrganPrecision = runnerServed
        ? (workerFp16Served ? 'fp16' : 'fp32')
        : (this.execution?.preferInt8 ? 'int8' : 'fp32');
      const snapshot: RealEsrganPhaseStats = {
        // Readback = GPU→CPU mapped-range copy + RGBA→planar unpack; both are
        // paid by the readback side of the pipeline, before inference starts.
        readbackMs: (a.c + a.r) / a.n,
        inferMs: a.k / a.n,
        // Compose time on whichever path ran; the overlay treats `composeMs`
        // as "time spent producing the output texture" regardless of GPU/CPU.
        composeMs: (a.g + a.m) / a.n,
        runnerPct: (a.runnerCount / a.n) * 100,
        nativePct: (a.nativeCount / a.n) * 100,
        gpuComposePct: (a.gpuComposeCount / a.n) * 100,
        precision,
        count: a.n,
      };
      this.phaseAccumulator = null;
      return snapshot;
    }

    public getOutputTexture(): GPUTexture {
      return this.outputTexture;
    }

    public getOutputDimensions(): { width: number; height: number } {
      // p8: target-sized when transport downscaling is active, otherwise 4x.
      return { width: this.outputWidth, height: this.outputHeight };
    }

    public destroy(): void {
      if (this.destroyed) return;
      this.destroyed = true;
      this.frameJobs.reset();
      this.presentedDropped = 0;
      // The worker client is SHARED across all RealESRGAN pipeline instances
      // (see pipeline-loader.ts). Destroying it here would poison the shared
      // promise: the next pipeline (e.g. after a resolution change rebuild)
      // would receive a disposed client and permanently fall back to the
      // main-thread WASM session. The worker outlives individual pipelines
      // and caches its sessions per model+resolution; it is only terminated
      // when the content script itself tears down.
      //
      // Each GPU object is released independently: on a lost/destroyed
      // device any single destroy() can throw, and one throwing release
      // must not leak the remaining allocations.
      const releases: Array<() => void> = [
        // The writer owns the GPU composer and releases it on destroy.
        () => this.outputWriter.destroy(),
        () => this.downscaleTexture?.destroy(),
        () => this.stagingSlots.destroy(),
        () => this.outputTexture.destroy(),
        // Drop the pooled scratch references explicitly: a destroyed pipeline
        // must not keep hundreds of MB of ArrayBuffers alive through the pool
        // map until GC happens to clear it (a rebuilt pipeline gets a fresh
        // pool, so nothing is lost).
        () => this.pool.clear(),
      ];
      for (const release of releases) {
        try {
          release();
        } catch (error) {
          console.warn('[RealESRGAN] Pipeline cleanup failed:', error);
        }
      }
    }

    public getSkippedFrames(): number {
      // Frames the video produced while inference was busy (scheduler gaps),
      // completed results discarded because a newer frame had already
      // presented (claimPresentation refusals), plus backlog veterans bailed
      // before inference (stale-skips).
      return this.frameJobs.skippedFrames + this.presentedDropped + this.staleSkippedFrames;
    }
  };
}

