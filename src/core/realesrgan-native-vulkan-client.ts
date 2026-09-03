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

import type { RealEsrganInferenceRunner, RealEsrganFrameResult } from './realesrgan-worker-client';

const CAP_TIMEOUT_MS = 10_000;
const FRAME_TIMEOUT_MS = 18_000;
const MAX_DIM = 4096;

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
  // values in [0,1] -> 0-255
  for (let i = 0; i < pixels; i++) {
    const r = Math.max(0, Math.min(255, Math.round(planar[i] * 255)));
    const g = Math.max(0, Math.min(255, Math.round(planar[i + pixels] * 255)));
    const b = Math.max(0, Math.min(255, Math.round(planar[i + pixels * 2] * 255)));
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return out;
}

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

export class RealEsrganNativeVulkanClient implements RealEsrganInferenceRunner {
  private readonly fetchImpl: FetchLike;
  private endpoint: HttpEndpointInfo | null = null;
  private endpointPromise: Promise<HttpEndpointInfo | null> | null = null;
  public onFramePath: ((path: string) => void) | null = null;
  private disposed = false;
  private loggedPath = false;
  private frameCount = 0;
  /**
   * Request pipelining (depth 2): while one frame is in flight, exactly one
   * further request may be POSTed. The host serializes GPU work with a mutex
   * but reads the request body ahead of the upscale, so the ~5–10 ms of
   * loopback transfer + host-side preproc slip under the previous frame's
   * GPU time instead of stacking on top of it (analogous to the measured
   * 217→207 ms client-pipelining win on the Python harness). The queue is
   * NOT unbounded: latest-frame-wins stays intact because at most 2 frames
   * are in flight and the pipeline's scheduler already drops frames that
   * arrive while inference is busy.
   */
  private inFlight = 0;
  private readonly maxInFlight = 2;
  private readonly waiters: Array<() => void> = [];
  /**
   * The native host box-averages the network output down to tw/th before
   * download (p8). The worker path ignores the target; this flag lets the
   * pipeline decide whether passing it is worth anything.
   */
  public readonly supportsTargetDownscale = true;

  private constructor(fetchImpl: FetchLike) {
    this.fetchImpl = fetchImpl;
  }

  static async create(): Promise<RealEsrganNativeVulkanClient | null> {
    // Loopback fetch from content scripts works in Chromium and Firefox;
    // the browser test page (http://127.0.0.1:4173) is http so no
    // mixed-content question arises there either. Anything unusual fails
    // closed into the WASM fallback via the null return below.
    const client = new RealEsrganNativeVulkanClient((input, init) => fetch(input, init));
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
      this.endpointPromise = this.queryEndpoint().finally(() => {
        this.endpointPromise = null;
      });
    }
    const info = await this.endpointPromise;
    if (info) this.endpoint = info;
    return info;
  }

  private async queryEndpoint(): Promise<HttpEndpointInfo | null> {
    console.info('[RealESRGAN] querying native transport endpoint from background...');
    try {
      const reply = (await Promise.race([
        chrome.runtime.sendMessage({ type: 'REALESRGAN_HTTP_INFO' }),
        new Promise(resolve => setTimeout(() => resolve('timeout'), CAP_TIMEOUT_MS)),
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
    }
  }

  private invalidateEndpoint(): void {
    this.endpoint = null;
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
    if (this.disposed) throw new Error('native client disposed');
    if (width > MAX_DIM || height > MAX_DIM) {
      throw new Error(`frame ${width}x${height} exceeds the host's ${MAX_DIM}px limit`);
    }
    // Depth-2 slot. Frames beyond the second in-flight request wait here; the
    // pipeline's scheduler already refuses to start them, so in practice the
    // waiters list stays empty and this is pure backpressure safety.
    while (this.inFlight >= this.maxInFlight && !this.disposed) {
      await new Promise<void>(resolve => this.waiters.push(resolve));
    }
    if (this.disposed) throw new Error('native client disposed');
    this.inFlight += 1;
    try {
      return await this.runFrameInner(width, height, data, targetWidth, targetHeight);
    } finally {
      this.inFlight -= 1;
      const next = this.waiters.shift();
      if (next) next();
    }
  }

  private async runFrameInner(
    width: number,
    height: number,
    data: Float32Array,
    targetWidth: number,
    targetHeight: number,
  ): Promise<RealEsrganFrameResult> {
    // Convert OUTSIDE any promise chain and copy the input: the pipeline's
    // pooled Float32Array may be reused/freed while the request is in flight,
    // and a same-compartment conversion here keeps every object in this call
    // stack local (Firefox cross-compartment rejections come from values
    // crossing sandbox boundaries mid-chain).
    const rgba = planarToRgba(data, width, height);
    // FLAT async/await (no nested .then chains): the bisection harness proved
    // that the exact same fetch at top-level await succeeds while the same
    // request routed through .then() chains surfaces Firefox's
    // "non-unwrappable cross-compartment wrapper" rejection.
    const endpoint = await this.ensureEndpoint();
    if (!endpoint) throw new Error('native host HTTP endpoint unavailable');
    let query = `token=${encodeURIComponent(endpoint.token)}&w=${width}&h=${height}`;
    if (targetWidth > 0 && targetHeight > 0) {
      query += `&tw=${targetWidth}&th=${targetHeight}`;
    }
    const url = `http://127.0.0.1:${endpoint.port}/upscale?${query}`;
    const t0 = performance.now();
    // Timeout guard: a wedged host (open connection, no response) must not
    // stall drain() forever — the frame-job slot stays busy and no future
    // frame ever lands. Mirrors the worker path's 18s timeout.
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: rgba,
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(FRAME_TIMEOUT_MS) : undefined,
    });
    if (response.status === 403) {
      // Stale token after a host restart. Drop the cached endpoint; the
      // pipeline's normal retry loop picks the fresh one up next frame.
      this.invalidateEndpoint();
      throw new Error('native host rejected the transport token');
    }
    if (!response.ok) {
      throw new Error(`native host HTTP ${response.status}`);
    }
    const outW = Number(response.headers.get('X-Frame-Width')) || width * 4;
    const outH = Number(response.headers.get('X-Frame-Height')) || height * 4;
    // The fetch abort signal covers headers; guard the body read as well so
    // a stalled multi-MB download cannot wedge the frame-job slot either.
    const raw = await Promise.race([
      response.arrayBuffer(),
      new Promise<never>((_, reject) => setTimeout(
        () => reject(new Error(`native host response body timed out after ${FRAME_TIMEOUT_MS}ms`)),
        FRAME_TIMEOUT_MS,
      )),
    ]);
    // Large loopback downloads can arrive as a cross-compartment buffer
    // (parent-process blob path for multi-MB bodies); touching it directly
    // throws "Permission denied to access property constructor" in Firefox.
    // structuredClone() re-homes the bytes into this compartment so every
    // downstream access (subarray, writeTexture) stays local.
    let local: ArrayBuffer;
    try {
      local = structuredClone(raw);
    } catch {
      local = raw;
    }
    const buffer = local;
    const expected = outW * outH * 4;
    if (!outW || !outH || buffer.byteLength !== expected) {
      throw new Error(`native host returned ${buffer.byteLength} bytes; expected ${expected}`);
    }
    const ms = performance.now() - t0;
    if (this.onFramePath && !this.loggedPath) {
      this.loggedPath = true;
      this.onFramePath(`native-vulkan-gpu (${width}x${height}→${outW}x${outH} ${ms.toFixed(0)}ms http)`);
    }
    // E2E-gated steady-state telemetry: every 30th frame reports its time so
    // live runs can verify sustained fps (production stays quiet).
    this.frameCount += 1;
    if (this.onFramePath && typeof __ANIME4K_E2E__ !== 'undefined' && __ANIME4K_E2E__
        && this.frameCount % 30 === 0) {
      this.onFramePath(`native-vulkan-gpu (frame#${this.frameCount} ${ms.toFixed(0)}ms http)`);
    }
    return { data: new Uint8Array(buffer), width: outW, height: outH };
  }

  dispose(): void {
    this.disposed = true;
    this.invalidateEndpoint();
    // Wake frames parked in the depth-2 backpressure wait: their loop re-checks
    // `disposed` and throws instead of hanging forever on a dead client.
    while (this.waiters.length) this.waiters.shift()!();
  }
}
