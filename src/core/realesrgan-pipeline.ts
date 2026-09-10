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
import type { InferenceSession, Tensor } from 'onnxruntime-web';
import type { RealEsrganPhaseStats, RealEsrganPrecision } from '../types';
import { RealEsrganBufferPool } from '../shared/realesrgan-buffer-pool';
import { adaptiveRealEsrganTiling } from '../shared/realesrgan-tile-geometry.js';
import { RealEsrganFrameScheduler } from '../shared/realesrgan-pacing';
import { planReadback, planUpload, unpackReadback, unpackReadbackToPlanarRgb, copyMappedRange, type ReadbackFormat } from '../shared/realesrgan-readback';
import {
  composeTileResults,
  inferTiledResults,
  isSingleFullCoverTile,
  rgbPlanarToPaddedRgba,
  type TiledInferenceResult,
} from '../shared/realesrgan-tensor';
import {
  contentRectKey,
  cropPlanarRect,
  cropRgbaRect,
  LetterboxTracker,
  type ContentRect,
} from '../shared/realesrgan-letterbox';
import { StillframeTracker } from '../shared/realesrgan-stillframe';
import {
  decideCropPaste,
  decideFrameContent,
  planCropGeometry,
  shouldHoldPresentedResult,
  stillframeGeometryKey,
} from '../shared/realesrgan-frame-decision';
import {
  colorDiagStatsFromPlanar,
  colorDiagStatsFromRgba,
  formatColorDiag,
} from '../shared/realesrgan-color-diagnostic';
import { planInferenceInput, selectRunnerPath } from '../shared/realesrgan-inference-path';
import { formatRealEsrganError, REALESRGAN_ERROR_CODES, withRealEsrganCode } from '../shared/realesrgan-error-codes';
import { RealEsrganGpuComposer } from './realesrgan-compose';
import type { RealEsrganInferenceRunner, RealEsrganFrameResult } from './realesrgan-worker-client';
import type { RealEsrganModelAssets } from './realesrgan-model-assets';
import { RealEsrganFrameJobRunner } from './realesrgan-frame-job';
import { RealEsrganRunnerGuard } from './realesrgan-runner-guard';
import { REALESRGAN_NATIVE_MAX_FRAME_DIM } from './realesrgan-native-vulkan-client';
import type { Anime4KPipeline, PipelineConstructor } from './pipeline-types';

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
 * Inference failures without a single successful result after which the
 * pipeline reports a fatal failure. Lowered to 4 so a stalled worker / lost
 * context degrades to plain video after ~20s instead of showing a black/static
 * canvas for half a minute.
 */
const FATAL_INFERENCE_FAILURES = 4;

/**
 * Hang guards: a wedged GPU (mapAsync never settling) or a wedged fallback
 * session run must not park staging slots forever — fail fast into the
 * transient retry budget instead. E2E showed slots wedging mid-run with the
 * pipeline limping at ~0 fps and no further errors.
 */
const MAP_ASYNC_TIMEOUT_MS = 8000;
const SESSION_RUN_TIMEOUT_MS = 30_000;
/** A hung fallback build must not poison the per-shape memo forever. */
const SESSION_CREATE_TIMEOUT_MS = 30_000;
/**
 * Stale-skip: a drain whose frame lags this many submitted-but-unfinished
 * frames never reaches the canvas (newer in-flight work presents first and
 * claimPresentation drops it), so skip the serial host fetch and save the
 * ~22 ms for fresh frames. Only fires in deep arrival bursts; normal flow
 * (≤ depth in flight) never trips it. Gated on firstResultLanded so the
 * prime path always runs.
 */
const STALE_SKIP_BEHIND = 6;

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
  device: GPUDevice;
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
 * Precision selected for this pipeline instance (effect param `precision`,
 * set from the stored `realesrganPrecision` setting). Unknown values fall
 * back to int8, the production default — a typo in params must degrade to
 * the fastest verified path, not throw mid-render.
 */
function parsePrecision(params: { [key: string]: unknown } | undefined): RealEsrganPrecision {
  const value = params?.precision;
  return value === 'fp32' || value === 'fp16' || value === 'int8' ? value : 'int8';
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
  getSession: ((width: number, height: number, precision: RealEsrganPrecision) => Promise<InferenceSession>) | null = null,
): PipelineConstructor {
  return class RealEsrganPipeline implements Anime4KPipeline {
    private readonly device: GPUDevice;
    private readonly inputTexture: GPUTexture;
    private readonly outputTexture: GPUTexture;
    private readonly stagingBuffers: GPUBuffer[];
    // Eight staging slots match the native runner's maxInFlight (depth 8):
    // frames arrive in groups of ~10 every ~530 ms (headless rVFC batching)
    // and depth 4 refused 60% of each group (depth 12 measured identical
    // to 8 — arrival-bound). Worker/main-thread paths stay at depth 1 via
    // their own maxInFlight (see inferenceDepth).
    private readonly stagingBufferCount = 8;
    // Slot ownership: true = claimed by pass() (encoded copy pending or
    // mapped in drain()), false = free. Cleared at the end of drain().
    private readonly slotStates: boolean[];
    private readbackSlot = 0;
    // pass() claims a slot and records the frame here; afterSubmit() consumes
    // the pending entry once the renderer has submitted the encoder.
    private pendingAfterSubmit: { slot: number; frame: number } | null = null;
    private readonly readbackFormat: ReadbackFormat;
    private readonly readbackBytesPerRow: number;
    private readonly readbackByteLength: number;
    private readonly scheduler = new RealEsrganFrameScheduler();
    private readonly frameJobs = new RealEsrganFrameJobRunner(this.scheduler);
    // Broker escalation hook (see RealEsrganRunnerBinding.onRunnerDead).
    // Assigned in the constructor; the guard callback reads it at call time.
    private onRunnerDead: ((runner: RealEsrganInferenceRunner) => unknown) | null = null;
    // Fallback session is per-instance state, memoized as ONE promise so the
    // constructor warmup, the guard's warmFallback and the drain's lazy path
    // share a single handle (a rejected build resets it so the next frame
    // retries). It must not live in the factory closure: the loader builds
    // the class once per construction and shares it across videos, so a
    // second video's warmup would overwrite the first video's session.
    private fallbackSessionPromises = new Map<string, Promise<InferenceSession>>();
    // Full-frame scratch buffers are pooled: at 1080p the accumulator alone is
    // ~100 MB, and re-allocating it every processed frame hammers the GC.
    // Dimensions are fixed per pipeline instance, so the pool hits every frame
    // after the first. Tile extraction buffers stay fresh on purpose: they are
    // handed to the ONNX runtime as tensor backing and may still be read
    // asynchronously after run() resolves.
    private readonly pool = new RealEsrganBufferPool();
    private readonly inputWidth: number;
    private readonly inputHeight: number;
    // Inference runs on these dimensions. Equal to the input unless a
    // maxInferenceHeight cap forced a GPU downscale.
    private readonly inferenceWidth: number;
    private readonly inferenceHeight: number;
    // Precision selected via effect params (stored `realesrganPrecision`
    // setting). Steers the main-thread session model file and gates the
    // worker's fp16 probe; the native host ignores it (baked-in model).
    private readonly precision: RealEsrganPrecision;
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
    private primed = false;
    private colorDiagDone = false;
    private colorDiagOutputDone = false;
    // Set once ANY inference result was written to the output texture; the
    // prime pass stops refreshing after that point.
    private firstResultLanded = false;
    // GPU tile composer for the MAIN-THREAD fallback path; null when compute
    // is unavailable. The CPU feathering pass remains the correctness
    // reference. Per-frame compose failures fall back to CPU for that frame
    // only — the composer stays alive (an oversize frame must not retire it
    // for later small frames); device recovery rebuilds it with the pipeline.
    private gpuComposer: RealEsrganGpuComposer | null;
    // Consecutive GPU-compose throws; retires the composer at 3 so a
    // permanently broken composer warns once instead of every frame.
    private gpuComposeFailures = 0;
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
        await this.ensureFallbackSession();
      },
    });
    private frameCounter = 0;
    private inferenceErrors = 0;
    // Hebel 1.1: letterbox content rect. Full frame until a hysteretic shrink
    // is adopted; the runners take arbitrary shapes, so one implementation
    // here covers the worker, native and main-thread paths with no protocol
    // change. Frame geometry is fixed per instance, hence per-instance state.
    private readonly cropTracker = new LetterboxTracker();
    // Output-space key the bars were last filled for (null = never). The
    // output texture persists, so bar fills happen once per geometry.
    private cropBarsKey: string | null = null;
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
    // out-of-band: the scheduler's droppedResults answers "newest submitted"
    // (the publish gate), which counts frames this pipeline actually presented
    // as dropped whenever an older job finishes before a newer one.
    private presentedDropped = 0;
    // Consecutive unpresentable crop results (see presentCroppedResult):
    // escalates into the fatal budget so a persistent geometry mismatch
    // still fails over instead of skipping forever.
    private consecutiveCropSkips = 0;
    // Backlog veterans bailed before inference (both stale-skip exits call
    // isResultCurrent, which only feeds the scheduler's unused droppedResults
    // counter): counted here so getSkippedFrames sees every skipped arrival.
    private staleSkippedFrames = 0;
    // Hebel 1.4: still-frame gate over the exact runner-input bytes.
    private readonly stillTracker = new StillframeTracker();
    // Provenance of the presented result for overlay stats and the
    // still-frame hold gate: true when the last presented frame came from
    // the native client (tight-RGBA call), false for ORT worker/main.
    private lastServedNative = false;
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

    constructor({ device, inputTexture, params, targetDimensions, onDeviceContextLost, onFatalInferenceFailure }: PipelineDescriptor) {
      this.device = device;
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
      this.precision = parsePrecision(params);
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
      const canDownscale = Boolean(binding?.runner && binding.runner.supportsTargetDownscale);
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
      this.stagingBuffers = Array.from({ length: this.stagingBufferCount }, (_, index) => device.createBuffer({
        label: `RealESRGAN readback staging ${index}`,
        size: Math.max(1, plan.byteLength),
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }));
      this.slotStates = this.stagingBuffers.map(() => false);

      this.outputTexture = device.createTexture({
        label: 'RealESRGAN output',
        size: [this.outputWidth, this.outputHeight, 1],
        format: 'rgba8unorm',
        // STORAGE_BINDING lets the GPU composer write the composed result
        // directly; TEXTURE_BINDING + COPY_DST keep the presentation pass
        // sampling and the CPU fallback's writeTexture path working.
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      // Opportunistic: when compute is unavailable (Firefox WASM build,
      // validation failure) this returns null and the CPU composer stays in
      // charge. The GPU path is a pure optimization, never a correctness
      // dependency.
      this.gpuComposer = RealEsrganGpuComposer.tryCreate(device, this.outputTexture);
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
      this.runner = binding?.runner ?? null;
      this.modelAssets = binding?.modelAssets ?? null;
      this.onRunnerDead = binding?.onRunnerDead ?? null;
      // Oversize guard: the native host rejects frames beyond its input limit
      // with an untagged throw, which the Runner-Guard reads as "runner
      // permanently dead" and escalates GLOBALLY — one 8k video would bury
      // the shared singleton for every other (small) video too. Crops only
      // ever shrink, so checking the full inference dims here covers every
      // frame. Only the native adapter is size-limited (supportsTargetDownscale
      // is its marker; the worker tiles arbitrary inputs): this instance
      // drops a size-limited runner and serves oversize inputs from its
      // main-thread session, never calling (hence never killing) it.
      if (this.runner?.supportsTargetDownscale
        && (this.inferenceWidth > REALESRGAN_NATIVE_MAX_FRAME_DIM
          || this.inferenceHeight > REALESRGAN_NATIVE_MAX_FRAME_DIM)) {
        console.warn(`[RealESRGAN] inference ${this.inferenceWidth}x${this.inferenceHeight} exceeds the native host limit; this video uses the main-thread session.`);
        this.runner = null;
      }
      // Warm the main-thread fallback session for THIS pipeline's inference
      // shape when no runner serves frames. The memoized promise pays the
      // ORT session cost once per size instead of stalling the first frame;
      // the drain path and the guard's warmFallback await the same handle.
      if (!this.runner && getSession) {
        void this.ensureFallbackSession().then(
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
    }

    /**
     * Per-shape memo for the main-thread fallback session: constructor
     * warmup, guard warmFallback and the drain's lazy path all await it. A
     * rejected build drops its key so the next frame retries (the session
     * factory drops its own failed cache entries too). Sessions are
     * shape-pinned (buildFreeDimensionOverrides), so a letterbox crop
     * infers at crop size and needs its own session — the factory caches
     * per shape, and crop geometries are few (hysteretic letterbox), so
     * each distinct shape pays the build cost once.
     */
    private ensureFallbackSessionFor(width: number, height: number): Promise<InferenceSession> {
      if (!getSession) {
        return Promise.reject(new Error('RealESRGAN main-thread fallback session is unavailable.'));
      }
      const key = `${width}x${height}`;
      let promise = this.fallbackSessionPromises.get(key);
      if (!promise) {
        promise = getSession(width, height, this.precision).catch(error => {
          this.fallbackSessionPromises.delete(key);
          throw error;
        });
        this.fallbackSessionPromises.set(key, promise);
      }
      return promise;
    }

    /** Full-shape handle for warmup and the guard's fallback warm. */
    private ensureFallbackSession(): Promise<InferenceSession> {
      return this.ensureFallbackSessionFor(this.inferenceWidth, this.inferenceHeight);
    }

    /**
     * Upscale the CURRENT source frame into the output texture with a
     * bilinear pass so the canvas shows a soft image instead of transparent
     * black. Runs on the first pass() and, until the first inference result
     * has landed, on every frame after that: a device/context loss or a
     * wedged worker otherwise leaves the canvas permanently black. Failures
     * are non-fatal; the texture just keeps its previous content.
     */
    private primeOutputTexture(encoder: GPUCommandEncoder): void {
      if (this.destroyed) return;
      if (this.primed && this.firstResultLanded) return;
      this.primed = true;
      try {
        // Log once so e2e can confirm the prime path was taken and with which
        // dimensions (helps diagnose silent validation failures).
        if (this.frameCounter <= 2) {
          console.info('[RealESRGAN] priming output', this.outputTexture.width, 'x', this.outputTexture.height,
            'from', this.inputTexture.width, 'x', this.inputTexture.height, 'fmt', this.inputTexture.format);
        }
        this.device.pushErrorScope('validation');
        try {
          const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
              view: this.outputTexture.createView(),
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: 'store',
            }],
          });
          renderPass.setPipeline(this.primePipeline);
          renderPass.setBindGroup(0, this.primeBindGroup);
          renderPass.draw(6);
          renderPass.end();
        } finally {
          // Always pop the scope: a sync throw above must not leak it, and a
          // device-loss rejection must not surface as unhandled.
          void this.device.popErrorScope().then(error => {
            if (error) console.warn('[RealESRGAN] prime validation error:', error.message);
          }, () => undefined);
        }
      } catch (error) {
        console.warn('[RealESRGAN] output texture priming failed; first frames may be black', error);
      }
    }

    public pass(encoder: GPUCommandEncoder): void {
      if (this.destroyed) return;
      this.frameCounter += 1;
      const frame = this.frameCounter;
      // Black-frame guard: before the first inference result lands the output
      // texture is transparent black, and the presentation pass samples it
      // every frame - the user sees a black canvas for the whole ORT warm-up.
      // Prime it with a bilinear upscale of the current source frame once.
      this.primeOutputTexture(encoder);
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
      const slotCount = this.stagingBuffers.length;
      // Belt-and-braces: if a previous frame's pendingAfterSubmit never
      // reached afterSubmit() (a renderer path dropped the frame between
      // pass() and submit), its claimed slot would leak into "no free slot".
      // Release it here — the normal flow already consumed it, so this is
      // a no-op every frame the contract holds.
      if (this.pendingAfterSubmit) {
        const leakedFrame = this.pendingAfterSubmit.frame;
        this.slotStates[this.pendingAfterSubmit.slot] = false;
        this.pendingAfterSubmit = null;
        // The renderer dropped a frame between pass() and afterSubmit(): it
        // was seen here but never reached the scheduler's markStarted, so the
        // next gap count would silently swallow it. Record it as skipped.
        this.scheduler.noteSkipped(leakedFrame);
        this.noteSkip('queue');
      }
      let slot = -1;
      for (let i = 0; i < slotCount; i += 1) {
        const candidate = (this.readbackSlot + i) % slotCount;
        if (!this.slotStates[candidate]) {
          slot = candidate;
          break;
        }
      }
      if (slot === -1) {
        // Every slot is still owned by an in-flight drain; skip this frame.
        this.scheduler.noteSkipped(frame);
        this.noteSkip('slot');
        return;
      }
      this.slotStates[slot] = true;
      this.readbackSlot = (slot + 1) % slotCount;
      try {
        this.encodeReadbackCopy(encoder, slot, frame);
      } catch (error) {
        // A throwing encode (lost device, validation, still-mapped buffer)
        // must not leak the claimed slot: afterSubmit() only releases slots
        // with a pending entry, so without this the pipeline wedges into
        // "no free slot" after stagingBufferCount such failures. The
        // renderer counts the dropped frame; rethrow to keep that accounting.
        this.slotStates[slot] = false;
        this.scheduler.noteSkipped(frame);
        this.noteSkip('queue');
        throw error;
      }
    }

    /**
     * Encode the optional inference downscale plus the readback copy for a
     * claimed slot, recording the pending entry for afterSubmit().
     */
    private encodeReadbackCopy(encoder: GPUCommandEncoder, slot: number, frame: number): void {
      const stagingBuffer = this.stagingBuffers[slot];
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
      this.pendingAfterSubmit = { slot, frame };
    }

    /**
     * Renderer contract (see Anime4KPipeline.afterSubmit): called exactly
     * once per frame after the encoder that carried pass()'s copy was
     * submitted. Registering onSubmittedWorkDone HERE is what makes the
     * promise cover the copy — and what makes the ordering testable instead
     * of a microtask race.
     */
    public afterSubmit(): void {
      const pending = this.pendingAfterSubmit;
      this.pendingAfterSubmit = null;
      if (!pending) return;
      const { slot, frame } = pending;
      if (this.destroyed) {
        this.slotStates[slot] = false;
        return;
      }
      const stagingBuffer = this.stagingBuffers[slot];
      void this.device.queue.onSubmittedWorkDone().then(() => {
        const submitted = this.frameJobs.submit({
          frame,
          capture: async () => stagingBuffer,
          infer: captured => this.drain(captured as GPUBuffer, frame),
          // Publish stays a no-op by design: the drain presents in-band
          // through the frame-job's claimPresentation watermark, because
          // the job publish gate answers "newest submitted" while
          // presentation needs "newest completed".
          publish: () => undefined,
        }, this.inferenceDepth());
        if (!submitted) {
          // Skipped (inference busy): no drain will run, so free the slot now.
          // Without this the pipeline leaks slots and wedges into "no free slot"
          // after 2 frames, freezing the output to the first frame.
          this.slotStates[slot] = false;
          this.noteSkip('busy');
        }
      }).catch(() => {
        // Device lost or queue error: the copy never completed, so drain()
        // will never run to release the slot. Free it here so the pipeline
        // does not wedge into "no free slot" after 2 frames. The scheduler
        // still needs to know this frame was skipped.
        this.slotStates[slot] = false;
        this.scheduler.noteSkipped(frame);
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

    private async drain(stagingBuffer: GPUBuffer, frame: number): Promise<void> {
      // Locate the slot this staging buffer occupies so the ownership claim
      // can be released when the mapped read is done. The release lives in a
      // finally so a failed mapAsync (device loss, destroyed) can never leak
      // a claimed slot and wedge the pipeline into "no free slot" forever.
      const slotIndex = this.stagingBuffers.indexOf(stagingBuffer);
      // Early stale-skip (same rule as the pre-fetch check below): a drain
      // that starts while 7+ newer frames are already submitted is usually a
      // post-hitch backlog veteran — its bytes would die in
      // claimPresentation anyway. Bailing before pool.acquire keeps deep
      // recovery bursts from churning pooled buffers for nothing.
      if (this.firstResultLanded && !this.destroyed
          && this.scheduler.newestInFlightFrame() - frame > STALE_SKIP_BEHIND) {
        this.scheduler.isResultCurrent(frame);
        this.staleSkippedFrames += 1;
        // This return sits BEFORE the try/finally below, so release the
        // staging slot here — otherwise the skip itself leaks it.
        if (slotIndex >= 0) this.slotStates[slotIndex] = false;
        return;
      }
      const pixels = this.inferenceWidth * this.inferenceHeight;
      // The native runner POSTs RGBA8 anyway: when it offers the fast path
      // (and the source is already 8-bit), skip the planar-float roundtrip
      // and hand tight bytes over. The planar form is still needed until the
      // first result lands (CPU prime fallback) and for the one-shot color
      // diagnostic, so early frames always take the slow path.
      const useFastRgba = planInferenceInput({
        hasRunner: this.runner !== null,
        hasModelUrl: this.modelAssets !== null,
        rgbaCapable: typeof this.runner?.runFrameRgba === 'function',
        readbackRgba8: this.readbackFormat === 'rgba8unorm',
        primed: this.firstResultLanded,
      }) === 'tight-rgba';
      // Acquire the readback buffer up front; the (large) model-input and
      // composition buffers are only needed on the paths that use them and
      // are acquired lazily there, so the fast path keeps less pooled
      // memory hot. The acquires live inside the try: `new ArrayBuffer` on
      // a pool miss throws under memory pressure, and an allocation before
      // the try would leak the staging slot (only the finally releases it)
      // and escape drain as an unhandled rejection.
      let readbackBytes: ArrayBuffer | null = null;
      let inputRgbBuffer: ArrayBuffer | null = null;
      let tightRgbaBuffer: ArrayBuffer | null = null;
      // Hebel 1.1 crop slices (pooled; assigned in the try, released below).
      let cropPlanarBuffer: ArrayBuffer | null = null;
      let cropRgbaBuffer: ArrayBuffer | null = null;
      // Phase timings: always on. The arithmetic is cheap (a `performance.now`
      // and four additions per frame), and the live-stats overlay is the
      // primary UI for understanding inference cost. `getPhaseStats()` returns
      // null until at least one frame has been measured.
      let tCopy = 0, tUnpack = 0, tKernel = 0, tCompose = 0, tUpload = 0;
      let composeUsedGpu = false;
      let inferUsedRunner = false;
      // Provenance of the presented result for the overlay (native vs ORT
      // worker): the tight-RGBA call exists only on the native client.
      let servedNative = false;
      // Worker fp16 provenance for the overlay precision label: the worker
      // reports which model URL served each frame (its silent fp16→fp32
      // fallback would otherwise mislabel the window).
      let servedWorkerFp16 = false;
      // Still-hold marker: a held frame presents no new inference, so its
      // zero kernel/compose timings must not enter the phase averages (they
      // would drag inferMs toward 0 for the whole window). Checked in the
      // finally below.
      let heldPresented = false;
      // Stale-skip marker: like heldPresented, no inference ran, so no phase
      // sample (zeros would pollute the window). Checked in the finally below.
      let staleSkipped = false;
      // Drain phase for failure diagnosis (error objects are unreadable
      // across compartments, so the phase rides in the log text).
      let drainStage = 'enter';
      let t1 = performance.now();
      try {
        readbackBytes = this.pool.acquire(this.readbackByteLength);
        inputRgbBuffer = useFastRgba ? null : this.pool.acquire(3 * pixels * 4);
        tightRgbaBuffer = useFastRgba ? this.pool.acquire(4 * pixels) : null;
        drainStage = 'map';
        await Promise.race([
          stagingBuffer.mapAsync(GPUMapMode.READ),
          new Promise<never>((_, reject) => setTimeout(() => reject(withRealEsrganCode(
            new Error(`RealESRGAN readback map timed out after ${MAP_ASYNC_TIMEOUT_MS}ms`),
            REALESRGAN_ERROR_CODES.PIPELINE_INFER_RETRY,
          )), MAP_ASYNC_TIMEOUT_MS)),
        ]);
        if (this.destroyed) return;
        const mapped = new Uint8Array(readbackBytes);
        try {
          // The mapped range is only valid until unmap(); copy it out first.
          // copyMappedRange survives cross-compartment ranges (parent-process
          // shared memory throws on plain view construction in Firefox).
          drainStage = 'copy';
          copyMappedRange(stagingBuffer.getMappedRange(), mapped);
        } finally {
          stagingBuffer.unmap();
        }
        tCopy = performance.now() - t1;
        t1 = performance.now();

        drainStage = 'unpack';
        let inputRgb: Float32Array | null = null;
        let tightRgba: Uint8Array | null = null;
        if (useFastRgba && tightRgbaBuffer) {
          tightRgba = unpackReadback(mapped, this.inferenceWidth, this.inferenceHeight, this.readbackFormat, new Uint8Array(tightRgbaBuffer));
        } else if (inputRgbBuffer) {
          inputRgb = new Float32Array(inputRgbBuffer);
          unpackReadbackToPlanarRgb(mapped, this.inferenceWidth, this.inferenceHeight, this.readbackFormat, inputRgb);
        } else {
          throw new Error('RealESRGAN drain has no input buffer for the active path.');
        }
        tUnpack = performance.now() - t1;

        // Hebel 1.1: letterbox content rect — the decision chain (verify →
        // reset → poll → observe → snap) lives in the Frame-Entscheidung
        // module; the drain only slices buffers and dispatches.
        drainStage = 'crop';
        const fullW = this.inferenceWidth;
        const fullH = this.inferenceHeight;
        const { crop, cropActive } = decideFrameContent({
          width: fullW,
          height: fullH,
          tightRgba,
          planar: inputRgb,
          cropTracker: this.cropTracker,
          transportTargetWidth: this.transportTargetWidth,
          transportTargetHeight: this.transportTargetHeight,
        });

        // Slice the crop out of the unpacked input (pooled; released below).
        const geometry = planCropGeometry(
          crop, fullW, fullH, this.transportTargetWidth, this.transportTargetHeight,
        );
        const inferW = geometry.inferWidth;
        const inferH = geometry.inferHeight;
        const targetW = geometry.targetWidth;
        const targetH = geometry.targetHeight;
        let inferPlanar = inputRgb;
        let inferRgba = tightRgba;
        if (cropActive) {
          if (tightRgba) {
            cropRgbaBuffer = this.pool.acquire(inferW * inferH * 4);
            inferRgba = cropRgbaRect(tightRgba, fullW, fullH, crop, new Uint8Array(cropRgbaBuffer));
          } else if (inputRgb) {
            cropPlanarBuffer = this.pool.acquire(3 * inferW * inferH * 4);
            inferPlanar = cropPlanarRect(inputRgb, fullW, fullH, crop, new Float32Array(cropPlanarBuffer));
          }
        }

        // Hebel 1.4: hold the presented result when the exact runner input
        // repeats. Deliberately content-based, NOT video.paused-based: a pure
        // paused check would freeze seek previews while scrubbing (paused +
        // changing content must still infer). The gate lives in the
        // Frame-Entscheidung module; the hash covers the cropped runner
        // input, so a crop change resets the run via the geometry key.
        drainStage = 'still';
        const hashBytes = inferRgba ?? (inferPlanar ? new Uint8Array(inferPlanar.buffer) : null);
        if (!hashBytes) throw new Error('RealESRGAN drain has no hashable inference input.');
        if (shouldHoldPresentedResult({
          stillTracker: this.stillTracker,
          hashBytes,
          geometryKey: stillframeGeometryKey(inferW, inferH, crop),
          firstResultLanded: this.firstResultLanded,
        })) {
          // Bytes already presented: skip inference AND compose. The output
          // texture keeps the identical result; readback/unpack/hash (~ms)
          // is the only price per held frame vs ~65ms live inference.
          // Provenance follows the held result, not this arrival. No phase
          // sample either (see heldPresented): zeros would pollute the window.
          servedNative = this.lastServedNative;
          heldPresented = true;
          return;
        }
        // One-shot color diagnostic (405p report): compare inference input vs
        // runner output channel stats on the first frames so a tint/shift can
        // be attributed to one side of the transport. Sampling lives in the
        // pure diagnostic module; the one-shot flags stay here. The input
        // half is safe to run unconditionally: the fast RGBA path only
        // starts after the first result landed (primed gate), so the first
        // frame always has planar input.
        drainStage = 'diag-prime';
        if (inputRgb && !this.colorDiagDone && !this.colorDiagOutputDone && !this.destroyed) {
          this.colorDiagDone = true;
          try {
            console.log(formatColorDiag('in', this.inferenceWidth, this.inferenceHeight,
              colorDiagStatsFromPlanar(inputRgb, this.inferenceWidth, this.inferenceHeight)));
          } catch (e) {
            console.warn('[RealESRGAN] colordiag input failed', e);
          }
        }
        // CPU prime fallback: until the first inference result lands the
        // canvas would be black if the GPU prime silently failed (validation
        // error, empty source at first frame). Upscale the *just-unpacked*
        // frame on the CPU and push it to the output texture so the user
        // sees the plain video instead of black, even before inference.
        // (Planar-only: the fast path starts after the first result lands.)
        if (inputRgb && !this.firstResultLanded && !this.destroyed) {
          try {
            this.writePrimeFromPlanar(inputRgb, this.inferenceWidth, this.inferenceHeight);
          } catch (e) {
            console.warn('[RealESRGAN] CPU prime fallback failed', e);
          }
        }
        // Stale-skip: 7+ newer frames are already submitted and unfinished,
        // so this result could only present for a blink before newer work
        // overwrites it (claimPresentation is monotonic). Skip the serial
        // host fetch and hand the ~22 ms to fresh frames. Safe against the
        // historic freeze (dropping the ONLY in-flight frame): the newer
        // in-flight frames behind us still present. Never fires before the
        // first result (prime path above must run) or when idle.
        if (this.firstResultLanded && !this.destroyed
            && this.scheduler.newestInFlightFrame() - frame > STALE_SKIP_BEHIND) {
          this.scheduler.isResultCurrent(frame);
          this.staleSkippedFrames += 1;
          staleSkipped = true;
          return;
        }
        t1 = performance.now();

        drainStage = 'infer';
        // Runner dispatch rides the path selector: it owns which input form
        // each path accepts and hands narrowed buffers back, so drain cannot
        // mismatch path and input. Both throw sites keep their messages.
        const runnerPath = selectRunnerPath({
          runner: this.runner,
          modelUrl: this.modelAssets?.dynamicUrl ?? null,
          rgba: inferRgba,
          planar: inferPlanar,
        });
        if (runnerPath.kind === 'runner-rgba' || runnerPath.kind === 'runner-planar') {
          // Runner path: the frame (or its content crop) goes out; the runner
          // plans tiles, runs inference and packs the result. What comes back
          // is tightly packed RGBA8 with its actual dimensions - runners may
          // box-average to the presentation target (native host, worker
          // target); the length check below enforces the actual size either
          // way.
          inferUsedRunner = true;
          // Modell-Auswahl: static model on exact-shape match, dynamic
          // otherwise. The binding couples runner and assets, so reaching
          // the runner path without assets is an invariant break.
          const modelAssets = this.modelAssets;
          if (!modelAssets) {
            throw new Error('RealESRGAN runner binding has no model assets.');
          }
          const frameModelUrl = modelAssets.urlForShape(inferW, inferH);
          let result: RealEsrganFrameResult;
          if (runnerPath.kind === 'runner-rgba') {
            result = await this.runNativeRgbaFrame(frameModelUrl, runnerPath.rgba, inferW, inferH, targetW, targetH);
          } else {
            // The worker only probes its fp16 model when the user selected
            // fp16: handing it the URL otherwise burns a session attempt
            // plus a timed-out frame per shape on RDNA2 (Clip-WGSL bug).
            // INT8 never reaches the worker — QDQ has no WebGPU kernels in
            // ORT-web 1.29, so the worker lane stays FP32 and int8 serves
            // through the main-thread WASM session below.
            const fp16Url = this.precision === 'fp16' ? modelAssets.fp16Url : null;
            result = await this.runWorkerInference(frameModelUrl, fp16Url, runnerPath.planar, inferW, inferH, targetW, targetH);
          }
          const targeted = targetW > 0 && targetH > 0;
          const expW = targeted ? targetW : inferW * 4;
          const expH = targeted ? targetH : inferH * 4;
          const expectedLength = expW * expH * 4;
          if (result.data.length !== expectedLength
              || result.width !== expW || result.height !== expH) {
            throw new Error(`RealESRGAN runner returned ${result.width}x${result.height} `
              + `(${result.data.length} bytes); expected ${expW}x${expH} (${expectedLength}).`);
          }
          tKernel = performance.now() - t1;
          if (this.destroyed) return;
          // Always present the result, even if newer frames arrived while inferring.
          // The old "drop stale if newer frame seen" froze the output to the first
          // frame when inference (70ms) is slower than video interval (16ms) - every
          // result was considered stale and dropped. (Stale-result accounting
          // lives in the frame-job runner's publish gate; calling
          // isResultCurrent here as well would double-count every presented
          // frame as dropped.)
          t1 = performance.now();
          // Hebel 2.4: at depth 2 a newer frame may already have presented
          // while this one was in flight — then its bytes stay off the
          // canvas (monotonic presentation), but timings still record. The
          // watermark is the frame-job runner's claimPresentation.
          drainStage = 'present';
          if (this.frameJobs.claimPresentation(frame)) {
            if (cropActive) {
              this.presentCroppedResult(result.data, expW, expH, crop, targetW, targetH);
            } else {
              this.writeRgbaResult(result.data, result.width, result.height);
            }
            servedNative = inferRgba !== null;
            servedWorkerFp16 = result.precision === 'fp16';
            this.lastServedNative = servedNative;
            this.firstResultLanded = true;
          } else {
            // Completed but superseded: a newer frame already presented.
            // Counted here (not via scheduler.droppedResults, whose "newest
            // submitted" watermark also fires for frames we DID present).
            this.presentedDropped += 1;
          }
          tCompose = performance.now() - t1;
          if (this.colorDiagDone && !this.colorDiagOutputDone) {
            // Second half of the one-shot color diagnostic: channel stats of
            // the runner output. Runs once by consuming the output flag here.
            this.colorDiagOutputDone = true;
            try {
              console.log(formatColorDiag('out', result.width, result.height,
                colorDiagStatsFromRgba(result.data, result.width, result.height)));
            } catch (e) {
              console.warn('[RealESRGAN] colordiag output failed', e);
            }
          }
        } else if (runnerPath.kind === 'session') {
          // Main-thread session path: tiled inference plus GPU/CPU compose.
          // Planar-only: the fast path implies a live runner, so reaching
          // here without planar input means the runner vanished mid-frame
          // (counted below). Cropped frames infer at crop size and are
          // pasted back by writeCroppedComposedResult.
          const tiled = await inferTiledResults({
            inputRgb: runnerPath.planar,
            width: inferW,
            height: inferH,
            ...adaptiveRealEsrganTiling(inferW, inferH, DEFAULT_REALESRGAN_TILING),
            infer: (tileRgb, tileWidth, tileHeight) => this.runSessionInference(tileRgb, tileWidth, tileHeight),
          });
          tKernel = performance.now() - t1;
          if (this.destroyed) return;
          // Same fix as worker path: always present, don't drop stale
          // (see comment above; no isResultCurrent accounting here).
          t1 = performance.now();
          drainStage = 'present';
          if (this.frameJobs.claimPresentation(frame)) {
            if (cropActive) {
              composeUsedGpu = this.writeCroppedComposedResult(tiled, crop);
            } else {
              composeUsedGpu = this.writeComposedResult(tiled);
            }
            servedNative = false;
            this.lastServedNative = false;
            this.firstResultLanded = true;
          } else {
            this.presentedDropped += 1;
          }
          tCompose = performance.now() - t1;
        } else {
          throw new Error(runnerPath.hasRunnerBinding
            ? 'RealESRGAN drain has no inference input for the active path.'
            : 'RealESRGAN drain has no planar input for the main-thread path.');
        }
      } catch (error) {
        // A lost device or a failed inference must not wedge the frame loop;
        // count it and release the slot so the next frame can retry.
        // Destroyed pipelines stay silent: teardown races (an in-flight
        // fetch settling after an auto-cap rebuild) must not count toward
        // another pipeline's fatal budget or trigger renderer fallback.
        // The finally below still releases pool buffers and the slot.
        if (this.destroyed) return;
        this.inferenceErrors += 1;
        const message = errorMessage(error);
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
            + ` at drain stage=${drainStage}` + errorStack(error)), error);
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
      } finally {
        if (readbackBytes) this.pool.release(readbackBytes);
        if (inputRgbBuffer) this.pool.release(inputRgbBuffer);
        if (tightRgbaBuffer) this.pool.release(tightRgbaBuffer);
        if (cropPlanarBuffer) this.pool.release(cropPlanarBuffer);
        if (cropRgbaBuffer) this.pool.release(cropRgbaBuffer);
        // Held still-frames carry no inference: sampling their zeros would
        // drag inferMs/composeMs toward 0 for the whole overlay window.
        if (!heldPresented && !staleSkipped) this.recordPhaseSample(tCopy, tUnpack, tKernel, tCompose, tUpload, composeUsedGpu, inferUsedRunner, servedNative, servedWorkerFp16);
        // Release the staging slot AFTER unmap() has run on every path. The
        // buffer is unmapped in the try block above (finally around the
        // mapped-range copy); if we never got there, mapAsync failed and
        // there is nothing mapped anyway. Either way the slot is reusable.
        if (slotIndex >= 0) this.slotStates[slotIndex] = false;
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
      return Math.min(this.stagingBufferCount, Math.max(1, depth));
    }

    private async runWorkerInference(
      modelUrl: string,
      modelUrlFp16: string | null,
      inputRgb: Float32Array,
      width: number,
      height: number,
      targetWidth: number,
      targetHeight: number,
    ): Promise<RealEsrganFrameResult> {
      const runner = this.runner;
      if (!runner) {
        throw new Error('RealESRGAN runner binding is unavailable.');
      }
      return this.runnerGuard.guard(() => runner.runFrame(
        modelUrl, modelUrlFp16, width, height, inputRgb,
        targetWidth, targetHeight,
      ));
    }

    /**
     * Native fast path: tight RGBA8 straight to a runner that accepts it
     * (see RealEsrganInferenceRunner.runFrameRgba). Same timeout/fallback
     * accounting as runWorkerInference via the shared guard. Width/height
     * are the content-crop dims when Hebel 1.1 is active, else full-frame.
     */
    private async runNativeRgbaFrame(
      modelUrl: string,
      rgba: Uint8Array,
      width: number,
      height: number,
      targetWidth: number,
      targetHeight: number,
    ): Promise<RealEsrganFrameResult> {
      const runner = this.runner;
      if (!runner || typeof runner.runFrameRgba !== 'function') {
        throw new Error('RealESRGAN RGBA runner binding is unavailable.');
      }
      return this.runnerGuard.guard(() => runner.runFrameRgba!(
        modelUrl, width, height, rgba,
        targetWidth, targetHeight,
      ));
    }

    private async runSessionInference(tileRgb: Float32Array, tileWidth: number, tileHeight: number): Promise<Float32Array> {
      // Tiles (and cropped frames) run at their own size; the full-frame
      // session would reject the input shape. The per-shape memo keeps each
      // distinct geometry at one build cost.
      let fallback: InferenceSession;
      try {
        fallback = await Promise.race([
          this.ensureFallbackSessionFor(tileWidth, tileHeight),
          new Promise<never>((_, reject) => setTimeout(() => reject(withRealEsrganCode(
            new Error(`RealESRGAN fallback session build timed out after ${SESSION_CREATE_TIMEOUT_MS}ms`),
            REALESRGAN_ERROR_CODES.PIPELINE_INFER_RETRY,
          )), SESSION_CREATE_TIMEOUT_MS)),
        ]);
      } catch (error) {
        // A hung build must not poison the memo: drop the key so the next
        // frame rebuilds instead of awaiting the same stuck promise forever.
        this.fallbackSessionPromises.delete(`${tileWidth}x${tileHeight}`);
        throw error;
      }
      const { Tensor: OrtTensor } = await import(/* webpackChunkName: "ort" */ 'onnxruntime-web');
      const inputName = fallback.inputNames[0] ?? 'input';
      const outputName = fallback.outputNames[0] ?? 'output';
      // FP16 model when registered and preferred; the FP32 model stays the
      // quality reference. Both models expose float32 I/O.
      const input = new OrtTensor('float32', tileRgb, [1, 3, tileHeight, tileWidth]);
      const outputs = await Promise.race([
        fallback.run({ [inputName]: input as Tensor }),
        new Promise<never>((_, reject) => setTimeout(() => reject(withRealEsrganCode(
          new Error(`RealESRGAN session run timed out after ${SESSION_RUN_TIMEOUT_MS}ms`),
          REALESRGAN_ERROR_CODES.PIPELINE_INFER_RETRY,
        )), SESSION_RUN_TIMEOUT_MS)),
      ]);
      const result = outputs[outputName];
      if (!result) throw new Error('RealESRGAN inference returned no output tensor.');
      return result.data as Float32Array;
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
      // nativePct anyway. Session frames serve this pipeline's selected
      // precision (effect param, from the stored setting). Majority vote
      // across the window.
      const runnerServed = a.runnerCount * 2 >= a.n;
      const workerFp16Served = a.runnerCount > 0 && a.workerFp16Count * 2 >= a.runnerCount;
      const precision: RealEsrganPrecision = runnerServed
        ? (workerFp16Served ? 'fp16' : 'fp32')
        : this.precision;
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

    /**
     * Compose the inferred tiles into the output texture (main-thread session
     * path only). Prefers the GPU compute composer; falls back to the CPU
     * feathering pass when the composer is unavailable, declines the frame, or
     * throws.
     *
     * Returns true when the GPU composer handled the frame (so the profiler
     * can attribute the cost to "compose" rather than "upload"), false on
     * the CPU path.
     */
    private writeComposedResult(tiled: TiledInferenceResult): boolean {
      if (this.gpuComposer) {
        try {
          if (this.gpuComposer.compose(tiled.tiles, tiled.outWidth, tiled.outHeight, tiled.featherWindow)) {
            this.gpuComposeFailures = 0;
            return true;
          }
        } catch (error) {
          // Per-frame failure (oversize allocation beyond the binding
          // limit, lost device): fall back to CPU for THIS frame but keep
          // the composer alive — retiring it on one huge frame would
          // permanently downgrade every later (small) frame. A permanently
          // broken composer (lost device) retires after consecutive
          // failures instead of warning on every frame forever; device
          // recovery rebuilds the whole pipeline (composer included) anyway.
          this.gpuComposeFailures += 1;
          if (this.gpuComposeFailures >= 3) {
            console.warn('[RealESRGAN] GPU compose failed repeatedly; retiring the composer', error);
            try {
              this.gpuComposer.destroy();
            } catch {
              // Release best-effort (see destroy()).
            }
            this.gpuComposer = null;
          } else {
            console.warn('[RealESRGAN] GPU compose failed for this frame; using CPU composer', error);
          }
        }
      }
      const outPixels = tiled.outWidth * tiled.outHeight;
      // Single full-cover tile: the compose fast lane needs no accumulator or
      // weight buffers, so skip acquiring the (large) pooled buffers entirely
      // (at the 480p cap this would otherwise pin ~105 MB for nothing).
      if (isSingleFullCoverTile(tiled)) {
        const composed = composeTileResults(tiled);
        this.writeResult(composed.rgb, composed.width, composed.height);
        return false;
      }
      const accumulatorBuffer = this.pool.acquire(3 * outPixels * 4);
      const weightSumBuffer = this.pool.acquire(outPixels * 4);
      try {
        const composed = composeTileResults(
          tiled,
          new Float32Array(accumulatorBuffer),
          new Float32Array(weightSumBuffer),
        );
        this.writeResult(composed.rgb, composed.width, composed.height);
        return false;
      } finally {
        this.pool.release(accumulatorBuffer);
        this.pool.release(weightSumBuffer);
      }
    }

    private writeRgbaResult(rgba: Uint8Array, width: number, height: number): void {
      // A full-frame write paints over the whole texture, including any
      // previously filled letterbox bars. Forget the bar geometry: returning
      // to the same crop later must re-fill its bars instead of trusting
      // stale content pixels the full frame just overwrote.
      this.cropBarsKey = null;
      // A presented full frame proves the geometry is healthy again.
      this.consecutiveCropSkips = 0;
      this.writeRgbaSubview(rgba, width, height, 0, 0);
    }

    /**
     * writeTexture for a sub-rectangle of the output texture (Hebel 1.1
     * content paste). Rows are padded to the 256-byte copy alignment when
     * the tight width is unaligned — cropped pastes usually are; the pooled
     * pad buffer is stable per geometry so it hits every frame.
     */
    private writeRgbaSubview(rgba: Uint8Array, width: number, height: number, ox: number, oy: number): void {
      const { bytesPerRow } = planUpload(width, height);
      const tightRowBytes = width * 4;
      const origin = { x: ox, y: oy };
      if (bytesPerRow === tightRowBytes) {
        // writeTexture copies the data into the queue synchronously; no
        // staging buffer needed on the tight path (common case).
        this.device.queue.writeTexture(
          { texture: this.outputTexture, origin },
          rgba,
          { bytesPerRow, rowsPerImage: height },
          [width, height, 1],
        );
        return;
      }
      // writeTexture copies the data into the queue synchronously, so the
      // pooled upload buffer is safe to release as soon as the call returns.
      const uploadBuffer = this.pool.acquire(bytesPerRow * height);
      try {
        const padded = new Uint8Array(uploadBuffer);
        for (let row = 0; row < height; row += 1) {
          padded.set(rgba.subarray(row * tightRowBytes, (row + 1) * tightRowBytes), row * bytesPerRow);
        }
        this.device.queue.writeTexture(
          { texture: this.outputTexture, origin },
          padded,
          { bytesPerRow, rowsPerImage: height },
          [width, height, 1],
        );
      } finally {
        this.pool.release(uploadBuffer);
      }
    }

    /**
     * Hebel 1.1 output: paste a cropped inference result into the full-size
     * output texture and re-attach opaque-black bars. The content mapping is
     * integer-exact by construction (×4 on the full path, target-grid-snapped
     * on the downscaled native path); round() only absorbs float dust and
     * never moves an edge. Only the ORIGIN is rounded here: the pasted SIZE
     * is the runner result the caller already validated (expW/expH), never a
     * second independent rounding of the same rect — round(out*(x+w)/full) −
     * round(out*x/full) and round(target*infer/full) differ by 1px on odd
     * widths (e.g. 853→1280 pillarbox), which used to throw on every cropped
     * frame. A mapping that does not fit at all (e.g. a main-thread crop
     * result meeting a target-sized texture after the runner died) skips
     * like a superseded result instead of burning the fatal budget on
     * successfully inferred frames — it must never shear the presentation.
     *
     * `targetW/targetH` are the transport target the caller sent with this
     * inference (0 = full 4x): the result bytes must match them exactly.
     */
    private presentCroppedResult(
      rgba: Uint8Array,
      width: number,
      height: number,
      crop: ContentRect,
      targetWidth: number,
      targetHeight: number,
    ): void {
      const outW = this.outputWidth;
      const outH = this.outputHeight;
      // Size comes from the validated result, not from re-rounding the rect:
      // the runner was asked for exactly targetW/targetH (or the full 4x
      // content) and length-checked against it by the caller.
      const targeted = targetWidth > 0 && targetHeight > 0;
      const rw = targeted ? targetWidth : width;
      const rh = targeted ? targetHeight : height;
      if (width !== rw || height !== rh) {
        throw new Error(`RealESRGAN crop result ${width}x${height} does not match `
          + `its transport target ${rw}x${rh}.`);
      }
      // Origin/size fit rides the pure geometry decision (unit-tested):
      // ~1px rounding overshoot shifts back inside, unpresentable bytes
      // skip like a superseded result instead of burning the fatal budget
      // on a transient mismatch. A PERSISTENT mismatch (stale dims after a
      // runner death: every frame unpresentable) escalates after the same
      // budget as inference failures, so enhancement still fails over to
      // the native path instead of skipping silently forever.
      const decision = decideCropPaste(crop, this.inferenceWidth, this.inferenceHeight, outW, outH, rw, rh);
      if (decision.kind === 'skip') {
        this.presentedDropped += 1;
        this.consecutiveCropSkips += 1;
        if (this.consecutiveCropSkips >= FATAL_INFERENCE_FAILURES) {
          throw new Error(`RealESRGAN crop result ${rw}x${rh} cannot be presented `
            + `in ${outW}x${outH} (${this.consecutiveCropSkips} consecutive skips).`);
        }
        return;
      }
      this.consecutiveCropSkips = 0;
      const { ox, oy } = decision.paste;
      this.writeRgbaSubview(rgba, width, height, ox, oy);
      this.ensureCropBarsFilled(crop, ox, oy, rw, rh);
    }

    /**
     * Re-attach the cropped-away bars as opaque black. The output texture
     * persists across frames, so bars are written once per geometry; content
     * pastes every frame only touch the content rect.
     */
    private ensureCropBarsFilled(crop: ContentRect, ox: number, oy: number, rw: number, rh: number): void {
      const key = `${this.outputWidth}x${this.outputHeight}:${contentRectKey(crop)}`;
      if (this.cropBarsKey === key) return;
      const outW = this.outputWidth;
      const outH = this.outputHeight;
      const bars: Array<[number, number, number, number]> = [
        [0, 0, outW, oy],
        [0, oy + rh, outW, outH - oy - rh],
        [0, oy, ox, rh],
        [ox + rw, oy, outW - ox - rw, rh],
      ];
      for (const [bx, by, bw, bh] of bars) {
        if (bw <= 0 || bh <= 0) continue;
        this.writeBlackRect(bx, by, bw, bh);
      }
      this.cropBarsKey = key;
    }

    /**
     * Opaque-black writeTexture for one output-space rect. Fresh buffers (not
     * pooled): bar fills only run on geometry changes, so per-frame pool
     * pressure stays zero.
     */
    private writeBlackRect(x: number, y: number, width: number, height: number): void {
      const { bytesPerRow } = planUpload(width, height);
      const black = new Uint8Array(bytesPerRow * height);
      // Opaque (not transparent) black: alpha 255, matching every writer.
      for (let row = 0; row < height; row += 1) {
        const base = row * bytesPerRow;
        for (let col = 0; col < width; col += 1) black[base + col * 4 + 3] = 255;
      }
      this.device.queue.writeTexture(
        { texture: this.outputTexture, origin: { x, y } },
        black,
        { bytesPerRow, rowsPerImage: height },
        [width, height, 1],
      );
    }

    /**
     * Main-thread fallback for cropped frames: CPU-compose the cropped tiles
     * (the GPU composer targets the full-size output texture and cannot
     * offset), then paste like the runner paths. Cropped frames are smaller,
     * so the CPU feathering pass stays cheap.
     */
    private writeCroppedComposedResult(tiled: TiledInferenceResult, crop: ContentRect): boolean {
      // Single full-cover tile: the compose fast lane needs no accumulator or
      // weight buffers, so only acquire the RGBA pack buffer (see
      // writeComposedResult).
      if (isSingleFullCoverTile(tiled)) {
        const composed = composeTileResults(tiled);
        const tightRowBytes = composed.width * 4;
        const rgbaBuffer = this.pool.acquire(tightRowBytes * composed.height);
        try {
          const rgba = rgbPlanarToPaddedRgba(
            composed.rgb, composed.width, composed.height, tightRowBytes, new Uint8Array(rgbaBuffer),
          );
          this.presentCroppedResult(rgba, composed.width, composed.height, crop, 0, 0);
        } finally {
          this.pool.release(rgbaBuffer);
        }
        return false;
      }
      const outPixels = tiled.outWidth * tiled.outHeight;
      const accumulatorBuffer = this.pool.acquire(3 * outPixels * 4);
      const weightSumBuffer = this.pool.acquire(outPixels * 4);
      try {
        const composed = composeTileResults(
          tiled,
          new Float32Array(accumulatorBuffer),
          new Float32Array(weightSumBuffer),
        );
        const tightRowBytes = composed.width * 4;
        const rgbaBuffer = this.pool.acquire(tightRowBytes * composed.height);
        try {
          const rgba = rgbPlanarToPaddedRgba(
            composed.rgb, composed.width, composed.height, tightRowBytes, new Uint8Array(rgbaBuffer),
          );
          // Session path: always full 4x content, never transport-downscaled.
          this.presentCroppedResult(rgba, composed.width, composed.height, crop, 0, 0);
        } finally {
          this.pool.release(rgbaBuffer);
        }
        return false;
      } finally {
        this.pool.release(accumulatorBuffer);
        this.pool.release(weightSumBuffer);
      }
    }

    private writeResult(planarRgb: Float32Array, width: number, height: number): void {
      // Full-frame write (see writeRgbaResult): any previously filled bars
      // are painted over, so the bar geometry must be forgotten.
      this.cropBarsKey = null;
      // The worker can be disabled mid-life (timeout give-up) after the output
      // texture was allocated target-sized for transport downscaling, while the
      // main-thread session always produces the full 4x frame. Stretch into the
      // actual output geometry instead of failing writeTexture validation per
      // frame until the next rebuild.
      if (width !== this.outputWidth || height !== this.outputHeight) {
        this.writePrimeFromPlanar(planarRgb, width, height);
        return;
      }
      const { bytesPerRow } = planUpload(width, height);
      // writeTexture copies the data into the queue synchronously, so the
      // pooled upload buffer is safe to release as soon as the call returns.
      const uploadBuffer = this.pool.acquire(bytesPerRow * height);
      try {
        const padded = rgbPlanarToPaddedRgba(planarRgb, width, height, bytesPerRow, new Uint8Array(uploadBuffer));
        this.device.queue.writeTexture(
          { texture: this.outputTexture },
          padded,
          { bytesPerRow, rowsPerImage: height },
          [width, height, 1],
        );
      } finally {
        this.pool.release(uploadBuffer);
      }
    }

    private writePrimeFromPlanar(planarRgb: Float32Array, width: number, height: number): void {
      // POLICY NOTE — this helper serves two DIFFERENT callers:
      //   1. the first-frames black-frame safety net (drain, pre-inference);
      //   2. a silent nearest-neighbor quality downgrade on mid-life
      //      geometry mismatch (writeResult: a 4x session result meeting a
      //      target-sized texture after the runner died). Keep the two
      //      policies in mind when touching the stretch math.
      // p8: the output texture may be target-sized (host box-averages the
      // transport); the prime must fill exactly that geometry or the first
      // writeTexture would fail validation against a smaller texture.
      const outW = this.outputWidth;
      const outH = this.outputHeight;
      const { bytesPerRow } = planUpload(outW, outH);
      const uploadBuffer = this.pool.acquire(bytesPerRow * outH);
      try {
        const padded = new Uint8Array(uploadBuffer);
        // Nearest-neighbor stretch from planar float [0..1] -> padded RGBA8.
        // Cheap enough to run every frame until inference lands; the GPU prime
        // is the preferred path, this is just the black-frame safety net.
        const srcPixels = width * height;
        const sxScale = width / outW;
        const syScale = height / outH;
        for (let y = 0; y < outH; y += 1) {
          const srcY = Math.min(height - 1, (y * syScale) | 0);
          const srcRow = srcY * width;
          const dstOff = y * bytesPerRow;
          for (let x = 0; x < outW; x += 1) {
            const srcX = Math.min(width - 1, (x * sxScale) | 0);
            const srcIdx = srcRow + srcX;
            const r = Math.round(Math.min(1, Math.max(0, planarRgb[srcIdx])) * 255);
            const g = Math.round(Math.min(1, Math.max(0, planarRgb[srcIdx + srcPixels])) * 255);
            const b = Math.round(Math.min(1, Math.max(0, planarRgb[srcIdx + 2 * srcPixels])) * 255);
            const o = dstOff + x * 4;
            padded[o] = r; padded[o + 1] = g; padded[o + 2] = b; padded[o + 3] = 255;
          }
        }
        this.device.queue.writeTexture(
          { texture: this.outputTexture },
          padded,
          { bytesPerRow, rowsPerImage: outH },
          [outW, outH, 1],
        );
      } finally {
        this.pool.release(uploadBuffer);
      }
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
        () => this.gpuComposer?.destroy(),
        () => this.downscaleTexture?.destroy(),
        ...this.stagingBuffers.map(buffer => () => buffer.destroy()),
        () => this.outputTexture.destroy(),
      ];
      for (const release of releases) {
        try {
          release();
        } catch (error) {
          console.warn('[RealESRGAN] Pipeline cleanup failed:', error);
        }
      }
      this.gpuComposer = null;
    }

    public getSkippedFrames(): number {
      // Frames the video produced while inference was busy (scheduler gaps),
      // completed results discarded because a newer frame had already
      // presented (claimPresentation refusals), plus backlog veterans bailed
      // before inference (stale-skips). The scheduler's own droppedResults
      // is deliberately NOT used: its "newest submitted" watermark fires for
      // frames this pipeline actually presented whenever an older job
      // finishes before a newer one (routine at depth 2).
      return this.scheduler.skippedFrames + this.presentedDropped + this.staleSkippedFrames;
    }
  };
}

