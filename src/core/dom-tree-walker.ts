export type ElementTreeVisitor = (element: Element) => void;

export function walkElementTree(element: Element, visitor: ElementTreeVisitor): void {
  visitor(element);
  if (element.shadowRoot) walkTree(element.shadowRoot, visitor);
  for (const child of Array.from(element.children ?? [])) walkElementTree(child, visitor);
}

/**
 * The single entry point for walking a Document or ShadowRoot subtree
 * (light DOM plus nested shadow roots), visiting every element once.
 */
export function walkTree(root: Document | ShadowRoot, visitor: ElementTreeVisitor): void {
  const elements = 'documentElement' in root
    ? [root.documentElement]
    : Array.from(root.children ?? []);
  for (const element of elements) {
    if (element) walkElementTree(element, visitor);
  }
}
