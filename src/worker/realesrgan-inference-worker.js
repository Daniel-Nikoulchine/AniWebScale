/**
 * RealESRGAN inference worker.
 *
 * Owns the onnxruntime-web session so ONNX inference never blocks the content
 * script's main thread. The content script cannot spawn a worker from a
 * chrome-extension:// URL directly (SecurityError), so it fetches this file,
 * wraps it in a Blob URL and starts it as a module worker. A blob worker runs
 * under the page origin and has no chrome.* APIs: every URL it needs (the ORT
 * bundle, the wasm runtime directory, the model files) is resolved by the
 * content script via chrome.runtime.getURL and passed in through messages.
 * See docs/realesrgan-phase4-worker-spike.md for the verified loading chain.
 *
 * Execution provider: the worker prefers the WebGPU EP and falls back to WASM
 * per model. Running in a worker matters for WebGPU on Firefox for two reasons:
 *   1. The WebGPU bundle's asyncify wasm loader needs `new Function`, which a
 *      Firefox MV3 content script's CSP blocks but a blob worker allows.
 *   2. Inference stays off the main thread either way.
 *
 * Naga (Firefox's WGSL compiler) workaround: onnxruntime-web's f16 kernels emit
 *   bitcast<vec2<f16>>(uniforms.constant_value)[0]
 * to unpack the Pad constant. Naga rejects indexing or field-access on a
 * bitcast<vec2<f16>> result ("Invalid access into expression"), while
 * Chromium's Tint accepts it. We rewrite that pattern at createShaderModule
 * time to
 *   f16(unpack2x16float(uniforms.constant_value)[0])
 * which is bit-identical (unpack2x16float decodes the same two IEEE-754 halfs
 * into a vec2<f32>, and f16 narrows back exactly) and compiles on both Naga and
 * Tint. The hook is installed at module scope, before ORT is imported, so it is
 * in place by the time ORT requests a GPU device. Verified end-to-end on Zen.
 *
 * Protocol (all messages are plain objects):
 *   -> { type: 'init', ortUrl, wasmDir }
 *      Imports the standalone ORT bundle and configures the wasm backend.
 *      Replies { type: 'init', ok: true } or { type: 'init', ok: false, error }.
 *   -> { type: 'infer', id, modelUrl, width, height, data }
 *      `data` is a transferred Float32Array holding planar NCHW RGB in [0,1]
 *      with shape [1, 3, height, width]. Sessions are created lazily per
 *      modelUrl and cached. Replies:
 *        { type: 'infer', id, ok: true, width, height, data, ep }  (data is the
 *         transferred planar output at 2x resolution; ep is 'webgpu' or 'wasm')
 *        { type: 'infer', id, ok: false, error }
 *
 * A failed inference never terminates the worker; the session cache is only
 * populated with successfully created sessions so a bad model can be retried.
 *
 * The handler logic is exported so the unit suite can drive it without a real
 * worker global: tests shim `self` and inject a fake ORT module before calling
 * the exported handleInit/handleInfer. This file stays an unbundled plain-JS
 * module for the Blob-URL import; exports are inert at worker runtime.
 */

// --- Naga f16-bitcast rewrite hook (must run before ORT is imported) -------

export function rewriteF16Bitcast(code) {
  if (typeof code !== 'string' || code.indexOf('bitcast<vec2<f16>>') === -1) return code;
  return code.replace(
    /bitcast<vec2<f16>>\(([^)]+)\)\[(\d)\]/g,
    (match, expr, idx) => `f16(unpack2x16float(${expr})[${idx}])`,
  );
}

export function installF16RewriteHook() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return;
  const origRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
  navigator.gpu.requestAdapter = async (...args) => {
    const adapter = await origRequestAdapter(...args);
    if (!adapter) return adapter;
    const origRequestDevice = adapter.requestDevice.bind(adapter);
    adapter.requestDevice = async (...deviceArgs) => {
      const device = await origRequestDevice(...deviceArgs);
      const origCreateShaderModule = device.createShaderModule.bind(device);
      device.createShaderModule = descriptor => {
        const patched = { ...descriptor, code: rewriteF16Bitcast(descriptor.code) };
        return origCreateShaderModule(patched);
      };
      return device;
    };
    return adapter;
  };
}

installF16RewriteHook();

// --- ORT session management -------------------------------------------------

let ort = null;
// modelUrl -> { session, ep }
const sessions = new Map();

// Injectable so tests can supply a fake ORT module without touching the
// filesystem or the dynamic import machinery.
let ortLoader = null;
export function __setOrtLoaderForTests(loader) {
  ortLoader = loader;
}

function importOrt(url) {
  if (ortLoader) return ortLoader(url);
  return import(/* webpackIgnore: true */ url);
}

export async function getSession(modelUrl) {
  const cached = sessions.get(modelUrl);
  if (cached) return cached;
  if (!ort) throw new Error('worker not initialised');
  // Prefer a pure WebGPU session so we know exactly which EP ran. If the WebGPU
  // EP cannot build the graph (missing op, no device), fall back to WASM.
  let session;
  let ep = 'webgpu';
  try {
    session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['webgpu'] });
  } catch {
    ep = 'wasm';
    session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
  }
  const entry = { session, ep };
  sessions.set(modelUrl, entry);
  return entry;
}

export async function handleInit(message) {
  try {
    ort = await importOrt(message.ortUrl);
    ort.env.wasm.wasmPaths = message.wasmDir;
    // Single-threaded for now: the worker itself is the offload, and thread
    // workers spawned from a blob worker need separate verification.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    self.postMessage({ type: 'init', ok: true });
  } catch (error) {
    self.postMessage({ type: 'init', ok: false, error: String(error) });
  }
}

export async function handleInfer(message) {
  try {
    if (!ort) throw new Error('worker not initialised');
    const { session, ep } = await getSession(message.modelUrl);
    const inputName = session.inputNames[0] ?? 'input';
    const outputName = session.outputNames[0] ?? 'output';
    const input = new ort.Tensor('float32', message.data, [1, 3, message.height, message.width]);
    const outputs = await session.run({ [inputName]: input });
    const result = outputs[outputName];
    if (!result) throw new Error('RealESRGAN inference returned no output tensor.');
    const data = result.data;
    self.postMessage(
      {
        type: 'infer',
        id: message.id,
        ok: true,
        width: message.width * 2,
        height: message.height * 2,
        data,
        ep,
      },
      [data.buffer],
    );
  } catch (error) {
    self.postMessage({ type: 'infer', id: message.id, ok: false, error: String(error) });
  }
}

/** Test hook: forget injected ORT state and every cached session. */
export function resetWorkerStateForTests() {
  ort = null;
  sessions.clear();
}

self.onmessage = event => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'init') {
    void handleInit(message);
  } else if (message.type === 'infer') {
    void handleInfer(message);
  }
};
