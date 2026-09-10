/**
 * Creates a serializer that queues async operations so they run one at a time,
 * in order. Each operation starts only after the previous one settles (resolves
 * or rejects), preventing interleaved state mutations.
 *
 * Used by the background service worker to serialize native-session lifecycle
 * operations (start, stop, configuration updates) that must not overlap.
 */
export function createAsyncSerializer(): <T>(operation: () => Promise<T>) => Promise<T> {
  let chain: Promise<unknown> = Promise.resolve();
  return function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = chain.then(operation, operation);
    chain = result.then(() => undefined, () => undefined);
    return result;
  };
}

/**
 * Run fire-and-forget work with a rejection handler. A bare `void promise`
 * drops the operation promise and turns a mid-cleanup failure (storage, tab
 * queries, window creation) into an unhandled rejection; this reports it
 * under one scope/label pair. Shared by the background worker and the native
 * session so both detached-task paths behave identically.
 */
export function fireAndForget(promise: Promise<unknown>, scope: string, label: string): void {
  promise.catch(error => {
    console.warn(`[${scope}] ${label} failed:`, error);
  });
}
