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
import type { RealEsrganPhaseStats } from '../types';
import { RealEsrganBufferPool } from '../shared/realesrgan-buffer-pool';
import { adaptiveRealEsrganTiling } from '../shared/realesrgan-tiling';
import { RealEsrganFrameScheduler } from '../shared/realesrgan-pacing';
import { planReadback, unpackReadbackToPlanarRgb, type ReadbackFormat } from '../shared/realesrgan-readback';
import {
  composeTileResults,
  inferTiledResults,
  rgbPlanarToPaddedRgba,
  type TiledInferenceResult,
} from '../shared/realesrgan-tensor';
import { RealEsrganGpuComposer } from './realesrgan-compose';
import type { RealEsrganInferenceRunner, RealEsrganFrameResult } from './realesrgan-worker-client';
import { isRealEsrganFloat16Preferred, isRealEsrganInt8Preferred } from './realesrgan-session';
import { RealEsrganFrameJobRunner } from './realesrgan-frame-job';
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
  // paths place tiles and feather identically. singleTileMaxHeight matches
  // the adaptive cap for 512px tiles for the same reason.
  overlap: 24,
  singleTileMaxHeight: 512,
};

const COPY_BYTES_PER_ROW_ALIGNMENT = 256;

/**
 * Consecutive worker timeouts tolerated before the pipeline gives up on the
 * worker and falls back to the main-thread session. A single timeout on a
 * busy system (first-run shader compile, background load) is transient; the
 * main-thread fallback is strictly worse (slower, and session.run can hang
 * without a timeout), so it is a last resort.
 */
const WORKER_TIMEOUT_GIVE_UP_AFTER = 3;

/**
 * Inference failures without a single successful result after which the
 * pipeline reports a fatal failure. Lowered to 4 so a stalled worker / lost
 * context degrades to plain video after ~20s instead of showing a black/static
 * canvas for half a minute.
 */
const FATAL_INFERENCE_FAILURES = 4;

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
 * Optional offload binding: when a worker client is available, the whole
 * frame runs in the worker instead of the main-thread session. `modelUrl` and
 * `modelUrlFp16` are extension URLs of the model files the worker should load
 * (the worker has no chrome.* APIs, so the URLs must be resolved by the
 * caller). `modelUrlFp16` is optional; the worker falls back to `modelUrl`
 * when the FP16 asset is missing or fails to create a session.
 */
export interface RealEsrganWorkerBinding {
  runner: RealEsrganInferenceRunner;
  modelUrl: string;
  modelUrlFp16?: string | null;
}

export function createRealEsrganPipelineClass(
  session: InferenceSession | null,
  tiling: RealEsrganTilingConfig = DEFAULT_REALESRGAN_TILING,
  worker: RealEsrganWorkerBinding | null = null,
  getSession: ((width: number, height: number) => Promise<InferenceSession>) | null = null,
): PipelineConstructor {
  return class RealEsrganPipeline implements Anime4KPipeline {
    private readonly device: GPUDevice;
    private readonly inputTexture: GPUTexture;
    private readonly outputTexture: GPUTexture;
    private readonly stagingBuffers: GPUBuffer[];
    private readonly stagingBufferCount = 2;
    // Slot ownership: true = claimed by pass() (encoded copy pending or
    // mapped in drain()), false = free. Cleared at the end of drain().
    private readonly slotStates: boolean[];
    private readbackSlot = 0;
    private readonly readbackFormat: ReadbackFormat;
    private readonly readbackBytesPerRow: number;
    private readonly readbackByteLength: number;
    private readonly scheduler = new RealEsrganFrameScheduler();
    private readonly frameJobs = new RealEsrganFrameJobRunner(this.scheduler);
    // Fallback session is per-instance state. It must not live in the factory
    // closure: the loader builds the class once and shares it across videos,
    // so a second video's warmup would overwrite the first video's session.
    private fallbackSession: InferenceSession | null;
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
    // reference. Mutable so a broken composer can be disabled at runtime.
    private gpuComposer: RealEsrganGpuComposer | null;
    // Worker offload binding; null on Firefox when the worker file is missing
    // or the worker failed to start. Mutable so a broken worker can be
    // disabled at runtime, falling back to the main-thread session for good
    // (same pattern as gpuComposer).
    private workerRunner: RealEsrganInferenceRunner | null;
    private readonly workerModelUrl: string | null;
    private readonly workerModelUrlFp16: string | null;
    private workerUsedForFrame = false;
    private workerTimeouts = 0;
    private frameCounter = 0;
    private inferenceErrors = 0;
    private destroyed = false;
    // The renderer reads the most recent stat window via `getPhaseStats()` and
    // ships it in `RenderStats.realesrgan`, which feeds the live-stats overlay
    // when `statsEnabled` is on. Aggregation window is owned by the renderer
    // (it already emits RenderStats every 500ms), so we keep two snapshots:
    // the previous (read-only) and the currently accumulating one. Reset is
    // driven by `consumePhaseStats()` from the renderer.
    private phaseAccumulator: {
      n: number;
      c: number; r: number; k: number;
      g: number; m: number; u: number;
      workerCount: number;
      gpuComposeCount: number;
    } | null = null;
    private phaseSnapshot: RealEsrganPhaseStats | null = null;
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
      const canDownscale = Boolean(worker?.runner && (worker.runner as { supportsTargetDownscale?: boolean }).supportsTargetDownscale);
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
      this.workerRunner = worker?.runner ?? null;
      this.fallbackSession = session;
      // Warm the main-thread fallback session for THIS pipeline's inference
      // shape when no runner serves frames. The session cache is keyed by
      // shape, so this prebuild pays the ORT session cost once per size
      // instead of stalling the first frame. Fire-and-forget: the drain path
      // awaits the same cached promise and surfaces errors there.
      if (!this.fallbackSession && !this.workerRunner && getSession) {
        const warmWidth = this.inferenceWidth;
        const warmHeight = this.inferenceHeight;
        void getSession(warmWidth, warmHeight).then(
          (created) => { this.fallbackSession = created; },
          (error) => {
            console.warn('[RealESRGAN] fallback session warmup failed; first frame will build it', error);
          },
        );
      }
      this.workerModelUrl = worker?.modelUrl ?? null;
      this.workerModelUrlFp16 = worker?.modelUrlFp16 ?? null;
      // Log the composition path the worker reports (once per distinct value)
      // so the console tells us whether frames come from the GPU compose or a
      // CPU fallback without any debugger wiring.
      if (this.workerRunner && 'onFramePath' in this.workerRunner) {
        (this.workerRunner as { onFramePath: ((path: string) => void) | null }).onFramePath = path => {
          console.info('[RealESRGAN] worker composition path:', path);
        };
      }
    }

    public updateParam(): void {
      // RealESRGAN has no runtime-tunable parameters. The renderer may invoke
      // this generically across effects, so it must be a safe no-op rather
      // than a throw (which would crash the frame loop).
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
        void this.device.popErrorScope().then(error => {
          if (error) console.warn('[RealESRGAN] prime validation error:', error.message);
        });
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
      // "no inference in flight", then noteNewerFrame() records the frame and
      // counts it as skipped when one is. The scheduler owns the in-flight
      // slot; the pipeline keeps no separate busy flag.
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
        this.scheduler.noteNewerFrame(frame);
        return;
      }
      this.slotStates[slot] = true;
      this.readbackSlot = (slot + 1) % slotCount;
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
      // The renderer submits this encoder synchronously right after every
      // pass() call returns. Registering onSubmittedWorkDone() now would track
      // only work submitted *before* this call, missing our copy. Defer to a
      // microtask so the registration lands after the renderer's submit(), at
      // which point the promise covers the copy and resolves once it has run.
      queueMicrotask(() => {
        void this.device.queue.onSubmittedWorkDone().then(() => {
          const submitted = this.frameJobs.submit({
            frame,
            capture: async () => stagingBuffer,
            infer: captured => this.drain(captured as GPUBuffer, frame),
            publish: () => undefined,
          });
          if (!submitted) {
            // Skipped (inference busy): no drain will run, so free the slot now.
            // Without this the pipeline leaks slots and wedges into "no free slot"
            // after 2 frames, freezing the output to the first frame.
            this.slotStates[slot] = false;
          }
        }).catch(() => {
          // Device lost or queue error: the copy never completed, so drain()
          // will never run to release the slot. Free it here so the pipeline
          // does not wedge into \"no free slot\" after 2 frames. The scheduler
          // still needs to know this frame was skipped.
          this.slotStates[slot] = false;
          this.scheduler.noteNewerFrame(frame);
        });
      });
    }

    private async drain(stagingBuffer: GPUBuffer, frame: number): Promise<void> {
      // Locate the slot this staging buffer occupies so the ownership claim
      // can be released when the mapped read is done. The release lives in a
      // finally so a failed mapAsync (device loss, destroyed) can never leak
      // a claimed slot and wedge the pipeline into "no free slot" forever.
      const slotIndex = this.stagingBuffers.indexOf(stagingBuffer);
      const pixels = this.inferenceWidth * this.inferenceHeight;
      // Acquire the readback and model-input buffers up front; the (large)
      // composition buffers are only needed on the CPU fallback path and are
      // acquired lazily there, so the GPU path keeps less pooled memory hot.
      const readbackBytes = this.pool.acquire(this.readbackByteLength);
      const inputRgbBuffer = this.pool.acquire(3 * pixels * 4);
      // Phase timings: always on. The arithmetic is cheap (a `performance.now`
      // and four additions per frame), and the live-stats overlay is the
      // primary UI for understanding inference cost. `getPhaseStats()` returns
      // null until at least one frame has been measured.
      let tCopy = 0, tUnpack = 0, tKernel = 0, tCompose = 0, tUpload = 0;
      let composeUsedGpu = false;
      let inferWasWorker = false;
      let t1 = performance.now();
      try {
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        if (this.destroyed) return;
        const mapped = new Uint8Array(readbackBytes);
        try {
          // The mapped range is only valid until unmap(); copy it out first.
          mapped.set(new Uint8Array(stagingBuffer.getMappedRange()));
        } finally {
          stagingBuffer.unmap();
        }
        tCopy = performance.now() - t1;
        t1 = performance.now();

        const inputRgb = new Float32Array(inputRgbBuffer);
        unpackReadbackToPlanarRgb(mapped, this.inferenceWidth, this.inferenceHeight, this.readbackFormat, inputRgb);
        tUnpack = performance.now() - t1;
        // One-shot color diagnostic (405p report): compare inference input vs
        // runner output channel stats on the first frame so a tint/shift can
        // be attributed to one side of the transport.
        if (!this.colorDiagDone && !this.colorDiagOutputDone && !this.destroyed) {
          this.colorDiagDone = true;
          try {
            const iw = this.inferenceWidth;
            const ih = this.inferenceHeight;
            const px = iw * ih;
            let ir = 0, ig = 0, ib = 0, irg = 0;
            const y0 = Math.floor(ih * 0.3);
            const y1 = Math.floor(ih * 0.7);
            const x0 = Math.floor(iw * 0.3);
            const x1 = Math.floor(iw * 0.7);
            let n = 0;
            for (let y = y0; y < y1; y += 1) {
              for (let x = x0; x < x1; x += 1) {
                const p = y * iw + x;
                const cr = inputRgb[p];
                const cg = inputRgb[p + px];
                const cb = inputRgb[p + 2 * px];
                ir += cr; ig += cg; ib += cb; irg += Math.abs(cr - cg); n += 1;
              }
            }
            console.log(
              '[RealESRGAN] colordiag in=%dx%d mean=%.3f/%.3f/%.3f rgdiff=%.4f',
              iw, ih, ir / n, ig / n, ib / n, irg / n,
            );
          } catch (e) {
            console.warn('[RealESRGAN] colordiag input failed', e);
          }
        }
        // CPU prime fallback: until the first inference result lands the
        // canvas would be black if the GPU prime silently failed (validation
        // error, empty source at first frame). Upscale the *just-unpacked*
        // frame on the CPU and push it to the output texture so the user
        // sees the plain video instead of black, even before inference.
        if (!this.firstResultLanded && !this.destroyed) {
          try {
            this.writePrimeFromPlanar(inputRgb, this.inferenceWidth, this.inferenceHeight);
          } catch (e) {
            console.warn('[RealESRGAN] CPU prime fallback failed', e);
          }
        }
        t1 = performance.now();

        if (this.workerRunner && this.workerModelUrl) {
          // Worker path: the whole frame goes out; the runner plans tiles,
          // runs inference and packs the result. What comes back is tightly
          // packed RGBA8 with its actual dimensions - runners may box-average
          // to the presentation target (native host, worker target); the
          // length check below enforces the actual size either way.
          inferWasWorker = true;
          this.workerUsedForFrame = true;
          const result = await this.runWorkerInference(inputRgb);
          const expectedLength = this.outputWidth * this.outputHeight * 4;
          if (result.data.length !== expectedLength
              || result.width !== this.outputWidth || result.height !== this.outputHeight) {
            throw new Error(`RealESRGAN runner returned ${result.width}x${result.height} `
              + `(${result.data.length} bytes); expected ${this.outputWidth}x${this.outputHeight} (${expectedLength}).`);
          }
          tKernel = performance.now() - t1;
          if (this.destroyed) return;
          // Always present the result, even if newer frames arrived while inferring.
          // The old "drop stale if newer frame seen" froze the output to the first
          // frame when inference (70ms) is slower than video interval (16ms) - every
          // result was considered stale and dropped. Count for stats but still show.
          this.scheduler.isResultCurrent(frame);
          t1 = performance.now();
          this.writeRgbaResult(result.data, result.width, result.height);
          this.firstResultLanded = true;
          tCompose = performance.now() - t1;
          if (this.colorDiagDone && !this.colorDiagOutputDone) {
            // Second half of the one-shot color diagnostic: channel stats of
            // the runner output. Runs once by consuming the output flag here.
            this.colorDiagOutputDone = true;
            try {
              const ow = result.width;
              const oh = result.height;
              const d = result.data;
              let or = 0, og = 0, ob = 0, org = 0;
              const y0 = Math.floor(oh * 0.3);
              const y1 = Math.floor(oh * 0.7);
              const x0 = Math.floor(ow * 0.3);
              const x1 = Math.floor(ow * 0.7);
              let n = 0;
              for (let y = y0; y < y1; y += 2) {
                for (let x = x0; x < x1; x += 2) {
                  const o = (y * ow + x) * 4;
                  const cr = d[o] / 255;
                  const cg = d[o + 1] / 255;
                  const cb = d[o + 2] / 255;
                  or += cr; og += cg; ob += cb; org += Math.abs(cr - cg); n += 1;
                }
              }
              console.log(
                '[RealESRGAN] colordiag out=%dx%d mean=%.3f/%.3f/%.3f rgdiff=%.4f',
                ow, oh, or / n, og / n, ob / n, org / n,
              );
            } catch (e) {
              console.warn('[RealESRGAN] colordiag output failed', e);
            }
          }
        } else {
          // Main-thread session path: tiled inference plus GPU/CPU compose,
          // unchanged from the pre-worker pipeline.
          const tiled = await inferTiledResults({
            inputRgb,
            width: this.inferenceWidth,
            height: this.inferenceHeight,
            ...adaptiveRealEsrganTiling(this.inferenceWidth, this.inferenceHeight, tiling),
            infer: (tileRgb, tileWidth, tileHeight) => this.runSessionInference(tileRgb, tileWidth, tileHeight),
          });
          tKernel = performance.now() - t1;
          if (this.destroyed) return;
          // Same fix as worker path: always present, don't drop stale
          this.scheduler.isResultCurrent(frame);
          t1 = performance.now();
          composeUsedGpu = this.writeComposedResult(tiled);
          this.firstResultLanded = true;
          tCompose = performance.now() - t1;
        }
      } catch (error) {
        // A lost device or a failed inference must not wedge the frame loop;
        // count it and release the slot so the next frame can retry.
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
          console.warn('[RealESRGAN] inference failed; retrying on next frame' + errorStack(error), error);
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
        this.pool.release(readbackBytes);
        this.pool.release(inputRgbBuffer);
        this.recordPhaseSample(tCopy, tUnpack, tKernel, tCompose, tUpload, composeUsedGpu, inferWasWorker);
        this.workerUsedForFrame = false;
        // Release the staging slot AFTER unmap() has run on every path. The
        // buffer is unmapped in the try block above (finally around the
        // mapped-range copy); if we never got there, mapAsync failed and
        // there is nothing mapped anyway. Either way the slot is reusable.
        if (slotIndex >= 0) this.slotStates[slotIndex] = false;
      }
    }

    private async runWorkerInference(inputRgb: Float32Array): Promise<RealEsrganFrameResult> {
      if (!this.workerRunner || !this.workerModelUrl) {
        throw new Error('RealESRGAN worker binding is unavailable.');
      }
      try {
        const result = await this.workerRunner.runFrame(
          this.workerModelUrl, this.workerModelUrlFp16, this.inferenceWidth, this.inferenceHeight, inputRgb,
          this.transportTargetWidth, this.transportTargetHeight,
        );
        this.workerTimeouts = 0;
        return result;
      } catch (error) {
        // A timeout may be transient (system busy, first-run shader compile
        // over budget). Give the worker N consecutive chances before falling
        // back to the main-thread session, which is slower and can hang
        // without any timeout on the same driver. Permanent errors (worker
        // gone, protocol) disable the worker immediately.
        const message = errorMessage(error);
        const transient = /timed out/i.test(message);
        this.workerTimeouts = transient ? this.workerTimeouts + 1 : Number.MAX_SAFE_INTEGER;
        if (this.workerTimeouts < WORKER_TIMEOUT_GIVE_UP_AFTER) {
          console.warn(
            '[RealESRGAN] worker inference timed out (%d/%d); retrying worker next frame',
            this.workerTimeouts, WORKER_TIMEOUT_GIVE_UP_AFTER, error,
          );
          throw error;
        }
        // A broken worker must not drop the frame: disable it for good and
        // fall back to the main-thread session on the next frame. The session
        // may not exist yet (it is only built when the worker was unavailable
        // at load time) - resolve it lazily here so the fallback works.
        console.warn('[RealESRGAN] worker inference failed; disabling worker, main-thread session takes over', error);
        this.workerRunner = null;
        if (!this.fallbackSession && getSession) {
          this.fallbackSession = await getSession(this.inferenceWidth, this.inferenceHeight);
        }
        throw error;
      }
    }

    private async runSessionInference(tileRgb: Float32Array, tileWidth: number, tileHeight: number): Promise<Float32Array> {
      if (!this.fallbackSession && getSession) {
        this.fallbackSession = await getSession(this.inferenceWidth, this.inferenceHeight);
      }
      const fallback = this.fallbackSession;
      if (!fallback) throw new Error('RealESRGAN main-thread fallback session is unavailable.');
      const { Tensor: OrtTensor } = await import(/* webpackChunkName: "ort" */ 'onnxruntime-web');
      const inputName = fallback.inputNames[0] ?? 'input';
      const outputName = fallback.outputNames[0] ?? 'output';
      // FP16 model when registered and preferred; the FP32 model stays the
      // quality reference. Both models expose float32 I/O.
      const input = new OrtTensor('float32', tileRgb, [1, 3, tileHeight, tileWidth]);
      const outputs = await fallback.run({ [inputName]: input as Tensor });
      const result = outputs[outputName];
      if (!result) throw new Error('RealESRGAN inference returned no output tensor.');
      return result.data as Float32Array;
    }

    private recordPhaseSample(
      tCopy: number, tUnpack: number, tKernel: number,
      tCompose: number, tUpload: number,
      composeUsedGpu: boolean, inferWasWorker: boolean,
    ): void {
      const a = this.phaseAccumulator ?? {
        n: 0, c: 0, r: 0, k: 0, g: 0, m: 0, u: 0,
        workerCount: 0, gpuComposeCount: 0,
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
      if (inferWasWorker) a.workerCount += 1;
      if (composeUsedGpu) a.gpuComposeCount += 1;
      this.phaseAccumulator = a;
    }

    /**
     * Average phase timings over the window since the last call. The renderer
     * pulls this once per stats emit (every 500ms) and resets the accumulator.
     * Returns null when no frames have been measured yet, so the overlay can
     * fall back to the basic FPS/renderMs line.
     */
    public getPhaseStats(): RealEsrganPhaseStats | null {
      const a = this.phaseAccumulator;
      if (!a || a.n === 0) {
        if (!this.phaseSnapshot) return null;
        return { ...this.phaseSnapshot, count: 0, enhancedFps: 0 };
      }
      const snapshot: RealEsrganPhaseStats = {
        // Readback = GPU→CPU mapped-range copy + RGBA→planar unpack; both are
        // paid by the readback side of the pipeline, before inference starts.
        readbackMs: (a.c + a.r) / a.n,
        inferMs: a.k / a.n,
        // Compose time on whichever path ran; the overlay treats `composeMs`
        // as "time spent producing the output texture" regardless of GPU/CPU.
        composeMs: (a.g + a.m) / a.n,
        workerPct: (a.workerCount / a.n) * 100,
        gpuComposePct: (a.gpuComposeCount / a.n) * 100,
        precision: (isRealEsrganInt8Preferred() ? 'int8' : isRealEsrganFloat16Preferred() ? 'fp16' : 'fp32') as 'fp32' | 'fp16' | 'int8',
        count: a.n,
        enhancedFps: 0,
      };
      this.phaseSnapshot = snapshot;
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
            return true;
          }
        } catch (error) {
          // A broken composer (lost device, validation) must not drop the
          // frame: disable it for good and fall through to the CPU path.
          console.warn('[RealESRGAN] GPU compose failed; using CPU composer', error);
          this.gpuComposer.destroy();
          this.gpuComposer = null;
        }
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
        this.writeResult(composed.rgb, composed.width, composed.height);
        return false;
      } finally {
        this.pool.release(accumulatorBuffer);
        this.pool.release(weightSumBuffer);
      }
    }

    private writeRgbaResult(rgba: Uint8Array, width: number, height: number): void {
      const tightRowBytes = width * 4;
      const bytesPerRow = Math.ceil(tightRowBytes / COPY_BYTES_PER_ROW_ALIGNMENT)
        * COPY_BYTES_PER_ROW_ALIGNMENT;
      // writeTexture copies the data into the queue synchronously, so the
      // pooled upload buffer is safe to release as soon as the call returns.
      const uploadBuffer = this.pool.acquire(bytesPerRow * height);
      try {
        if (bytesPerRow === tightRowBytes) {
          this.device.queue.writeTexture(
            { texture: this.outputTexture },
            rgba,
            { bytesPerRow, rowsPerImage: height },
            [width, height, 1],
          );
        } else {
          const padded = new Uint8Array(uploadBuffer);
          for (let row = 0; row < height; row += 1) {
            padded.set(rgba.subarray(row * tightRowBytes, (row + 1) * tightRowBytes), row * bytesPerRow);
          }
          this.device.queue.writeTexture(
            { texture: this.outputTexture },
            padded,
            { bytesPerRow, rowsPerImage: height },
            [width, height, 1],
          );
        }
      } finally {
        this.pool.release(uploadBuffer);
      }
    }

    private writeResult(planarRgb: Float32Array, width: number, height: number): void {
      const tightRowBytes = width * 4;
      const bytesPerRow = Math.ceil(tightRowBytes / COPY_BYTES_PER_ROW_ALIGNMENT)
        * COPY_BYTES_PER_ROW_ALIGNMENT;
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
      // p8: the output texture may be target-sized (host box-averages the
      // transport); the prime must fill exactly that geometry or the first
      // writeTexture would fail validation against a smaller texture.
      const outW = this.outputWidth;
      const outH = this.outputHeight;
      const tightRowBytes = outW * 4;
      const bytesPerRow = Math.ceil(tightRowBytes / COPY_BYTES_PER_ROW_ALIGNMENT)
        * COPY_BYTES_PER_ROW_ALIGNMENT;
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
      // The worker client is SHARED across all RealESRGAN pipeline instances
      // (see pipeline-loader.ts). Destroying it here would poison the shared
      // promise: the next pipeline (e.g. after a resolution change rebuild)
      // would receive a disposed client and permanently fall back to the
      // main-thread WASM session. The worker outlives individual pipelines
      // and caches its sessions per model+resolution; it is only terminated
      // when the content script itself tears down.
      this.gpuComposer?.destroy();
      this.gpuComposer = null;
      this.downscaleTexture?.destroy();
      this.stagingBuffers.forEach(buffer => buffer.destroy());
      this.outputTexture.destroy();
    }

    public getSkippedFrames(): number {
      // Frames the video produced while inference was busy, plus completed
      // results discarded because a newer frame had already arrived. Both are
      // "frames the user did not see processed" and belong in the stats.
      return this.scheduler.skippedFrames + this.scheduler.droppedResults;
    }
  };
}
