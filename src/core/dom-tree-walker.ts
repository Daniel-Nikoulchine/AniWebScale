export type ElementTreeVisitor = (element: Element) => void;

export function walkElementTree(element: Element, visitor: ElementTreeVisitor): void {
  visitor(element);
  if (element.shadowRoot) walkShadowRoot(element.shadowRoot, visitor);
  for (const child of Array.from(element.children ?? [])) walkElementTree(child, visitor);
}

export function walkShadowRoot(root: Document | ShadowRoot, visitor: ElementTreeVisitor): void {
  const elements = 'documentElement' in root
    ? [root.documentElement]
    : Array.from(root.children ?? []);
  for (const element of elements) {
    if (element) walkElementTree(element, visitor);
  }
}

export function walkDocumentTree(root: Document | ShadowRoot, visitor: ElementTreeVisitor): void {
  walkShadowRoot(root, visitor);
}
