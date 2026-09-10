/**
 * Browser wiring for the RealESRGAN inference path.
 *
 * Builds the RealEsrganSessionFactory: how the ONNX session factory resolves
 * model URLs, where onnxruntime-web finds its WASM runtime, and which
 * threading configuration to probe. URLs resolve through
 * chrome.runtime.getURL so the content script (isolated world) loads them
 * from the extension package rather than the page origin.
 *
 * Models are passed to the runtime as URLs, not byte buffers: Firefox
 * content scripts run in a separate compartment where even locally
 * constructed typed arrays fail the runtime's `instanceof Uint8Array`
 * check, so onnxruntime-web must fetch the model bytes inside its own realm.
 *
 * Threading: the setup asks for multithreaded WASM. Whether
 * SharedArrayBuffer is available differs per browser and per page, so the
 * session factory probes this configuration at Session.create time and
 * cascades down to single-threaded main-thread WASM when a level fails.
 *
 * The proxy worker is deliberately NOT part of the cascade: spawning ORT's
 * module worker from a content-script compartment fails with a
 * NetworkError, and that failure poisons onnxruntime-web's one-shot global
 * WASM init so no later fallback level can recover. Proxy stays off; the
 * session factory still cascades WebGPU EP -> WASM and threads ->
 * single-thread.
 *
 * Call `setupRealEsrganBrowserRuntime()` once before the first RealESRGAN
 * session is created and thread the factory to the loader. It is idempotent.
 */
import { RealEsrganSessionFactory, type RealEsrganSessionConfig } from './realesrgan-session';

let configured: Promise<RealEsrganSessionFactory> | null = null;

/**
 * Configure the ONNX runtime for the browser once and resolve with the
 * session factory. Callers must `await` this before creating the first
 * RealESRGAN session: onnxruntime-web reads `env.wasm.wasmPaths` at
 * `Session.create` time, so returning before the dynamic import settles
 * would let a session build with an unset path. Idempotent: repeated calls
 * return the same promise (and therefore the same factory).
 */
export function setupRealEsrganBrowserRuntime(): Promise<RealEsrganSessionFactory> {
  if (configured) return configured;
  configured = (async () => {
    // Point the WASM backend at the bundled runtime. onnxruntime-web appends
    // the specific .wasm file name to this prefix when it instantiates.
    const ort = await import(/* webpackChunkName: "ort" */ 'onnxruntime-web');
    ort.env.wasm.wasmPaths = chrome.runtime.getURL('ort/');

    // Ask for multithreaded WASM. onnxruntime-web falls back to
    // single-threading on its own (with a console warning) when the page is
    // not crossOriginIsolated, so this is safe to request unconditionally.
    //
    // Cap at 16, not 4. The previous floor of 4 was a holdover from the
    // RealCUGAN reference path; animevideov3 is a 16-block VGG-style CNN
    // where the kernel cost is roughly linear in thread count up to the
    // number of physical cores. The cascade in realesrgan-session.ts still
    // drops to numThreads=1 on its last level if SharedArrayBuffer is
    // unavailable, so this is safe on Firefox/Chrome alike.
    const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 4;
    const threading = { numThreads: Math.min(16, cores) };
    // Auto-selected precision policy (no user setting):
    // - WebGPU worker lane: FP32 reference (the model URL handed to the
    //   worker; QDQ has no WebGPU kernels, so int8 never goes there).
    // - Main-thread WASM fallback session: INT8 (666K static QDQ model,
    //   ~1.8x faster than FP32, PSNR 32.5 dB on anime) — the only viable
    //   realtime option when no GPU runner serves the frame.
    // - Native Vulkan host: its own fp16-storage model (this config is not
    //   consulted there).
    // FP16 stays OFF: ORT-web 1.29's WebGPU EP fails the fp16 model with
    // "ShaderModule with 'Clip' label is invalid" (the bitcast<vec2<f16>>
    // pattern the worker hook cannot fully rewrite), and probing it would
    // burn a session attempt plus a timed-out frame per shape. Flip
    // preferFloat16 only after the EP ships valid f16 kernels; session
    // creation still requires the packaged FP16 asset and falls back to
    // FP32 when missing. The FP16 options were removed from the UI
    // (REALESRGAN precision is device/EP-auto now).
    const execution = { preferFloat16: false, preferInt8: true };

    const config: RealEsrganSessionConfig = {
      resolveModelUrl: fileName => chrome.runtime.getURL(`models/realesrgan/${fileName}`),
      modelAssetExists: async fileName => {
        try {
          const response = await fetch(chrome.runtime.getURL(`models/realesrgan/${fileName}`), {
            method: 'HEAD',
          });
          return response.ok;
        } catch {
          return false;
        }
      },
      threading,
      execution,
    };
    return new RealEsrganSessionFactory(config);
  })();
  // A failed setup must not poison the singleton; drop it so a retry can
  // re-attempt (mirrors the session cache behaviour).
  void configured.catch(() => { configured = null; });
  return configured;
}
