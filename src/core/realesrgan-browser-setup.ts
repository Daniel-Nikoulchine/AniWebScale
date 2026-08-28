/**
 * Browser wiring for the RealESRGAN inference path.
 *
 * Registers how the ONNX session factory resolves model URLs, where
 * onnxruntime-web finds its WASM runtime, and which threading configuration
 * to probe. URLs resolve through chrome.runtime.getURL so the content script
 * (isolated world) loads them from the extension package rather than the
 * page origin.
 *
 * Models are passed to the runtime as URLs, not byte buffers: Firefox
 * content scripts run in a separate compartment where even locally
 * constructed typed arrays fail the runtime's `instanceof Uint8Array`
 * check, so onnxruntime-web must fetch the model bytes inside its own realm.
 *
 * Threading: the setup asks for a proxy worker plus multithreaded WASM.
 * Whether content scripts may spawn those workers (and whether
 * SharedArrayBuffer is available) differs per browser and per page, so the
 * session factory probes this configuration at Session.create time and
 * cascades down to single-threaded main-thread WASM when a level fails.
 *
 * Call `setupRealEsrganBrowserRuntime()` once before the first RealESRGAN
 * session is created. It is idempotent.
 */
import { setRealEsrganModelUrlResolver, setRealEsrganThreadingConfig } from './realesrgan-session';

let configured: Promise<void> | null = null;

/**
 * Configure the ONNX runtime for the browser once and return a promise that
 * resolves when configuration is complete. Callers must `await` this before
 * creating the first RealESRGAN session: onnxruntime-web reads
 * `env.wasm.wasmPaths` at `Session.create` time, so returning before the
 * dynamic import settles would let a session build with an unset path.
 * Idempotent: repeated calls return the same promise.
 */
export function setupRealEsrganBrowserRuntime(): Promise<void> {
  if (configured) return configured;
  configured = (async () => {
    setRealEsrganModelUrlResolver(fileName =>
      chrome.runtime.getURL(`models/realesrgan/${fileName}`));

    // Point the WASM backend at the bundled runtime. onnxruntime-web appends
    // the specific .wasm file name to this prefix when it instantiates.
    const ort = await import(/* webpackChunkName: "ort" */ 'onnxruntime-web');
    ort.env.wasm.wasmPaths = chrome.runtime.getURL('ort/');

    // Ask for multithreaded WASM. onnxruntime-web falls back to
    // single-threading on its own (with a console warning) when the page is
    // not crossOriginIsolated, so this is safe to request unconditionally.
    //
    // The proxy worker is deliberately NOT enabled: spawning ORT's module
    // worker from a content-script compartment fails with a NetworkError, and
    // that failure poisons onnxruntime-web's one-shot global WASM init so no
    // later fallback level can recover. Proxy stays off; the session factory
    // still cascades WebGPU EP -> WASM and threads -> single-thread.
    const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 4;
    // Cap at 16, not 4. The previous floor of 4 was a holdover from the
    // RealCUGAN reference path; animevideov3 is a 16-block VGG-style CNN
    // where the kernel cost is roughly linear in thread count up to the
    // number of physical cores. The Cascade in session.ts still drops to
    // numThreads=1 on its last level if SharedArrayBuffer is unavailable,
    // so this is safe on Firefox/Chrome alike.
    setRealEsrganThreadingConfig({
      proxy: false,
      numThreads: Math.min(16, cores),
    });
  })();
  // A failed setup must not poison the singleton; drop it so a retry can
  // re-attempt (mirrors the session cache behaviour).
  void configured.catch(() => { configured = null; });
  return configured;
}
