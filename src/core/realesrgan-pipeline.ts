/**
 * RealESRGAN ONNX inference pipeline.
 *
 * Bridges the synchronous `Anime4KPipeline.pass(encoder)` contract with the
 * asynchronous ONNX inference path. Each frame, `pass()` encodes a GPU
 * readback of the input texture into a staging buffer. After the renderer
 * submits, the staging buffer is mapped, the frame runs through the ONNX
 * model (tiled), and the upscaled result is written back into a stable output
 * texture that the presentation pass samples.
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
import { RealEsrganBufferPool } from '../shared/realesrgan-buffer-pool';
import { RealEsrganFrameScheduler } from '../shared/realesrgan-pacing';
import { planReadback, unpackReadbackToPlanarRgb, type ReadbackFormat } from '../shared/realesrgan-readback';
import {
  composeTileResults,
  inferTiledResults,
  rgbPlanarToPaddedRgba,
  type TiledInferenceResult,
} from '../shared/realesrgan-tensor';
import { RealEsrganGpuComposer } from './realesrgan-compose';
import type { RealEsrganInferenceRunner } from './realesrgan-worker-client';
import type { Anime4KPipeline, PipelineConstructor } from './pipeline-types';

export interface RealEsrganTilingConfig {
  maxTileSize: number;
  overlap: number;
  singleTileMaxHeight: number;
}

export const DEFAULT_REALESRGAN_TILING: RealEsrganTilingConfig = {
  maxTileSize: 512,
  overlap: 32,
  singleTileMaxHeight: 576,
};

const COPY_BYTES_PER_ROW_ALIGNMENT = 256;

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
  output.position = vec4f(positions[index], 0.0, 0.0);
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
 * Optional offload binding: when a worker client is available, tile inference
 * runs in the worker instead of the main-thread session. `modelUrl` is the
 * extension URL of the model file the worker should load (the worker has no
 * chrome.* APIs, so the URL must be resolved by the caller).
 */
export interface RealEsrganWorkerBinding {
  runner: RealEsrganInferenceRunner;
  modelUrl: string;
}

export function createRealEsrganPipelineClass(
  session: InferenceSession,
  tiling: RealEsrganTilingConfig = DEFAULT_REALESRGAN_TILING,
  worker: RealEsrganWorkerBinding | null = null,
): PipelineConstructor {
  return class RealEsrganPipeline implements Anime4KPipeline {
    private readonly device: GPUDevice;
    private readonly inputTexture: GPUTexture;
    private readonly outputTexture: GPUTexture;
    private readonly stagingBuffer: GPUBuffer;
    private readonly readbackFormat: ReadbackFormat;
    private readonly readbackBytesPerRow: number;
    private readonly readbackByteLength: number;
    private readonly scheduler = new RealEsrganFrameScheduler();
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
    private readonly downscaleTexture: GPUTexture | null = null;
    private readonly downscalePipeline: GPURenderPipeline | null = null;
    private readonly downscaleBindGroup: GPUBindGroup | null = null;
    // GPU tile composer; null when compute is unavailable. The CPU
    // feathering pass remains the fallback and the correctness reference.
    // Mutable so a broken composer can be disabled at runtime.
    private gpuComposer: RealEsrganGpuComposer | null;
    // Worker offload binding; null on Firefox or when the worker failed to
    // start. Mutable so a broken worker can be disabled at runtime, falling
    // back to the main-thread session for good (same pattern as gpuComposer).
    private workerRunner: RealEsrganInferenceRunner | null;
    private readonly workerModelUrl: string | null;
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
    private phaseSnapshot: {
      readbackMs: number;
      inferMs: number;
      composeMs: number;
      workerPct: number;
      gpuComposePct: number;
    } | null = null;

    constructor({ device, inputTexture, params }: PipelineDescriptor) {
      this.device = device;
      this.inputTexture = inputTexture;
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
        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
          ],
        });
        this.downscalePipeline = device.createRenderPipeline({
          label: 'RealESRGAN downscale',
          layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
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
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) },
            { binding: 1, resource: this.inputTexture.createView() },
          ],
        });
      }

      const plan = planReadback(this.inferenceWidth, this.inferenceHeight, this.readbackFormat);
      this.readbackBytesPerRow = plan.bytesPerRow;
      this.readbackByteLength = plan.byteLength;
      this.stagingBuffer = device.createBuffer({
        label: 'RealESRGAN readback staging',
        size: Math.max(1, plan.byteLength),
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      this.outputTexture = device.createTexture({
        label: 'RealESRGAN output',
        size: [this.inferenceWidth * 4, this.inferenceHeight * 4, 1],
        format: 'rgba8unorm',
        // STORAGE_BINDING lets the GPU composer write the composed result
        // directly; TEXTURE_BINDING + COPY_DST keep the presentation pass
        // sampling and the CPU fallback's writeTexture path working.
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING,
      });
      // Opportunistic: when compute is unavailable (Firefox WASM build,
      // validation failure) this returns null and the CPU composer stays in
      // charge. The GPU path is a pure optimization, never a correctness
      // dependency.
      this.gpuComposer = RealEsrganGpuComposer.tryCreate(device, this.outputTexture);
      this.workerRunner = worker?.runner ?? null;
      this.workerModelUrl = worker?.modelUrl ?? null;
    }

    public updateParam(): void {
      // RealESRGAN has no runtime-tunable parameters. The renderer may invoke
      // this generically across effects, so it must be a safe no-op rather
      // than a throw (which would crash the frame loop).
    }

    public pass(encoder: GPUCommandEncoder): void {
      if (this.destroyed) return;
      this.frameCounter += 1;
      const frame = this.frameCounter;
      // Ask the scheduler before recording the frame: shouldProcess() gates on
      // "no inference in flight", then noteNewerFrame() records the frame and
      // counts it as skipped when one is. The scheduler owns the in-flight
      // slot; the pipeline keeps no separate busy flag.
      const canStart = this.scheduler.shouldProcess(frame);
      this.scheduler.noteNewerFrame(frame);
      if (!canStart) return; // latest-frame-wins: keep presenting the last result

      this.scheduler.markStarted(frame);
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
        { buffer: this.stagingBuffer, bytesPerRow: this.readbackBytesPerRow },
        [this.inferenceWidth, this.inferenceHeight, 1],
      );
      // The renderer submits this encoder synchronously right after every
      // pass() call returns. Registering onSubmittedWorkDone() now would track
      // only work submitted *before* this call, missing our copy. Defer to a
      // microtask so the registration lands after the renderer's submit(), at
      // which point the promise covers the copy and resolves once it has run.
      queueMicrotask(() => {
        void this.device.queue.onSubmittedWorkDone().then(() => this.drain(frame));
      });
    }

    private async drain(frame: number): Promise<void> {
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
        await this.stagingBuffer.mapAsync(GPUMapMode.READ);
        if (this.destroyed) return;
        const mapped = new Uint8Array(readbackBytes);
        try {
          // The mapped range is only valid until unmap(); copy it out first.
          mapped.set(new Uint8Array(this.stagingBuffer.getMappedRange()));
        } finally {
          this.stagingBuffer.unmap();
        }
        tCopy = performance.now() - t1;
        t1 = performance.now();

        const inputRgb = new Float32Array(inputRgbBuffer);
        unpackReadbackToPlanarRgb(mapped, this.inferenceWidth, this.inferenceHeight, this.readbackFormat, inputRgb);
        tUnpack = performance.now() - t1;
        t1 = performance.now();

        const tiled = await inferTiledResults({
          inputRgb,
          width: this.inferenceWidth,
          height: this.inferenceHeight,
          maxTileSize: tiling.maxTileSize,
          overlap: tiling.overlap,
          singleTileMaxHeight: tiling.singleTileMaxHeight,
          infer: (tileRgb, tileWidth, tileHeight) => {
            // Record worker-vs-main-thread once per frame, based on the
            // first tile. Later tiles in the same frame follow the same path.
            if (!inferWasWorker) {
              inferWasWorker = this.workerRunner !== null;
            }
            return this.runInference(tileRgb, tileWidth, tileHeight);
          },
        });
        tKernel = performance.now() - t1;

        if (this.destroyed) return;
        if (this.scheduler.isResultCurrent(frame)) {
          t1 = performance.now();
          composeUsedGpu = this.writeComposedResult(tiled);
          tCompose = performance.now() - t1;
          if (!composeUsedGpu) {
            // writeTexture happened inside writeComposedResult's CPU branch.
            // We can't separate compose from upload post-hoc without more
            // instrumentation; for the CPU path the two are short, so
            // report them together as "compose+upload".
            tUpload = 0;
          }
        }
      } catch (error) {
        // A lost device or a failed inference must not wedge the frame loop;
        // count it and release the slot so the next frame can retry.
        this.inferenceErrors += 1;
        console.warn('[RealESRGAN] inference failed; retrying on next frame', error);
      } finally {
        this.pool.release(readbackBytes);
        this.pool.release(inputRgbBuffer);
        this.scheduler.markCompleted(frame);
        this.recordPhaseSample(tCopy, tUnpack, tKernel, tCompose, tUpload, composeUsedGpu, inferWasWorker);
      }
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
    public getPhaseStats(): {
      readbackMs: number;
      inferMs: number;
      composeMs: number;
      workerPct: number;
      gpuComposePct: number;
    } | null {
      const a = this.phaseAccumulator;
      if (!a || a.n === 0) return this.phaseSnapshot;
      const snapshot = {
        // Readback = GPU→CPU mapped-range copy + RGBA→planar unpack; both are
        // paid by the readback side of the pipeline, before inference starts.
        readbackMs: (a.c + a.r) / a.n,
        inferMs: a.k / a.n,
        // Compose time on whichever path ran; the overlay treats `composeMs`
        // as "time spent producing the output texture" regardless of GPU/CPU.
        composeMs: (Math.max(a.g, a.m)) / a.n,
        workerPct: (a.workerCount / a.n) * 100,
        gpuComposePct: (a.gpuComposeCount / a.n) * 100,
      };
      this.phaseSnapshot = snapshot;
      this.phaseAccumulator = null;
      return snapshot;
    }

    /**
     * Compose the inferred tiles into the output texture. Prefers the GPU
     * compute composer; falls back to the CPU feathering pass when the
     * composer is unavailable, declines the frame, or throws.
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

    private async runInference(tileRgb: Float32Array, tileWidth: number, tileHeight: number): Promise<Float32Array> {
      if (this.workerRunner && this.workerModelUrl) {
        try {
          return await this.workerRunner.run(this.workerModelUrl, tileWidth, tileHeight, tileRgb);
        } catch (error) {
          // A broken worker (terminated, timed out) must not drop the frame:
          // disable it for good and fall through to the main-thread session.
          console.warn('[RealESRGAN] worker inference failed; using main-thread session', error);
          this.workerRunner = null;
        }
      }
      const { Tensor: OrtTensor } = await import(/* webpackChunkName: "ort" */ 'onnxruntime-web');
      const inputName = session.inputNames[0] ?? 'input';
      const outputName = session.outputNames[0] ?? 'output';
      const input = new OrtTensor('float32', tileRgb, [1, 3, tileHeight, tileWidth]);
      const outputs = await session.run({ [inputName]: input as Tensor });
      const result = outputs[outputName];
      if (!result) throw new Error('RealESRGAN inference returned no output tensor.');
      return result.data as Float32Array;
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

    public getOutputTexture(): GPUTexture {
      return this.outputTexture;
    }

    public getSkippedFrames(): number {
      // Frames the video produced while inference was busy, plus completed
      // results discarded because a newer frame had already arrived. Both are
      // "frames the user did not see processed" and belong in the stats.
      return this.scheduler.skippedFrames + this.scheduler.droppedResults;
    }
  };
}
