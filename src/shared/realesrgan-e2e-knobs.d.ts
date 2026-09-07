/** Canonical E2E knob registry types (see realesrgan-e2e-knobs.js). */
export interface E2eKnob {
  env: string;
  query: string;
  bridge: string | null;
  storage: string | null;
  kind: 'flag' | 'backend' | 'capHeight' | 'precision' | 'string';
}

export declare const E2E_BRIDGE_ACTIONS: {
  CONFIGURE: 'configure';
  CONFIGURE_REALESRGAN: 'configure-realesrgan';
  GET_LOGS: 'get-logs';
  FORCE_OVERLOAD: 'force-overload';
  GET_STATS: 'get-stats';
};

export declare const E2E_BRIDGE_MESSAGE: {
  COMMAND: 'anime4k-e2e-command';
  RESPONSE: 'anime4k-e2e-response';
  LOG: 'anime4k-e2e-log';
};

export declare const E2E_KNOBS: ReadonlyArray<E2eKnob>;

export declare function knobQueryFromEnv(
  knob: E2eKnob,
  envValue: string | undefined,
): string | undefined;

export declare function knobBridgeFromQuery(
  knob: E2eKnob,
  queryValue: string | null,
): string | number | boolean | undefined;

export declare function knobStorageFromBridge(
  knob: E2eKnob,
  bridgeValue: unknown,
): Record<string, unknown> | null;

export declare function e2eKnobQueryKeys(): string[];
