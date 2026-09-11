/**
 * The RealESRGAN Runner seam: the minimal inference contract the pipeline
 * depends on, decoupled from every adapter's transport machinery.
 *
 * The worker client (ORT in a blob worker) and the native Vulkan HTTP client
 * are the two adapters behind this seam; the Runner-Broker picks between them
 * and tests stub the interface. Everything a caller must know lives here:
 *
 * - Entry points. `runFrame` accepts planar NCHW RGB ([1,3,h,w]); the
 *   returned frame is tightly packed RGBA8 with its ACTUAL dimensions.
 *   `runFrameRgba` is the optional tight-RGBA fast path (only the native
 *   host offers it — it POSTs RGBA8 anyway); callers only test whether the
 *   member exists, they never inspect the concrete class.
 * - Capabilities. `maxInFlight` declares how many runFrame calls the adapter
 *   overlaps (native: 8, worker/session: absent = 1, because of ORT's global
 *   output-buffer cache). `supportsTargetDownscale` declares whether the
 *   adapter box-averages the result down to `targetWidth/targetHeight` before
 *   returning (native host: true, worker: absent). `kind` is the explicit
 *   adapter identity (native vs worker) so health/broker policy stops
 *   inferring it from a rendering capability. `maxFrameDim` is the adapter's
 *   hard input limit when it has one (native host: 4096); absent = unbounded.
 *   Absent capabilities mean "not offered", never "probe the concrete class".
 * - Model parameters. `modelUrl`/`modelUrlFp16` name the model asset for
 *   this frame (resolved by the Modell-Auswahl, realesrgan-model-assets).
 *   Only session-backed adapters consume them; the native host has its
 *   model baked in and ignores both. `modelUrlFp16` may be null.
 * - Buffer discipline. The caller owns the input buffer and may reuse or
 *   free it as soon as the call returns; an adapter that still needs the
 *   bytes in flight must copy them (the pooled pipeline buffers are reused
 *   every frame). Results are fresh buffers owned by the caller.
 * - Lifetime. Runners are process-lifetime singletons owned by the
 *   Runner-Broker and shared across pipeline instances; callers must not
 *   dispose them. Teardown belongs to the adapter classes themselves (each
 *   cleans up its own create-failure path).
 */
import type { RealEsrganPrecision } from '../types';

export interface RealEsrganFrameResult {
  data: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  /**
   * Precision that served this frame. Set by the ORT worker from its reply
   * (fp16 model URL won or not); absent on the native client, whose model
   * is baked into the host. The pipeline counts fp16 worker frames for the
   * overlay label — unknown counts as fp32.
   */
  precision?: RealEsrganPrecision;
}

/** Explicit adapter identity, replacing capability duck-typing. */
export type RealEsrganRunnerKind = 'worker' | 'native';

export interface RealEsrganInferenceRunner {
  runFrame(
    modelUrl: string,
    modelUrlFp16: string | null,
    width: number,
    height: number,
    data: Float32Array,
    targetWidth?: number,
    targetHeight?: number,
  ): Promise<RealEsrganFrameResult>;
  /**
   * Optional fast path: tightly packed RGBA8 straight in, skipping the
   * planar-float roundtrip. Bit-identical output for opaque video.
   */
  runFrameRgba?(
    modelUrl: string,
    width: number,
    height: number,
    data: Uint8Array,
    targetWidth?: number,
    targetHeight?: number,
  ): Promise<RealEsrganFrameResult>;
  readonly maxInFlight?: number;
  /**
   * Adapter box-averages the 4x result down to the requested target.
   * Kept for pipeline.ts's transport-downscale read; batch B migrates that
   * read onto `kind`/`maxFrameDim`. New policy code must not use it as
   * adapter identity.
   */
  readonly supportsTargetDownscale?: boolean;
  /** Explicit adapter identity for health/broker policy. */
  readonly kind?: RealEsrganRunnerKind;
  /** Hard input limit in pixels per axis (native host) or absent if none. */
  readonly maxFrameDim?: number;
  /**
   * Diagnostics hook: adapters that produce per-frame path labels fire it
   * (once per distinct value). Assigning it on an adapter that never fires
   * is harmless.
   */
  onFramePath?: ((path: string) => void) | null;
}
