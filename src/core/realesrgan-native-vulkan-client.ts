/**
 * Native Vulkan ncnn host client for RealESRGAN (HTTP transport, p7).
 *
 * chrome.runtime.connectNative is background-only, so this content-script
 * client asks the background for the host's loopback HTTP endpoint
 * (REALESRGAN_HTTP_INFO → { port, token }) and then ships frames itself:
 * raw RGBA8 bytes in the POST body, raw RGBA8 4x bytes back. No base64,
 * no framed-JSON megaparse, no 1 MB native-messaging message limits.
 *
 * The host binds 127.0.0.1 (potentially trustworthy origin: not mixed
 * content from https pages) and authenticates via the per-process token
 * in the query string, keeping the request CORS-safelisted (no preflight).
 * A failed create() resolves null and the pipeline falls back to the
 * worker/main-thread WASM paths unchanged.
 */

import type { RealEsrganInferenceRunner, RealEsrganFrameResult } from './realesrgan-runner';
import {
  formatRealEsrganError,
  REALESRGAN_ERROR_CODES,
  realEsrganErrorCodeOf,
  withRealEsrganCode,
  type RealEsrganCodedError,
} from '../shared/realesrgan-error-codes';

const CAP_TIMEOUT_MS = 10_000;
// Wedged-host abort: healthy p90 is ~70 ms, so 6 s is pure hang insurance.
// It used to be 18 s, which parked a staging slot (and the scheduler entry)
// for the whole window once per run whenever the host wedged a request.
const FRAME_TIMEOUT_MS = 6_000;
/**
 * Host input limit, mirrored from the transport (`MAX_FRAME_DIM` in
 * http-transport.h). Exported so the pipeline can keep oversize inputs away
 * from the shared runner entirely: a per-frame rejection here would travel
 * through the Runner-Guard as "runner dead" and bury the singleton for every
 * other video. The pipeline drops a size-limited runner per instance instead.
 */
export const REALESRGAN_NATIVE_MAX_FRAME_DIM = 4096;
const MAX_DIM = REALESRGAN_NATIVE_MAX_FRAME_DIM;

interface HttpEndpointInfo {
  ok: true;
  port: number;
  token: string;
}

interface HttpEndpointFailure {
  ok: false;
  message: string;
}

function planarToRgba(planar: Float32Array, width: number, height: number): Uint8Array {
  const pixels = width * height;
  const out = new Uint8Array(pixels * 4);
  // planar layout: R plane, G plane, B plane, each cstep = width*height
  // values in [0,1] -> 0-255. Branchless pack, bit-identical to the
  // Math.round/min/max chain (see realesrgan-tensor.ts).
  for (let i = 0; i < pixels; i++) {
    const vr = planar[i]!;
    const vg = planar[i + pixels]!;
    const vb = planar[i + pixels * 2]!;
    const o = i * 4;
    out[o] = ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0;
    out[o + 1] = ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0;
    out[o + 2] = ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0;
    out[o + 3] = 255;
  }
  return out;
}

/**
 * Producer-side classification of the browser's own abort: AbortSignal.timeout
 * rejects with a DOMException whose identity (name), not its text, marks it.
 * Compartment-safe (see errorMessage discipline in the pipeline).
 */
function isFetchTimeoutError(error: unknown): boolean {
  try {
    const name = (error as { name?: unknown })?.name;
    return name === 'TimeoutError' || name === 'AbortError';
  } catch {
    return false;
  }
}

/**
 * Host-reported inference stage (native `outcome.stage`): the Linux host tags
 * `inference_failed` replies — and the matching HTTP 500 detail text — with
 * the pipeline phase that failed. Threaded onto the client's coded error so
 * diagnostics can tell upload/tile/submit apart without parsing prose.
 */
export type NativeInferenceStage = 'upload' | 'tile' | 'submit';

const NATIVE_INFERENCE_STAGES = ['upload', 'tile', 'submit'] as const;

/**
 * The host's HTTP 500 detail spells the stage as `upscale failed (upload): …`;
 * replies without a stage read `upscale failed: …`. Anything else (or an
 * unknown token) is ignored rather than guessed.
 */
export function nativeInferenceStageFromDetail(detail: string): NativeInferenceStage | null {
  const match = /upscale failed \(([^)]+)\)/.exec(detail);
  const stage = match?.[1];
  return stage !== undefined && (NATIVE_INFERENCE_STAGES as readonly string[]).includes(stage)
    ? (stage as NativeInferenceStage)
    : null;
}

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

/** Overridable primitives so tests can drive the client without a browser. */
export interface RealEsrganNativeVulkanClientOptions {
  /** Defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Defaults to the chrome.runtime background query. */
  resolveEndpoint?: () => Promise<HttpEndpointInfo | null>;
  /**
   * Hebel E4: inference backend per host process ('srvgg' = hand-written
   * Vulkan SRVGG, default 'ncnn'). Sent as &engine= on every frame; unknown
   * values fall back to ncnn host-side. Opt-in via storage (default off)
   * until the perf gates pass on more hardware than one NAVI22.
   */
  engine?: 'ncnn' | 'srvgg';
}

/**
 * Use a fetched response buffer directly when the compartment allows it,
 * cloning only when it proves hostile. Large loopback downloads can arrive
 * as cross-compartment buffers (parent-process blob path); touching them
 * throws "Permission denied to access property constructor" in Firefox.
 * The 4-byte slice probe exercises element reads and the species
 * constructor lookup hostile buffers fail on, and costs nothing on healthy
 * buffers, saving an ~8 MB copy per frame. Exported for unit tests. May
 * throw (clone of a hostile buffer can fail too); the caller then keeps
 * the raw buffer.
 */
export function rehomeResponseBuffer(raw: ArrayBuffer): ArrayBuffer {
  try {
    // slice() exercises element reads AND the species constructor lookup on
    // one cheap 4-byte probe: both throw on hostile cross-compartment
    // buffers. A bare view construction is NOT enough (E2E: the first frame
    // probed fine, then every padded-path present died on subarray with
    // "Permission denied to access property constructor").
    new Uint8Array(raw, 0, Math.min(4, raw.byteLength)).slice();
    return raw;
  } catch {
    return structuredClone(raw);
  }
}

/** Production endpoint query: asks the background for the host's HTTP endpoint. */

/**
 * Compartment-safe one-line error text for E2E logs: Firefox content
 * scripts can receive cross-compartment rejections whose property reads
 * (even String()) throw, which would mask the original failure. Never let
 * the introspection itself throw; strip parens so machine-parsed log
 * delimiters stay stable.
 */
function shortError(error: unknown): string {
  try {
    const message = (error as { message?: unknown })?.message;
    if (typeof message === 'string' && message) {
      return message.slice(0, 120).replace(/[()\r\n]+/g, ' ');
    }
  } catch { /* cross-compartment: fall through to String() */ }
  try {
    return String(error).slice(0, 120).replace(/[()\r\n]+/g, ' ');
  } catch {
    return 'unreadable cross-compartment error';
  }
}

/**
 * Belt for the native frame path: anything escaping without a failure code
 * (barrier wrappers, torn-down compartments) rides the transient budget
 * instead of killing the runner on first sight. Already-tagged errors pass
 * through untouched. Never throws itself: every read is guarded, and a
 * hostile value degrades to a fresh coded Error.
 */
function tagNativeTransient(error: unknown): Error {
  try {
    if (realEsrganErrorCodeOf(error) !== null) return error as Error;
    if (error !== null && (typeof error === 'object' || typeof error === 'function')) {
      return withRealEsrganCode(error as Error, REALESRGAN_ERROR_CODES.NATIVE_FRAME_FAILED);
    }
  } catch { /* fall through to wrap */ }
  return withRealEsrganCode(
    new Error(`native frame failed: ${shortError(error)}`),
    REALESRGAN_ERROR_CODES.NATIVE_FRAME_FAILED,
  );
}

async function queryBackgroundEndpoint(): Promise<HttpEndpointInfo | null> {
  console.info('[RealESRGAN] querying native transport endpoint from background...');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const reply = (await Promise.race([
      chrome.runtime.sendMessage({ type: 'REALESRGAN_HTTP_INFO' }),
      new Promise(resolve => { timeout = setTimeout(() => resolve('timeout'), CAP_TIMEOUT_MS); }),
    ])) as HttpEndpointInfo | HttpEndpointFailure | 'timeout' | null;
    if (reply === 'timeout') {
      console.warn(`[RealESRGAN] native transport endpoint query timed out after ${CAP_TIMEOUT_MS}ms (cold host start?)`);
      return null;
    }
    if (reply && reply.ok) {
      // Strip the Xray/cross-compartment wrapper: the reply object crossed
      // the background→content compartment boundary and Firefox throws
      // "non-unwrappable cross-compartment wrapper" when its properties
      // are read later inside template literals / fetch options.
      const clean: HttpEndpointInfo = { ok: true, port: Number(reply.port), token: String(reply.token) };
      console.info(`[RealESRGAN] native transport endpoint ready on 127.0.0.1:${clean.port}`);
      return clean;
    }
    if (reply) {
      console.info('[RealESRGAN] native Vulkan HTTP transport unavailable:', (reply as HttpEndpointFailure).message);
    } else {
      console.info('[RealESRGAN] native transport query returned no reply (background unreachable or not wired)');
    }
    return null;
  } catch (error) {
    console.info('[RealESRGAN] native Vulkan HTTP transport query failed', error);
    return null;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export class RealEsrganNativeVulkanClient implements RealEsrganInferenceRunner {
  private readonly fetchImpl: FetchLike;
  private readonly resolveEndpoint: () => Promise<HttpEndpointInfo | null>;
  private readonly engine: 'ncnn' | 'srvgg';
  private endpoint: HttpEndpointInfo | null = null;
  private endpointPromise: Promise<HttpEndpointInfo | null> | null = null;
  /** Explicit adapter identity (see RealEsrganInferenceRunner.kind). */
  public readonly kind = 'native' as const;
  public onFramePath: ((path: string) => void) | null = null;
  private disposed = false;
  private loggedPath = false;
  private frameCount = 0;
  /**
   * Request pipelining (depth 8): E2E-gated arrival census shows video
   * frames arrive in groups of ~10 every ~530 ms (headless rVFC batching),
   * not smoothly: depth 4 admits 4 per group and refuses 6 (~60% no-slot),
   * capping completions at ~10/s against a 45/s serial host. Depth 8
   * absorbs whole groups; the serial host turns 8 outstanding into ~23/s
   * completions (E2E-verified; depth 12 measured identical — the ceiling
   * is the arrival rate, not slots). Stale group members are dropped by
   * claimPresentation/stale-skip, so latest-frame-wins stays intact.
   * Browser per-origin connection queuing (6 for HTTP/1.1 keep-alive)
   * may park the 7th+ fetch briefly; that wait stays inside the group
   * period and does not cost throughput.
   */
  private inFlight = 0;
  /**
   * Hebel 2.4: public so the pipeline can size its depth from it (see
   * RealEsrganInferenceRunner.maxInFlight). The host serializes GPU work
   * with a mutex but reads the request body ahead of the upscale.
   */
  public readonly maxInFlight = 8;
  private readonly waiters: Array<() => void> = [];
  /**
   * The native host box-averages the network output down to tw/th before
   * download (p8). The worker path ignores the target; this flag lets the
   * pipeline decide whether passing it is worth anything.
   */
  public readonly supportsTargetDownscale = true;
  /**
   * Explicit input-size capability (see RealEsrganInferenceRunner.maxFrameDim):
   * the host's transport limit, mirrored above. Policy code reads this instead
   * of inferring "native" from supportsTargetDownscale.
   */
  public readonly maxFrameDim = REALESRGAN_NATIVE_MAX_FRAME_DIM;

  /**
   * Upload staging: eight rotating buffers matching maxInFlight, so an
   * in-flight POST never aliases the buffer the next frame writes. Sized
   * on demand; reallocated only when the frame geometry changes.
   */
  private readonly uploadBuffers: Array<Uint8Array | null> = [null, null, null, null, null, null, null, null];
  private uploadSlot = 0;

  private constructor(
    fetchImpl: FetchLike,
    resolveEndpoint: () => Promise<HttpEndpointInfo | null>,
    engine: 'ncnn' | 'srvgg',
  ) {
    this.fetchImpl = fetchImpl;
    this.resolveEndpoint = resolveEndpoint;
    this.engine = engine;
  }

  static async create(options: RealEsrganNativeVulkanClientOptions = {}): Promise<RealEsrganNativeVulkanClient | null> {
    // Loopback fetch from content scripts works in Chromium and Firefox;
    // the browser test page (http://127.0.0.1:4173) is http so no
    // mixed-content question arises there either. Anything unusual fails
    // closed into the WASM fallback via the null return below.
    const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    const client = new RealEsrganNativeVulkanClient(
      fetchImpl, options.resolveEndpoint ?? queryBackgroundEndpoint, options.engine ?? 'ncnn',
    );
    // Resolve the endpoint NOW so a missing host resolves to null and the
    // pipeline-loader falls through to the worker path immediately instead
    // of burning frames on a runner that cannot serve.
    const endpoint = await client.ensureEndpoint();
    if (!endpoint) return null;
    return client;
  }

  private async ensureEndpoint(): Promise<HttpEndpointInfo | null> {
    if (this.endpoint) return this.endpoint;
    if (!this.endpointPromise) {
      this.endpointPromise = this.resolveEndpoint().finally(() => {
        this.endpointPromise = null;
      });
    }
    const info = await this.endpointPromise;
    if (info) this.endpoint = info;
    return info;
  }

  private invalidateEndpoint(): void {
    this.endpoint = null;
  }

  /**
   * Depth-8 backpressure slot shared by runFrame/runFrameRgba. Frames beyond
   * the eighth in-flight request wait here; the pipeline's scheduler already
   * refuses to start them, so in practice the waiters list stays empty and
   * this is pure safety against wedging the frame-job slot.
   */
  private async withSlot<T>(task: () => Promise<T>): Promise<T> {
    while (this.inFlight >= this.maxInFlight && !this.disposed) {
      await new Promise<void>(resolve => this.waiters.push(resolve));
    }
    if (this.disposed) throw new Error('native client disposed');
    this.inFlight += 1;
    try {
      return await task();
    } finally {
      this.inFlight -= 1;
      const next = this.waiters.shift();
      if (next) next();
    }
  }

  /**
   * Rotating upload staging for one frame. The returned buffer stays valid
   * until the next call reclaims the slot, which is safe because at most
   * maxInFlight requests are alive and they advance the slot in turn.
   */
  private claimUploadBuffer(byteLength: number): Uint8Array {
    this.uploadSlot = (this.uploadSlot + 1) % this.uploadBuffers.length;
    let buffer = this.uploadBuffers[this.uploadSlot];
    if (!buffer || buffer.byteLength !== byteLength) {
      buffer = new Uint8Array(byteLength);
      this.uploadBuffers[this.uploadSlot] = buffer;
    }
    return buffer;
  }

  async runFrame(
    _modelUrl: string,
    _modelUrlFp16: string | null,
    width: number,
    height: number,
    data: Float32Array,
    targetWidth = 0,
    targetHeight = 0,
  ): Promise<RealEsrganFrameResult> {
    // Convert OUTSIDE any promise chain and copy the input: the pipeline's
    // pooled Float32Array may be reused/freed while the request is in flight,
    // and a same-compartment conversion here keeps every object in this call
    // stack local (Firefox cross-compartment rejections come from values
    // crossing sandbox boundaries mid-chain).
    const rgba = planarToRgba(data, width, height);
    try {
      return await this.withSlot(() => this.runFrameInner(width, height, rgba, targetWidth, targetHeight));
    } catch (error) {
      throw tagNativeTransient(error);
    }
  }

  /**
   * Fast path: tightly packed RGBA8 straight in, skipping the planar-float
   * roundtrip (the pipeline already holds tight bytes from readback).
   * Bit-identical to runFrame for opaque video: planarToRgba quantises
   * through 8-bit first (round(v*255)), which is exactly what the caller
   * passes here. The bytes are copied into the rotating upload staging so
   * the caller keeps owning its buffer.
   */
  async runFrameRgba(
    _modelUrl: string,
    width: number,
    height: number,
    data: Uint8Array,
    targetWidth = 0,
    targetHeight = 0,
  ): Promise<RealEsrganFrameResult> {
    if (data.length !== width * height * 4) {
      throw new Error(`native RGBA frame holds ${data.length} bytes; expected ${width * height * 4}.`);
    }
    try {
      return await this.withSlot(() => {
        // Claim INSIDE the backpressure slot: the rotation invariant ("at most
        // maxInFlight requests are alive") is enforced by withSlot, so a claim
        // before it lets a third concurrent caller reclaim a buffer an
        // in-flight request still owns (the client is a broker-lifetime
        // singleton shared across pipelines).
        const rgba = this.claimUploadBuffer(data.length);
        rgba.set(data);
        return this.runFrameInner(width, height, rgba, targetWidth, targetHeight);
      });
    } catch (error) {
      // Belt: anything escaping the frame path without a code (barrier
      // wrappers, torn-down compartments) rides the transient budget instead
      // of killing the runner on first sight. Three consecutive failures
      // still detach it; a single ghost never does. E2E proved ghosts recur
      // about once per run with no identifiable stage.
      throw tagNativeTransient(error);
    }
  }

  private async runFrameInner(
    width: number,
    height: number,
    rgba: Uint8Array,
    targetWidth: number,
    targetHeight: number,
  ): Promise<RealEsrganFrameResult> {
    if (this.disposed) throw new Error('native client disposed');
    if (width > MAX_DIM || height > MAX_DIM) {
      throw new Error(`frame ${width}x${height} exceeds the host's ${MAX_DIM}px limit`);
    }
    // FLAT async/await (no nested .then chains): the bisection harness proved
    // that the exact same fetch at top-level await succeeds while the same
    // request routed through .then() chains surfaces Firefox's
    // "non-unwrappable cross-compartment wrapper" rejection.
    // runStage pinpoints failures in the E2E log (error objects themselves
    // are unreadable across compartments).
    let runStage = 'endpoint';
    let endpoint;
    try {
      endpoint = await this.ensureEndpoint();
    } catch (error) {
      console.info(formatRealEsrganError(REALESRGAN_ERROR_CODES.NATIVE_FRAME_FAILED,
        `native frame failed at run stage=${runStage} err=${shortError(error)}`));
      throw error;
    }
    if (!endpoint) throw new Error('native host HTTP endpoint unavailable');
    try {
      runStage = 'fetch';
      let query = `token=${encodeURIComponent(endpoint.token)}&w=${width}&h=${height}`;
      if (targetWidth > 0 && targetHeight > 0) {
        query += `&tw=${targetWidth}&th=${targetHeight}`;
      }
      if (this.engine === 'srvgg') query += '&engine=srvgg';
      const url = `http://127.0.0.1:${endpoint.port}/upscale?${query}`;
      const t0 = performance.now();
      // Timeout guard: a wedged host (open connection, no response) must not
      // stall drain() forever — the frame-job slot stays busy and no future
      // frame ever lands. 6 s abort (healthy p90 ~70 ms); the guard's retry
      // budget absorbs the occasional slow frame.
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: rgba,
        signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(FRAME_TIMEOUT_MS) : undefined,
      }).catch(error => {
        // The fetch-level abort guard is a timeout like the body guard below:
        // a wedged host gets the Runner-Guard's retry budget, not a permanent
        // disable on first sight.
        if (isFetchTimeoutError(error)) {
          throw withRealEsrganCode(
            new Error(`native host fetch timed out after ${FRAME_TIMEOUT_MS}ms`),
            REALESRGAN_ERROR_CODES.NATIVE_FRAME_TIMEOUT,
          );
        }
        // Any other fetch rejection (refused connection after a host exit,
        // compartment wrapper, abort) is transient too: the guard's budget
        // decides over consecutive failures, a single hiccup never buries
        // the native path. Untagged rethrows used to kill the runner here
        // on first sight (E2E: one failed fetch ended native for the run).
        throw withRealEsrganCode(
          new Error(`native host fetch failed: ${shortError(error)}`),
          REALESRGAN_ERROR_CODES.NATIVE_FRAME_FAILED,
        );
      });
      runStage = 'status';
      if (response.status === 403) {
          // Stale token after a host restart. Drop the cached endpoint; the
          // pipeline's normal retry loop picks the fresh one up next frame.
          this.invalidateEndpoint();
          throw withRealEsrganCode(
            new Error('native host rejected the transport token'),
            REALESRGAN_ERROR_CODES.NATIVE_FRAME_FAILED,
          );
        }
        if (!response.ok) {
          // Surface the host's failure text and tag the failure transient: a
          // one-frame host hiccup (e.g. inference_failed under memory
          // pressure) must not permanently disable the 10x path — the
          // Runner-Guard's retry budget decides, not the first error.
          const detail = await response.text().then(t => t.slice(0, 200), () => '');
          const stage = nativeInferenceStageFromDetail(detail);
          const error: RealEsrganCodedError & { stage?: NativeInferenceStage } = withRealEsrganCode(
            new Error(`native host HTTP ${response.status}${detail ? `: ${detail}` : ''}${stage ? ` [stage=${stage}]` : ''}`),
            REALESRGAN_ERROR_CODES.NATIVE_FRAME_FAILED,
          );
          // Thread the host's stage through for diagnostics; the code and
          // transient classification above stay exactly as before.
          if (stage) error.stage = stage;
          throw error;
        }
        runStage = 'headers';
        const outW = Number(response.headers.get('X-Frame-Width')) || width * 4;
        const outH = Number(response.headers.get('X-Frame-Height')) || height * 4;
        // The fetch abort signal covers headers; guard the body read as well
        // so a stalled multi-MB download cannot wedge the frame-job slot.
        let bodyTimeout: ReturnType<typeof setTimeout> | undefined;
        try {
          runStage = 'arraybuffer';
          const raw = await Promise.race([
            response.arrayBuffer(),
            new Promise<never>((_, reject) => {
              bodyTimeout = setTimeout(
                // Transient: the guard gives the runner a retry budget
                // instead of disabling it on the first slow frame.
                () => reject(withRealEsrganCode(
                  new Error(`native host response body timed out after ${FRAME_TIMEOUT_MS}ms`),
                  REALESRGAN_ERROR_CODES.NATIVE_FRAME_TIMEOUT)),
                FRAME_TIMEOUT_MS,
              );
            }),
          ]);
          const tBody = performance.now();
          runStage = 'rehome';
          // Large loopback downloads can arrive as a cross-compartment buffer
          // (parent-process blob path for multi-MB bodies); touching it
          // directly throws "Permission denied to access property
          // constructor" in Firefox. structuredClone() re-homes the bytes
          // into this compartment — but it copies ~8 MB per frame, so it
          // runs only when the buffer proves hostile: a 4-byte view probe
          // exercises the exact constructor lookup that fails on
          // cross-compartment buffers, and costs nothing otherwise.
          let buffer: ArrayBuffer;
          try {
            buffer = rehomeResponseBuffer(raw);
          } catch {
            buffer = raw;
          }
          const tRehome = performance.now();
          runStage = 'validate';
          const expected = outW * outH * 4;
          if (!outW || !outH || buffer.byteLength !== expected) {
            throw new Error(`native host returned ${buffer.byteLength} bytes; expected ${expected}`);
          }
          runStage = 'view';
          const data = new Uint8Array(buffer);
          runStage = 'done';
          const ms = performance.now() - t0;
          // Engine-attributed path label: the E2E verdict (and the overlay
          // via nativePct) tells ncnn and srvgg frames apart. Guarded: a
          // throwing subscriber must not fail an otherwise good frame.
          const engineLabel = this.engine === 'srvgg' ? 'native-srvgg' : 'native-vulkan-gpu';
          const firePath = (label: string): void => {
            try {
              this.onFramePath?.(label);
            } catch (error) {
              console.warn('[RealESRGAN] onFramePath hook threw; frame already served', error);
            }
          };
          if (this.onFramePath && !this.loggedPath) {
            this.loggedPath = true;
            firePath(`${engineLabel} (${width}x${height}→${outW}x${outH} ${ms.toFixed(0)}ms http)`);
          }
          // E2E-gated steady-state telemetry: every 30th frame reports its
          // time so live runs can verify sustained fps (production quiet).
          this.frameCount += 1;
          if (this.onFramePath && typeof __ANIME4K_E2E__ !== 'undefined' && __ANIME4K_E2E__
              && this.frameCount % 30 === 0) {
            const netMs = Math.round(tBody - t0);
            const postMs = Math.round(tRehome - tBody);
            firePath(`${engineLabel} (frame#${this.frameCount} ${width}x${height} ${ms.toFixed(0)}ms http net=${netMs}ms post=${postMs}ms)`);
          }
          return { data, width: outW, height: outH };
        } finally {
          if (bodyTimeout !== undefined) clearTimeout(bodyTimeout);
        }
      } catch (error) {
        console.info(formatRealEsrganError(REALESRGAN_ERROR_CODES.NATIVE_FRAME_FAILED,
          `native frame failed at run stage=${runStage} err=${shortError(error)}`));
        throw error;
      }
  }

  dispose(): void {
    this.disposed = true;
    this.invalidateEndpoint();
    // Wake frames parked in the depth-2 backpressure wait: their loop re-checks
    // `disposed` and throws instead of hanging forever on a dead client.
    while (this.waiters.length) this.waiters.shift()!();
  }
}
