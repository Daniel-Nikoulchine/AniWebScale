export class EventScope {
  private readonly disposers: (() => void)[] = [];

  on<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.disposers.push(() => target.removeEventListener(type, listener, options));
  }

  add(disposer: () => void): void {
    this.disposers.push(disposer);
  }

  dispose(): void {
    // Run every disposer even when one throws: aborting midway would leak
    // the remaining listeners. The first error still propagates so a
    // broken custom disposer stays visible (removeEventListener itself
    // never throws, so this only bites custom add() disposers).
    const disposers = this.disposers.splice(0);
    let firstError: unknown;
    let hasError = false;
    for (const disposer of disposers) {
      try {
        disposer();
      } catch (error) {
        if (!hasError) {
          hasError = true;
          firstError = error;
        }
      }
    }
    if (hasError) throw firstError;
  }
}
