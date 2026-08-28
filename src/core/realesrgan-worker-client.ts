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
  width: number;
  height: number;
  data: Float32Array;
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
  data?: Float32Array;
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
}

interface PendingInference {
  resolve: (data: Float32Array) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_INIT_TIMEOUT_MS = 15_000;
const DEFAULT_INFER_TIMEOUT_MS = 30_000;

function isWorkerReply(value: unknown): value is WorkerReply {
  return typeof value === 'object' && value !== null
    && ((value as WorkerReply).type === 'init' || (value as WorkerReply).type === 'infer');
}

/**
 * Minimal inference contract the pipeline depends on. The worker client
 * implements it; tests stub it. Keeps the pipeline decoupled from the
 * client's spawn/protocol machinery.
 */
export interface RealEsrganInferenceRunner {
  run(modelUrl: string, width: number, height: number, data: Float32Array): Promise<Float32Array>;
}

export class RealEsrganWorkerClient implements RealEsrganInferenceRunner {
  private readonly worker: RealEsrganWorkerHandle;
  private readonly pending = new Map<number, PendingInference>();
  private readonly inferTimeoutMs: number;
  private nextId = 1;
  private disposed = false;

  private constructor(worker: RealEsrganWorkerHandle, inferTimeoutMs: number) {
    this.worker = worker;
    this.inferTimeoutMs = inferTimeoutMs;
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

    let worker: RealEsrganWorkerHandle;
    try {
      const scriptUrl = resolveUrl('chunks/realesrgan-inference-worker.js');
      const source = await loadScript(scriptUrl);
      const blobUrl = createBlobUrl(source);
      worker = spawnWorker(blobUrl);
      revokeBlobUrl(blobUrl);
    } catch {
      return null;
    }

    const client = new RealEsrganWorkerClient(worker, inferTimeoutMs);
    const initialised = await client.initialise(resolveUrl, initTimeoutMs);
    if (!initialised) {
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
    clearTimeout(pending.timer);
    if (value.ok && value.data) {
      pending.resolve(value.data);
    } else {
      pending.reject(new Error(value.error ?? 'RealESRGAN worker inference failed'));
    }
  }

  private failAll(error: Error): void {
    this.initResolver?.(false);
    this.initResolver = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  /**
   * Run one tile through the worker. `data` is planar NCHW RGB ([1,3,h,w]);
   * the returned array is the 2x planar result. The input is copied into a
   * transferable buffer; the caller keeps its own buffer untouched.
   */
  run(modelUrl: string, width: number, height: number, data: Float32Array): Promise<Float32Array> {
    if (this.disposed) return Promise.reject(new Error('RealESRGAN worker client is disposed.'));
    const id = this.nextId;
    this.nextId += 1;
    // Copy so the transfer never detaches a buffer the caller still owns.
    const payload = new Float32Array(data);
    const message: WorkerInferMessage = { type: 'infer', id, modelUrl, width, height, data: payload };
    return new Promise<Float32Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('RealESRGAN worker inference timed out.'));
      }, this.inferTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker.postMessage(message, [payload.buffer]);
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
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
