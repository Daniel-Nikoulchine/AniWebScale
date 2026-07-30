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
