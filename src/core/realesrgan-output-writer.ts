/**
 * The RealESRGAN output-writing family, extracted from `RealEsrganPipeline`.
 *
 * Everything that mutates the persistent output texture lives here: the
 * black-frame prime pass, the planar/RGBA full-frame writes, the GPU/CPU
 * compose result writes, the crop paste plus bar fill, and the two
 * nearest-neighbor stretch fallbacks. The pipeline stays the coordinator
 * (pass/afterSubmit/drain decisions, scheduler, staging slots); this module
 * owns only the pixels-to-texture side, so that side can be unit-tested
 * through a narrow GPU port with a fake.
 *
 * Bar-geometry memory (`cropBarsKey`) and the consecutive-crop-skip budget
 * move with the writers because they only make sense next to the paste logic.
 * `presentedDropped` and `firstResultLanded` stay pipeline-owned; the writer
 * reaches them through the host callbacks so one counter has one owner.
 */
import type { RealEsrganBufferPool } from '../shared/realesrgan-buffer-pool';
import { planUpload } from '../shared/realesrgan-readback';
import { contentRectKey, type ContentRect } from '../shared/realesrgan-letterbox';
import { decideCropPaste } from '../shared/realesrgan-frame-decision';
import {
  composeTileResults,
  isSingleFullCoverTile,
  rgbPlanarToPaddedRgba,
  type TiledInferenceResult,
} from '../shared/realesrgan-tensor';
import type { RealEsrganGpuComposer } from './realesrgan-compose';
import type { PipelineGpuDevice } from './pipeline-types';

/**
 * Inference failures without a single successful result after which the
 * pipeline reports a fatal failure. Lowered to 4 so a stalled worker / lost
 * context degrades to plain video after ~20s instead of showing a black/static
 * canvas for half a minute. Also the threshold for a persistent crop-geometry
 * mismatch escalation (see presentCroppedResult).
 */
export const FATAL_INFERENCE_FAILURES = 4;

/**
 * What the writer needs from the pipeline. The output texture, geometry and
 * pool are per-pipeline constants; the callbacks are the few pieces of
 * pipeline-owned mutable state that the writer must read or update.
 */
export interface RealEsrganOutputWriterHost {
  readonly device: PipelineGpuDevice;
  readonly outputTexture: GPUTexture;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly inputWidth: number;
  readonly inputHeight: number;
  readonly inferenceWidth: number;
  readonly inferenceHeight: number;
  readonly pool: RealEsrganBufferPool;
  readonly primePipeline: GPURenderPipeline;
  readonly primeBindGroup: GPUBindGroup;
  isDestroyed(): boolean;
  /** True once any inference result reached the output texture. */
  isFirstResultLanded(): boolean;
  /** Count one completed-but-superseded result (never presented). */
  notePresentedDropped(): void;
}

/**
 * Owns the persistent output texture writes and the GPU composer's lifecycle.
 */
export class RealEsrganOutputWriter {
  // GPU tile composer for the main-thread fallback path; null when compute is
  // unavailable or the composer was retired. Owned here because only these
  // writers use it; the pipeline hands it in at construction (null in tests).
  private composer: RealEsrganGpuComposer | null;
  // Consecutive GPU-compose throws; retires the composer at 3 so a
  // permanently broken composer warns once instead of every frame.
  private gpuComposeFailures = 0;
  private primed = false;
  // Output-space key the bars were last filled for (null = never). The output
  // texture persists, so bar fills happen once per geometry.
  private cropBarsKey: string | null = null;
  // Consecutive unpresentable crop results (see presentCroppedResult):
  // escalates into the fatal budget so a persistent geometry mismatch still
  // fails over instead of skipping forever.
  private consecutiveCropSkips = 0;

  constructor(
    private readonly host: RealEsrganOutputWriterHost,
    composer: RealEsrganGpuComposer | null,
  ) {
    this.composer = composer;
  }

  /**
   * Upscale the CURRENT source frame into the output texture with a bilinear
   * pass so the canvas shows a soft image instead of transparent black. Runs
   * on the first pass() and, until the first inference result has landed, on
   * every frame after that: a device/context loss or a wedged worker
   * otherwise leaves the canvas permanently black. Failures are non-fatal;
   * the texture just keeps its previous content.
   */
  public primeOutputTexture(encoder: GPUCommandEncoder, frameCounter: number): void {
    if (this.host.isDestroyed()) return;
    if (this.primed && this.host.isFirstResultLanded()) return;
    this.primed = true;
    try {
      // Log once so e2e can confirm the prime path was taken and with which
      // dimensions (helps diagnose silent validation failures).
      if (frameCounter <= 2) {
        console.info('[RealESRGAN] priming output', this.host.outputTexture.width, 'x', this.host.outputTexture.height,
          'from', this.host.inputWidth, 'x', this.host.inputHeight, 'fmt', this.host.outputTexture.format);
      }
      this.host.device.pushErrorScope('validation');
      try {
        const renderPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.host.outputTexture.createView(),
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: 'store',
          }],
        });
        renderPass.setPipeline(this.host.primePipeline);
        renderPass.setBindGroup(0, this.host.primeBindGroup);
        renderPass.draw(6);
        renderPass.end();
      } finally {
        // Always pop the scope: a sync throw above must not leak it, and a
        // device-loss rejection must not surface as unhandled.
        void this.host.device.popErrorScope().then(error => {
          if (error) console.warn('[RealESRGAN] prime validation error:', error.message);
        }, () => undefined);
      }
    } catch (error) {
      console.warn('[RealESRGAN] output texture priming failed; first frames may be black', error);
    }
  }

  // The writer does not own the input texture; the host exposes its
  // dimensions so the prime log can name the source size.

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
  public writeComposedResult(tiled: TiledInferenceResult): boolean {
    if (this.composer) {
      try {
        if (this.composer.compose(tiled.tiles, tiled.outWidth, tiled.outHeight, tiled.featherWindow)) {
          this.gpuComposeFailures = 0;
          return true;
        }
      } catch (error) {
        // Per-frame failure (oversize allocation beyond the binding limit,
        // lost device): fall back to CPU for THIS frame but keep the composer
        // alive — retiring it on one huge frame would permanently downgrade
        // every later (small) frame. A permanently broken composer (lost
        // device) retires after consecutive failures instead of warning on
        // every frame forever; device recovery rebuilds the whole pipeline
        // (composer included) anyway.
        this.gpuComposeFailures += 1;
        if (this.gpuComposeFailures >= 3) {
          console.warn('[RealESRGAN] GPU compose failed repeatedly; retiring the composer', error);
          try {
            this.composer.destroy();
          } catch {
            // Release best-effort (see destroy()).
          }
          this.composer = null;
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
    const accumulatorBuffer = this.host.pool.acquire(3 * outPixels * 4);
    const weightSumBuffer = this.host.pool.acquire(outPixels * 4);
    try {
      const composed = composeTileResults(
        tiled,
        new Float32Array(accumulatorBuffer),
        new Float32Array(weightSumBuffer),
      );
      this.writeResult(composed.rgb, composed.width, composed.height);
      return false;
    } finally {
      this.host.pool.release(accumulatorBuffer);
      this.host.pool.release(weightSumBuffer);
    }
  }

  public writeRgbaResult(rgba: Uint8Array<ArrayBuffer>, width: number, height: number): void {
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
  private writeRgbaSubview(rgba: Uint8Array<ArrayBuffer>, width: number, height: number, ox: number, oy: number): void {
    const { bytesPerRow } = planUpload(width, height);
    const tightRowBytes = width * 4;
    const origin = { x: ox, y: oy };
    if (bytesPerRow === tightRowBytes) {
      // writeTexture copies the data into the queue synchronously; no
      // staging buffer needed on the tight path (common case).
      this.host.device.queue.writeTexture(
        { texture: this.host.outputTexture, origin },
        rgba,
        { bytesPerRow, rowsPerImage: height },
        [width, height, 1],
      );
      return;
    }
    // writeTexture copies the data into the queue synchronously, so the
    // pooled upload buffer is safe to release as soon as the call returns.
    const uploadBuffer = this.host.pool.acquire(bytesPerRow * height);
    try {
      const padded = new Uint8Array(uploadBuffer);
      for (let row = 0; row < height; row += 1) {
        padded.set(rgba.subarray(row * tightRowBytes, (row + 1) * tightRowBytes), row * bytesPerRow);
      }
      this.host.device.queue.writeTexture(
        { texture: this.host.outputTexture, origin },
        padded,
        { bytesPerRow, rowsPerImage: height },
        [width, height, 1],
      );
    } finally {
      this.host.pool.release(uploadBuffer);
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
   * `targetWidth/targetHeight` are the transport target the caller sent with
   * this inference (0 = full 4x): the result bytes must match them exactly.
   */
  public presentCroppedResult(
    rgba: Uint8Array<ArrayBuffer>,
    width: number,
    height: number,
    crop: ContentRect,
    targetWidth: number,
    targetHeight: number,
  ): void {
    const outW = this.host.outputWidth;
    const outH = this.host.outputHeight;
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
    const decision = decideCropPaste(
      crop, this.host.inferenceWidth, this.host.inferenceHeight, outW, outH, rw, rh,
    );
    if (decision.kind === 'skip') {
      this.host.notePresentedDropped();
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
    const key = `${this.host.outputWidth}x${this.host.outputHeight}:${contentRectKey(crop)}`;
    if (this.cropBarsKey === key) return;
    const outW = this.host.outputWidth;
    const outH = this.host.outputHeight;
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
    this.host.device.queue.writeTexture(
      { texture: this.host.outputTexture, origin: { x, y } },
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
  public writeCroppedComposedResult(tiled: TiledInferenceResult, crop: ContentRect): boolean {
    // Single full-cover tile: the compose fast lane needs no accumulator or
    // weight buffers, so only acquire the RGBA pack buffer (see
    // writeComposedResult).
    if (isSingleFullCoverTile(tiled)) {
      const composed = composeTileResults(tiled);
      const tightRowBytes = composed.width * 4;
      const rgbaBuffer = this.host.pool.acquire(tightRowBytes * composed.height);
      try {
        const rgba = rgbPlanarToPaddedRgba(
          composed.rgb, composed.width, composed.height, tightRowBytes, new Uint8Array(rgbaBuffer),
        );
        this.presentCroppedResult(rgba, composed.width, composed.height, crop, 0, 0);
      } finally {
        this.host.pool.release(rgbaBuffer);
      }
      return false;
    }
    const outPixels = tiled.outWidth * tiled.outHeight;
    const accumulatorBuffer = this.host.pool.acquire(3 * outPixels * 4);
    const weightSumBuffer = this.host.pool.acquire(outPixels * 4);
    try {
      const composed = composeTileResults(
        tiled,
        new Float32Array(accumulatorBuffer),
        new Float32Array(weightSumBuffer),
      );
      const tightRowBytes = composed.width * 4;
      const rgbaBuffer = this.host.pool.acquire(tightRowBytes * composed.height);
      try {
        const rgba = rgbPlanarToPaddedRgba(
          composed.rgb, composed.width, composed.height, tightRowBytes, new Uint8Array(rgbaBuffer),
        );
        // Session path: always full 4x content, never transport-downscaled.
        this.presentCroppedResult(rgba, composed.width, composed.height, crop, 0, 0);
      } finally {
        this.host.pool.release(rgbaBuffer);
      }
      return false;
    } finally {
      this.host.pool.release(accumulatorBuffer);
      this.host.pool.release(weightSumBuffer);
    }
  }

  public writeResult(planarRgb: Float32Array, width: number, height: number): void {
    // Full-frame write (see writeRgbaResult): any previously filled bars
    // are painted over, so the bar geometry must be forgotten.
    this.cropBarsKey = null;
    // The worker can be disabled mid-life (timeout give-up) after the output
    // texture was allocated target-sized for transport downscaling, while the
    // main-thread session always produces the full 4x frame. Stretch into the
    // actual output geometry instead of failing writeTexture validation per
    // frame until the next rebuild.
    if (width !== this.host.outputWidth || height !== this.host.outputHeight) {
      this.writeStretchedFallback(planarRgb, width, height);
      return;
    }
    const { bytesPerRow } = planUpload(width, height);
    // writeTexture copies the data into the queue synchronously, so the
    // pooled upload buffer is safe to release as soon as the call returns.
    const uploadBuffer = this.host.pool.acquire(bytesPerRow * height);
    try {
      const padded = rgbPlanarToPaddedRgba(planarRgb, width, height, bytesPerRow, new Uint8Array(uploadBuffer));
      this.host.device.queue.writeTexture(
        { texture: this.host.outputTexture },
        padded,
        { bytesPerRow, rowsPerImage: height },
        [width, height, 1],
      );
    } finally {
      this.host.pool.release(uploadBuffer);
    }
  }

  /**
   * Black-frame safety net: the pre-inference CPU prime. Until the first
   * inference result lands the output texture would otherwise stay
   * transparent black if the GPU prime silently failed (validation error,
   * empty source at the first frame). Nearest-neighbor is fine here — this
   * is a temporary placeholder, not a quality path.
   */
  public writePrimeFrame(planarRgb: Float32Array, width: number, height: number): void {
    this.stretchNearestNeighbor(planarRgb, width, height);
  }

  /**
   * Mid-life nearest-neighbor downgrade: a full 4x session result meeting a
   * target-sized output texture after the runner died (see writeResult).
   * Distinct from the black-frame safety net because the intent differs —
   * this is a deliberate, silent quality downgrade that keeps a live canvas
   * instead of failing writeTexture validation per frame until a rebuild.
   */
  private writeStretchedFallback(planarRgb: Float32Array, width: number, height: number): void {
    this.stretchNearestNeighbor(planarRgb, width, height);
  }

  /**
   * Nearest-neighbor stretch from planar float [0..1] into the output
   * texture's actual geometry, as padded RGBA8. Shared by the black-frame
   * safety net and the mid-life downgrade; the two callers keep their
   * intent in their own named entry points.
   */
  private stretchNearestNeighbor(planarRgb: Float32Array, width: number, height: number): void {
    // p8: the output texture may be target-sized (host box-averages the
    // transport); the write must fill exactly that geometry or writeTexture
    // would fail validation against a smaller texture.
    const outW = this.host.outputWidth;
    const outH = this.host.outputHeight;
    const { bytesPerRow } = planUpload(outW, outH);
    const uploadBuffer = this.host.pool.acquire(bytesPerRow * outH);
    try {
      const padded = new Uint8Array(uploadBuffer);
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
      this.host.device.queue.writeTexture(
        { texture: this.host.outputTexture },
        padded,
        { bytesPerRow, rowsPerImage: outH },
        [outW, outH, 1],
      );
    } finally {
      this.host.pool.release(uploadBuffer);
    }
  }

  public destroy(): void {
    try {
      this.composer?.destroy();
    } catch {
      // Release best-effort: a lost device may already have freed it.
    }
    this.composer = null;
  }
}
