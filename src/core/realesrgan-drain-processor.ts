/**
 * The RealESRGAN drain orchestration, extracted from `RealEsrganPipeline`.
 *
 * One `drain(claim, frame)` call owns the per-frame decision sequence:
 * map the staging readback, unpack it, decide/apply the letterbox crop,
 * evaluate the still-frame hold, run the one-shot color diagnostic and CPU
 * prime fallback, pick the inference path (native/worker/session), dispatch
 * to the `RealEsrganInferenceCoordinator`, and present through the
 * `RealEsrganOutputWriter`. The stale-skip gates and the staging-slot release
 * discipline live here too, because they bracket exactly this sequence.
 *
 * The pipeline stays the owner of the renderer-facing state and the GPU
 * resources; the processor reaches them through the narrow
 * `RealEsrganDrainHost` seam (like `FrameGenerationHost`). The processor
 * keeps only the truly drain-local state: the presented-result provenance
 * (`lastServedNative`) and nothing else — all counters, buffers, the phase
 * accumulator, the color-diagnostic flags and the frame-job watermark stay
 * pipeline-owned and are read/updated through the host, so no mutable state
 * is duplicated across the seam.
 */
import type { RealEsrganBufferPool } from '../shared/realesrgan-buffer-pool';
import { adaptiveRealEsrganTiling } from '../shared/realesrgan-tile-geometry.js';
import { unpackReadback, unpackReadbackToPlanarRgb, copyMappedRange, type ReadbackFormat } from '../shared/realesrgan-readback';
import { inferTiledResults } from '../shared/realesrgan-tensor';
import { cropPlanarRect, cropRgbaRect, type LetterboxTracker } from '../shared/realesrgan-letterbox';
import type { StillframeTracker } from '../shared/realesrgan-stillframe';
import {
  decideFrameContent,
  planCropGeometry,
  shouldHoldPresentedResult,
  stillframeGeometryKey,
} from '../shared/realesrgan-frame-decision';
import { planInferenceInput, selectRunnerPath } from '../shared/realesrgan-inference-path';
import { withRealEsrganCode, REALESRGAN_ERROR_CODES } from '../shared/realesrgan-error-codes';
import type { RealEsrganOutputWriter } from './realesrgan-output-writer';
import type { RealEsrganStagingClaim } from './realesrgan-staging-slots';
import type { RealEsrganFrameResult, RealEsrganInferenceRunner } from './realesrgan-worker-client';
import type { RealEsrganModelAssets } from './realesrgan-model-assets';
import type { RealEsrganExecutionConfig } from './realesrgan-session';
import type { RealEsrganInferenceCoordinator } from './realesrgan-inference-coordinator';

/**
 * Hang guard: a wedged GPU (mapAsync never settling) must not park staging
 * slots forever — fail fast into the transient retry budget instead. E2E
 * showed slots wedging mid-run with the pipeline limping at ~0 fps and no
 * further errors.
 */
const MAP_ASYNC_TIMEOUT_MS = 8000;

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
 * Fixed per-pipeline geometry/identity the drain reads, plus the accessors
 * and hooks into pipeline-owned mutable state. Everything here has exactly
 * one owner (the pipeline); the drain neither caches nor duplicates it.
 */
export interface RealEsrganDrainHost {
  readonly readbackFormat: ReadbackFormat;
  readonly readbackByteLength: number;
  readonly inferenceWidth: number;
  readonly inferenceHeight: number;
  readonly transportTargetWidth: number;
  readonly transportTargetHeight: number;
  readonly pool: RealEsrganBufferPool;
  readonly cropTracker: LetterboxTracker;
  readonly stillTracker: StillframeTracker;
  readonly outputWriter: RealEsrganOutputWriter;
  readonly modelAssets: RealEsrganModelAssets | null;
  readonly execution: RealEsrganExecutionConfig | null;
  readonly tiling: { maxTileSize: number; overlap: number; singleTileMaxHeight: number };
  getRunner(): RealEsrganInferenceRunner | null;
  isDestroyed(): boolean;
  isFirstResultLanded(): boolean;
  markFirstResultLanded(): void;
  /** True when `frame` trails the newest in-flight work by more than `threshold`. */
  shouldStaleSkip(frame: number, threshold: number): boolean;
  /** Frame-job presentation watermark (monotonic over what was presented). */
  claimPresentation(frame: number): boolean;
  /** Count one completed-but-superseded result (never presented). */
  notePresentedDropped(): void;
  /** Count a backlog veteran bailed before inference (both stale-skip exits). */
  noteStaleSkipped(): void;
  /** Release the staging slot after unmap() on every exit path. */
  releaseStagingClaim(claim: RealEsrganStagingClaim): void;
  /**
   * Pipeline-owned phase accumulator: the drain supplies one sample per
   * frame that actually inferred (held/stale frames are skipped by the
   * caller so their zero timings cannot pollute the window).
   */
  recordPhaseSample(
    tCopy: number, tUnpack: number, tKernel: number,
    tCompose: number, tUpload: number,
    composeUsedGpu: boolean, inferUsedRunner: boolean, servedNative: boolean,
    servedWorkerFp16: boolean,
  ): void;
  /** One-shot color diagnostic of the inference input (no-op once done). */
  logInputColorDiag(planarRgb: Float32Array): void;
  /** One-shot color diagnostic of the runner output (no-op once done). */
  logOutputColorDiag(result: RealEsrganFrameResult): void;
  /** Pipeline-owned error recovery: counters, context-loss and fatal hooks. */
  handleInferenceError(error: unknown, stage: string): void;
}

export class RealEsrganDrainProcessor {
  // Provenance of the presented result for overlay stats and the still-frame
  // hold gate: true when the last presented frame came from the native client
  // (tight-RGBA call), false for ORT worker/main. Read/written only by drain.
  private lastServedNative = false;

  constructor(
    private readonly host: RealEsrganDrainHost,
    private readonly inference: RealEsrganInferenceCoordinator,
  ) {}

  async drain(claim: RealEsrganStagingClaim, frame: number): Promise<void> {
    const host = this.host;
    // Early stale-skip (same rule as the pre-fetch check below): a drain
    // that starts while 7+ newer frames are already submitted is usually a
    // post-hitch backlog veteran — its bytes would die in
    // claimPresentation anyway. Bailing before pool.acquire keeps deep
    // recovery bursts from churning pooled buffers for nothing.
    if (host.isFirstResultLanded() && !host.isDestroyed()
        && host.shouldStaleSkip(frame, STALE_SKIP_BEHIND)) {
      host.noteStaleSkipped();
      // This return sits BEFORE the try/finally below, so release the
      // staging slot here — otherwise the skip itself leaks it.
      host.releaseStagingClaim(claim);
      return;
    }
    const pixels = host.inferenceWidth * host.inferenceHeight;
    // The native runner POSTs RGBA8 anyway: when it offers the fast path
    // (and the source is already 8-bit), skip the planar-float roundtrip
    // and hand tight bytes over. The planar form is still needed until the
    // first result lands (CPU prime fallback) and for the one-shot color
    // diagnostic, so early frames always take the slow path.
    const useFastRgba = planInferenceInput({
      hasRunner: host.getRunner() !== null,
      hasModelUrl: host.modelAssets !== null,
      rgbaCapable: typeof host.getRunner()?.runFrameRgba === 'function',
      readbackRgba8: host.readbackFormat === 'rgba8unorm',
      primed: host.isFirstResultLanded(),
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
      readbackBytes = host.pool.acquire(host.readbackByteLength);
      inputRgbBuffer = useFastRgba ? null : host.pool.acquire(3 * pixels * 4);
      tightRgbaBuffer = useFastRgba ? host.pool.acquire(4 * pixels) : null;
      drainStage = 'map';
      await Promise.race([
        claim.buffer.mapAsync(GPUMapMode.READ),
        new Promise<never>((_, reject) => setTimeout(() => reject(withRealEsrganCode(
          new Error(`RealESRGAN readback map timed out after ${MAP_ASYNC_TIMEOUT_MS}ms`),
          REALESRGAN_ERROR_CODES.PIPELINE_INFER_RETRY,
        )), MAP_ASYNC_TIMEOUT_MS)),
      ]);
      if (host.isDestroyed()) return;
      const mapped = new Uint8Array(readbackBytes);
      try {
        // The mapped range is only valid until unmap(); copy it out first.
        // copyMappedRange survives cross-compartment ranges (parent-process
        // shared memory throws on plain view construction in Firefox).
        drainStage = 'copy';
        copyMappedRange(claim.buffer.getMappedRange(), mapped);
      } finally {
        claim.buffer.unmap();
      }
      tCopy = performance.now() - t1;
      t1 = performance.now();

      drainStage = 'unpack';
      let inputRgb: Float32Array | null = null;
      let tightRgba: Uint8Array | null = null;
      if (useFastRgba && tightRgbaBuffer) {
        tightRgba = unpackReadback(mapped, host.inferenceWidth, host.inferenceHeight, host.readbackFormat, new Uint8Array(tightRgbaBuffer));
      } else if (inputRgbBuffer) {
        inputRgb = new Float32Array(inputRgbBuffer);
        unpackReadbackToPlanarRgb(mapped, host.inferenceWidth, host.inferenceHeight, host.readbackFormat, inputRgb);
      } else {
        throw new Error('RealESRGAN drain has no input buffer for the active path.');
      }
      tUnpack = performance.now() - t1;

      // Hebel 1.1: letterbox content rect — the decision chain (verify →
      // reset → poll → observe → snap) lives in the Frame-Entscheidung
      // module; the drain only slices buffers and dispatches.
      drainStage = 'crop';
      const fullW = host.inferenceWidth;
      const fullH = host.inferenceHeight;
      const { crop, cropActive } = decideFrameContent({
        width: fullW,
        height: fullH,
        tightRgba,
        planar: inputRgb,
        cropTracker: host.cropTracker,
        transportTargetWidth: host.transportTargetWidth,
        transportTargetHeight: host.transportTargetHeight,
      });

      // Slice the crop out of the unpacked input (pooled; released below).
      const geometry = planCropGeometry(
        crop, fullW, fullH, host.transportTargetWidth, host.transportTargetHeight,
      );
      const inferW = geometry.inferWidth;
      const inferH = geometry.inferHeight;
      const targetW = geometry.targetWidth;
      const targetH = geometry.targetHeight;
      let inferPlanar = inputRgb;
      let inferRgba = tightRgba;
      if (cropActive) {
        if (tightRgba) {
          cropRgbaBuffer = host.pool.acquire(inferW * inferH * 4);
          inferRgba = cropRgbaRect(tightRgba, fullW, fullH, crop, new Uint8Array(cropRgbaBuffer));
        } else if (inputRgb) {
          cropPlanarBuffer = host.pool.acquire(3 * inferW * inferH * 4);
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
        stillTracker: host.stillTracker,
        hashBytes,
        geometryKey: stillframeGeometryKey(inferW, inferH, crop),
        firstResultLanded: host.isFirstResultLanded(),
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
      // pure diagnostic module; the one-shot flags stay pipeline-owned. The
      // input half is safe to run unconditionally: the fast RGBA path only
      // starts after the first result landed (primed gate), so the first
      // frame always has planar input.
      drainStage = 'diag-prime';
      if (inputRgb) host.logInputColorDiag(inputRgb);
      // CPU prime fallback: until the first inference result lands the
      // canvas would be black if the GPU prime silently failed (validation
      // error, empty source at first frame). Upscale the *just-unpacked*
      // frame on the CPU and push it to the output texture so the user
      // sees the plain video instead of black, even before inference.
      // (Planar-only: the fast path starts after the first result lands.)
      if (inputRgb && !host.isFirstResultLanded() && !host.isDestroyed()) {
        try {
          host.outputWriter.writePrimeFrame(inputRgb, host.inferenceWidth, host.inferenceHeight);
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
      if (host.isFirstResultLanded() && !host.isDestroyed()
          && host.shouldStaleSkip(frame, STALE_SKIP_BEHIND)) {
        host.noteStaleSkipped();
        staleSkipped = true;
        return;
      }
      t1 = performance.now();

      drainStage = 'infer';
      // Runner dispatch rides the path selector: it owns which input form
      // each path accepts and hands narrowed buffers back, so drain cannot
      // mismatch path and input. Both throw sites keep their messages.
      const runnerPath = selectRunnerPath({
        runner: host.getRunner(),
        modelUrl: host.modelAssets?.dynamicUrl ?? null,
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
        const modelAssets = host.modelAssets;
        if (!modelAssets) {
          throw new Error('RealESRGAN runner binding has no model assets.');
        }
        const frameModelUrl = modelAssets.urlForShape(inferW, inferH);
        let result: RealEsrganFrameResult;
        if (runnerPath.kind === 'runner-rgba') {
          result = await this.inference.runNativeRgbaFrame(frameModelUrl, runnerPath.rgba, inferW, inferH, targetW, targetH);
        } else {
          // The worker only probes its fp16 model when the execution config
          // prefers fp16 (auto-selected per device/EP; OFF until ORT-web's
          // fp16 kernels stop failing on the Clip WGSL — otherwise the
          // probe burns a session attempt plus a timed-out frame per shape).
          // INT8 never reaches the worker — QDQ has no WebGPU kernels in
          // ORT-web 1.29, so the worker lane stays FP32 and int8 serves
          // through the main-thread WASM session below.
          const fp16Url = host.execution?.preferFloat16 ? modelAssets.fp16Url : null;
          result = await this.inference.runWorkerInference(frameModelUrl, fp16Url, runnerPath.planar, inferW, inferH, targetW, targetH);
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
        if (host.isDestroyed()) return;
        // Always present the result, even if newer frames arrived while inferring.
        // The old "drop stale if newer frame seen" froze the output to the first
        // frame when inference (70ms) is slower than video interval (16ms) - every
        // result was considered stale and dropped.
        t1 = performance.now();
        // Hebel 2.4: at depth 2 a newer frame may already have presented
        // while this one was in flight — then its bytes stay off the
        // canvas (monotonic presentation), but timings still record. The
        // watermark is the frame-job runner's claimPresentation.
        drainStage = 'present';
        if (host.claimPresentation(frame)) {
          if (cropActive) {
            host.outputWriter.presentCroppedResult(result.data, expW, expH, crop, targetW, targetH);
          } else {
            host.outputWriter.writeRgbaResult(result.data, result.width, result.height);
          }
          servedNative = inferRgba !== null;
          servedWorkerFp16 = result.precision === 'fp16';
          this.lastServedNative = servedNative;
          host.markFirstResultLanded();
        } else {
          // Completed but superseded: a newer frame already presented.
          // Counted here because the frame-job runner's watermark is the
          // only "completed but unseen" predicate the pipeline trusts.
          host.notePresentedDropped();
        }
        tCompose = performance.now() - t1;
        host.logOutputColorDiag(result);
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
          ...adaptiveRealEsrganTiling(inferW, inferH, host.tiling),
          infer: (tileRgb, tileWidth, tileHeight) => this.inference.runSessionInference(tileRgb, tileWidth, tileHeight),
        });
        tKernel = performance.now() - t1;
        if (host.isDestroyed()) return;
        // Same fix as worker path: always present, don't drop stale
        // (see comment above).
        t1 = performance.now();
        drainStage = 'present';
        if (host.claimPresentation(frame)) {
          if (cropActive) {
            composeUsedGpu = host.outputWriter.writeCroppedComposedResult(tiled, crop);
          } else {
            composeUsedGpu = host.outputWriter.writeComposedResult(tiled);
          }
          servedNative = false;
          this.lastServedNative = false;
          host.markFirstResultLanded();
        } else {
          host.notePresentedDropped();
        }
        tCompose = performance.now() - t1;
      } else {
        throw new Error(runnerPath.hasRunnerBinding
          ? 'RealESRGAN drain has no inference input for the active path.'
          : 'RealESRGAN drain has no planar input for the main-thread path.');
      }
    } catch (error) {
      // A lost device or a failed inference must not wedge the frame loop;
      // the pipeline counts it and releases the slot so the next frame can
      // retry. Destroyed pipelines stay silent (the host's handler decides).
      // The finally below still releases pool buffers and the slot.
      host.handleInferenceError(error, drainStage);
    } finally {
      if (readbackBytes) host.pool.release(readbackBytes);
      if (inputRgbBuffer) host.pool.release(inputRgbBuffer);
      if (tightRgbaBuffer) host.pool.release(tightRgbaBuffer);
      if (cropPlanarBuffer) host.pool.release(cropPlanarBuffer);
      if (cropRgbaBuffer) host.pool.release(cropRgbaBuffer);
      // Held still-frames carry no inference: sampling their zeros would
      // drag inferMs/composeMs toward 0 for the whole overlay window.
      if (!heldPresented && !staleSkipped) {
        host.recordPhaseSample(tCopy, tUnpack, tKernel, tCompose, tUpload, composeUsedGpu, inferUsedRunner, servedNative, servedWorkerFp16);
      }
      // Release the staging slot AFTER unmap() has run on every path. The
      // buffer is unmapped in the try block above (finally around the
      // mapped-range copy); if we never got there, mapAsync failed and
      // there is nothing mapped anyway. Either way the slot is reusable.
      host.releaseStagingClaim(claim);
    }
  }
}
