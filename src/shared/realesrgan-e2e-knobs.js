/**
 * Canonical E2E knob registry (single source of truth).
 *
 * One knob travels four hops: runner env -> page query -> bridge payload ->
 * storage flag. Every hop used to hand-sync its own names; the token-reload
 * allowlist silently dropped new knobs twice. Add a knob as one row here;
 * the runner, the page shim and the bridge all derive from this table.
 *
 * Plain JavaScript, zero imports: consumed by the node runner, the bundled
 * content script and vitest alike. Types live in realesrgan-e2e-knobs.d.ts.
 */

/** Bridge action names (runner page <-> content script). */
export const E2E_BRIDGE_ACTIONS = {
  CONFIGURE: 'configure',
  CONFIGURE_REALESRGAN: 'configure-realesrgan',
  GET_LOGS: 'get-logs',
  FORCE_OVERLOAD: 'force-overload',
  GET_STATS: 'get-stats',
};

/** window.postMessage / CustomEvent types (page shim <-> content script). */
export const E2E_BRIDGE_MESSAGE = {
  COMMAND: 'anime4k-e2e-command',
  RESPONSE: 'anime4k-e2e-response',
  LOG: 'anime4k-e2e-log',
};

/**
 * One row per knob. `bridge: null` / `storage: null` means the hop ends
 * there (page-only knobs like forceOverload never reach storage).
 */
export const E2E_KNOBS = [
  { env: 'E2E_BACKEND', query: 'backend', bridge: 'backend', storage: 'backend', kind: 'backend' },
  { env: 'E2E_CAP_HEIGHT', query: 'cap', bridge: 'realesrganCapHeight', storage: 'realesrganCapHeight', kind: 'capHeight' },
  { env: 'E2E_PRECISION', query: 'precision', bridge: 'realesrganPrecision', storage: 'realesrganPrecision', kind: 'precision' },
  { env: 'E2E_VULKAN_SRVGG', query: 'srvggVulkan', bridge: 'vulkanSrvgg', storage: 'vulkanSrvgg', kind: 'flag' },
  { env: 'E2E_FORCE_WORKER', query: 'forceWorker', bridge: 'forceWorker', storage: 'e2eForceWorker', kind: 'flag' },
  { env: 'E2E_MODEL_FILE', query: 'modelFile', bridge: 'modelFile', storage: 'e2eModelFile', kind: 'string' },
  { env: 'E2E_FORCE_OVERLOAD', query: 'forceOverload', bridge: null, storage: null, kind: 'flag' },
];

/** Runner env value -> page query value (undefined = knob absent). */
export function knobQueryFromEnv(knob, envValue) {
  if (envValue === undefined || envValue === null || envValue === '') return undefined;
  if (knob.kind === 'flag') return envValue === '1' ? '1' : undefined;
  return envValue;
}

/** Page query value -> bridge payload value (validated, undefined = absent). */
export function knobBridgeFromQuery(knob, queryValue) {
  if (queryValue === undefined || queryValue === null || queryValue === '') return undefined;
  if (knob.kind === 'flag') return queryValue === '1' ? true : undefined;
  if (knob.kind === 'backend') return queryValue === 'native' ? 'native' : 'webgpu';
  if (knob.kind === 'capHeight') {
    const height = Number(queryValue);
    return height === 360 || height === 405 || height === 432 || height === 480 ? height : undefined;
  }
  if (knob.kind === 'precision') {
    return queryValue === 'fp32' || queryValue === 'fp16' || queryValue === 'int8' ? queryValue : undefined;
  }
  return queryValue;
}

/** Bridge payload value -> storage patch (null = nothing to store). */
export function knobStorageFromBridge(knob, bridgeValue) {
  if (!knob.storage || bridgeValue === undefined) return null;
  if (knob.kind === 'flag') return bridgeValue === true ? { [knob.storage]: true } : null;
  return { [knob.storage]: bridgeValue };
}

/** Query keys that survive the token reload (every table query). */
export function e2eKnobQueryKeys() {
  return E2E_KNOBS.map(knob => knob.query);
}
