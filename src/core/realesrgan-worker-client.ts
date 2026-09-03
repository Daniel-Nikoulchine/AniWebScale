/**
 * Promise-based facade over the RealESRGAN inference worker.
 *
 * Content scripts cannot construct a Worker directly from a
 * chrome-extension:// URL (the constructor throws a SecurityError because the
 * worker would inherit the page origin). The verified workaround
 * (docs/realesrgan-phase4-worker-spike.md) is to fetch the worker script, wrap
 * it in a Blob URL, and start it as a module worker. This client owns that
 * spawn sequence plus the init/infer message protocol, and exposes a single
 * `run()` the pipeline can await.
 *
 * The client never imports onnxruntime-web: it only shuttles URLs and planar
 * float buffers. The worker imports the standalone ORT bundle at runtime.
 *
 * Shipped for both browsers. The worker runs the WebGPU EP and falls back to
 * WASM internally. On Firefox this is the only place WebGPU inference can run:
 * the content script's MV3 CSP blocks the asyncify loader's `new Function`,
 * but a blob worker is allowed it (verified on Zen). If the worker cannot be
 * spawned, `create()` resolves to null and the pipeline keeps its main-thread
 * session path.
 */

/** Minimal Worker surface this client relies on (real Worker satisfies it). */
export interface RealEsrganWorkerHandle {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
}

interface WorkerInitMessage {
  type: 'init';
  ortUrl: string;
  wasmDir: string;
}

interface WorkerInferMessage {
  type: 'infer';
  id: number;
  modelUrl: string;
  modelUrlFp16: string | null;
  width: number;
  height: number;
  data: Float32Array;
  /** Presentation target (absent/0 = full 4x). The worker box-averages down to a valid target. */
  targetWidth?: number;
  targetHeight?: number;
}

interface WorkerInitReply {
  type: 'init';
  ok: boolean;
  error?: string;
}

interface WorkerInferReply {
  type: 'infer';
  id: number;
  ok: boolean;
  width?: number;
  height?: number;
  data?: Uint8Array;
  path?: string;
  error?: string;
}

type WorkerReply = WorkerInitReply | WorkerInferReply;

/** Overridable primitives so tests can drive the client without a browser. */
export interface RealEsrganWorkerClientOptions {
  /** Resolve an extension-relative path to a fetchable URL. */
  resolveUrl?: (path: string) => string;
  /** Download the worker script source. */
  loadScript?: (url: string) => Promise<string>;
  /** Turn the fetched source into a Blob URL. */
  createBlobUrl?: (source: string) => string;
  /** Start a module worker from the Blob URL. */
  spawnWorker?: (blobUrl: string) => RealEsrganWorkerHandle;
  /** Release a Blob URL once the worker has started. */
  revokeBlobUrl?: (blobUrl: string) => void;
  /** Milliseconds to wait for the init reply before giving up. */
  initTimeoutMs?: number;
  /** Milliseconds to wait for a single inference reply. */
  inferTimeoutMs?: number;
  /** Maximum simultaneous worker inference requests. */
  maxConcurrentRequests?: number;
}

interface PendingInference {
  resolve: (data: RealEsrganFrameResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_INIT_TIMEOUT_MS = 15_000;
// 18s: the first fp32 inference includes WebGPU shader compilation for every
// kernel; on a busy system that measured >12s (the old cap), which disabled a
// perfectly good worker after ONE slow frame.
const DEFAULT_INFER_TIMEOUT_MS = 18_000;

function isWorkerReply(value: unknown): value is WorkerReply {
  return typeof value === 'object' && value !== null
    && ((value as WorkerReply).type === 'init' || (value as WorkerReply).type === 'infer');
}

/**
 * Minimal inference contract the pipeline depends on. The worker client
 * implements it; tests stub it. Keeps the pipeline decoupled from the
 * client's spawn/protocol machinery.
 *
 * `runFrame` hands the WHOLE frame to the worker: tile planning, batched
 * inference, feathered composition and RGBA8 packing happen there. The
 * returned frame is tightly packed RGBA8. `targetWidth/targetHeight` are
 * OPTIONAL (0 = legacy full 4x frame): a runner that supports
 * transport-sized output box-averages the 4x result down to this size and
 * reports the actual dimensions alongside the bytes. A runner MAY ignore
 * the target (returns 4x dims) - the pipeline handles both.
 */
export interface RealEsrganFrameResult {
  data: Uint8Array;
  width: number;
  height: number;
}

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
  dispose?(): void;
}

export class RealEsrganWorkerClient implements RealEsrganInferenceRunner {
  private readonly worker: RealEsrganWorkerHandle;
  private readonly pending = new Map<number, PendingInference>();
  private readonly inferTimeoutMs: number;
  private readonly maxConcurrentRequests: number;
  private activeRequests = 0;
  private readonly requestQueue: Array<{
    message: WorkerInferMessage;
    resolve: (data: RealEsrganFrameResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private nextId = 1;
  private disposed = false;
  /** Optional diagnostics hook: fired once per distinct composition path. */
  public onFramePath: ((path: string) => void) | null = null;
  private lastLoggedPath: string | null = null;

  private constructor(worker: RealEsrganWorkerHandle, inferTimeoutMs: number, maxConcurrentRequests: number) {
    this.worker = worker;
    this.inferTimeoutMs = inferTimeoutMs;
    this.maxConcurrentRequests = Math.max(1, Math.floor(maxConcurrentRequests));
    this.worker.onmessage = event => this.handleMessage(event.data);
    this.worker.onerror = event => this.failAll(new Error(event.message ?? 'RealESRGAN worker error'));
  }

  /**
   * Spawn and initialise the worker. Resolves to a ready client, or null when
   * the worker cannot be loaded or initialised (Firefox, missing assets, init
   * failure). Callers treat null as "use the main-thread path".
   */
  static async create(options: RealEsrganWorkerClientOptions = {}): Promise<RealEsrganWorkerClient | null> {
    const resolveUrl = options.resolveUrl
      ?? ((path: string) => chrome.runtime.getURL(path));
    const loadScript = options.loadScript
      ?? (async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch worker script: ${response.status}`);
        return response.text();
      });
    const createBlobUrl = options.createBlobUrl
      ?? ((source: string) => URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    const spawnWorker = options.spawnWorker
      ?? ((blobUrl: string) => new Worker(blobUrl, { type: 'module' }) as unknown as RealEsrganWorkerHandle);
    const revokeBlobUrl = options.revokeBlobUrl
      ?? ((blobUrl: string) => URL.revokeObjectURL(blobUrl));
    const initTimeoutMs = options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
    const inferTimeoutMs = options.inferTimeoutMs ?? DEFAULT_INFER_TIMEOUT_MS;
    const maxConcurrentRequests = options.maxConcurrentRequests
      ?? Math.max(2, Math.min(8, typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2));

    let worker: RealEsrganWorkerHandle;
    try {
      const scriptUrl = resolveUrl('chunks/realesrgan-inference-worker.js');
      const source = await loadScript(scriptUrl);
      const blobUrl = createBlobUrl(source);
      try {
        worker = spawnWorker(blobUrl);
      } finally {
        // Revoke even when Worker construction fails; otherwise repeated
        // fallback attempts leak one Blob URL per attempt.
        revokeBlobUrl(blobUrl);
      }
    } catch (error) {
      // Visible on the page console so the user can tell us *why* the
      // worker path is dead on this browser. The pipeline falls back to
      // the main-thread session automatically.
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : 'Error';
      console.warn(
        '[RealESRGAN] worker spawn failed (%s: %s); falling back to main-thread session.',
        name, message,
      );
      return null;
    }

    const client = new RealEsrganWorkerClient(worker, inferTimeoutMs, maxConcurrentRequests);
    const initialised = await client.initialise(resolveUrl, initTimeoutMs);
    if (!initialised) {
      console.warn(
        '[RealESRGAN] worker init handshake timed out (>%dms); main-thread session will be used.',
        initTimeoutMs,
      );
      client.dispose();
      return null;
    }
    return client;
  }

  private initialise(
    resolveUrl: (path: string) => string,
    timeoutMs: number,
  ): Promise<boolean> {
    const message: WorkerInitMessage = {
      type: 'init',
      ortUrl: resolveUrl('ort/ort.webgpu.min.mjs'),
      wasmDir: resolveUrl('ort/'),
    };
    return new Promise<boolean>(resolve => {
      const timer = setTimeout(() => {
        this.initResolver = null;
        resolve(false);
      }, timeoutMs);
      this.initResolver = ok => {
        clearTimeout(timer);
        this.initResolver = null;
        resolve(ok);
      };
      try {
        this.worker.postMessage(message);
      } catch {
        clearTimeout(timer);
        this.initResolver = null;
        resolve(false);
      }
    });
  }

  private initResolver: ((ok: boolean) => void) | null = null;

  private handleMessage(value: unknown): void {
    if (!isWorkerReply(value)) return;
    if (value.type === 'init') {
      this.initResolver?.(value.ok);
      return;
    }
    const pending = this.pending.get(value.id);
    if (!pending) return;
    this.pending.delete(value.id);
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    clearTimeout(pending.timer);
    if (value.ok && value.data) {
      const outputWidth = value.width ?? 0;
      const outputHeight = value.height ?? 0;
      if (!Number.isInteger(outputWidth) || !Number.isInteger(outputHeight)
        || outputWidth <= 0 || outputHeight <= 0
        || value.data.length !== outputWidth * outputHeight * 4) {
        pending.reject(new Error('RealESRGAN worker returned an invalid output shape.'));
        this.pumpRequests();
        return;
      }
      // Surface which composition path served this frame; the pipeline logs
      // it once per distinct value for live diagnostics.
      if (value.path && value.path !== this.lastLoggedPath) {
        this.lastLoggedPath = value.path;
        this.onFramePath?.(value.path);
      }
      pending.resolve({ data: value.data, width: outputWidth, height: outputHeight });
    } else {
      pending.reject(new Error(value.error ?? 'RealESRGAN worker inference failed'));
    }
    this.pumpRequests();
  }

  private failAll(error: Error): void {
    this.initResolver?.(false);
    this.initResolver = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    while (this.requestQueue.length) this.requestQueue.shift()!.reject(error);
    this.activeRequests = 0;
  }

  private pumpRequests(): void {
    if (this.disposed || this.activeRequests >= this.maxConcurrentRequests) return;
    const request = this.requestQueue.shift();
    if (!request) return;
    this.activeRequests += 1;
    const { message, resolve, reject } = request;
    const timer = setTimeout(() => {
      this.pending.delete(message.id);
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      reject(new Error('RealESRGAN worker inference timed out.'));
      this.pumpRequests();
    }, this.inferTimeoutMs);
    this.pending.set(message.id, { resolve, reject, timer });
    try {
      this.worker.postMessage(message, [message.data.buffer]);
    } catch (error) {
      this.pending.delete(message.id);
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
      this.pumpRequests();
    }
    // Fill every available request slot. Otherwise a queue of frames waits
    // unnecessarily until the first completion even when concurrency > 1.
    this.pumpRequests();
  }

  /**
   * Run one whole frame through the worker. `data` is planar NCHW RGB
   * ([1,3,h,w]); the returned frame is tightly packed RGBA8 with its actual
   * dimensions. `targetWidth/targetHeight` (0 = full 4x) are forwarded to
   * the worker, which box-averages the 4x result down to a valid target and
   * reports the actual dimensions alongside the bytes.
   * The input is copied into a transferable buffer; the caller keeps its own
   * buffer untouched. `modelUrlFp16` may be null: the worker then uses
   * `modelUrl` only.
   */
  runFrame(
    modelUrl: string,
    modelUrlFp16: string | null,
    width: number,
    height: number,
    data: Float32Array,
    targetWidth = 0,
    targetHeight = 0,
  ): Promise<RealEsrganFrameResult> {
    if (this.disposed) return Promise.reject(new Error('RealESRGAN worker client is disposed.'));
    const id = this.nextId;
    this.nextId += 1;
    // Copy so the transfer never detaches a buffer the caller still owns.
    const payload = new Float32Array(data);
    const message: WorkerInferMessage = {
      type: 'infer', id, modelUrl, modelUrlFp16, width, height, data: payload,
      ...(targetWidth > 0 && targetHeight > 0 ? { targetWidth, targetHeight } : {}),
    };
    return new Promise<RealEsrganFrameResult>((resolve, reject) => {
      this.requestQueue.push({ message, resolve, reject });
      this.pumpRequests();
    });
  }

  /** Terminate the worker and reject anything still in flight. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.failAll(new Error('RealESRGAN worker client is disposed.'));
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
  }
}
