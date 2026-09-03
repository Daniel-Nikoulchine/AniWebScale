// Stub the worker global before any bench imports the worker module.
// The worker file assigns `self.onmessage` at top level, which throws in Node
// if `self` is missing. This side-effect import runs first due to ESM order.
if (!(globalThis as unknown as { self?: unknown }).self) {
  (globalThis as unknown as { self: unknown }).self = {
    postMessage: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
