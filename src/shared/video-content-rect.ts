export interface VideoContentRectInput {
  left: number;
  top: number;
  width: number;
  height: number;
  videoWidth: number;
  videoHeight: number;
  objectFit: string;
  objectPosition?: string;
}

export interface VideoContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AxisPosition {
  token: string;
  edge?: 'start' | 'end';
}

function tokenizePosition(value: string | undefined): string[] {
  const input = (value ?? '50% 50%').trim().toLowerCase();
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  for (const character of input) {
    if (/\s/.test(character) && depth === 0) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    if (character === '(') depth += 1;
    else if (character === ')' && depth > 0) depth -= 1;
    current += character;
  }
  if (current) tokens.push(current);
  return tokens;
}

function isHorizontalKeyword(token: string): boolean {
  return token === 'left' || token === 'right';
}

function isVerticalKeyword(token: string): boolean {
  return token === 'top' || token === 'bottom';
}

function isPositionKeyword(token: string): boolean {
  return isHorizontalKeyword(token) || isVerticalKeyword(token) || token === 'center';
}

function parseEdgePosition(tokens: readonly string[]): { x: AxisPosition; y: AxisPosition } | null {
  if (tokens.length < 3 || tokens.length > 4) return null;
  let x: AxisPosition | undefined;
  let y: AxisPosition | undefined;
  let centers = 0;
  let consumedOffset = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === 'center') {
      centers += 1;
      continue;
    }
    const horizontal = isHorizontalKeyword(token);
    const vertical = isVerticalKeyword(token);
    if (!horizontal && !vertical) return null;
    let offset = '0px';
    if (index + 1 < tokens.length && !isPositionKeyword(tokens[index + 1])) {
      offset = tokens[index + 1];
      index += 1;
      consumedOffset = true;
    }
    const position: AxisPosition = {
      token: offset,
      edge: token === 'right' || token === 'bottom' ? 'end' : 'start',
    };
    if (horizontal) {
      if (x) return null;
      x = position;
    } else {
      if (y) return null;
      y = position;
    }
  }
  if (!consumedOffset || centers > Number(!x) + Number(!y)) return null;
  return { x: x ?? { token: '50%' }, y: y ?? { token: '50%' } };
}

function positions(value: string | undefined): { x: AxisPosition; y: AxisPosition } {
  const tokens = tokenizePosition(value);
  const edgePosition = parseEdgePosition(tokens);
  if (edgePosition) return edgePosition;
  if (tokens.length <= 1) {
    const token = tokens[0] ?? '50%';
    return isVerticalKeyword(token)
      ? { x: { token: '50%' }, y: { token } }
      : { x: { token }, y: { token: '50%' } };
  }
  const [first, second] = tokens;
  const reversed = isVerticalKeyword(first) || isHorizontalKeyword(second);
  return reversed
    ? { x: { token: second }, y: { token: first } }
    : { x: { token: first }, y: { token: second } };
}

function numericPosition(token: string, freeSpace: number): number | null {
  if (token === '0') return 0;
  const simple = /^([+-]?(?:\d+\.?\d*|\.\d+))(%|px)$/.exec(token);
  if (simple) {
    const amount = Number.parseFloat(simple[1]);
    return simple[2] === '%' ? freeSpace * amount / 100 : amount;
  }
  if (!token.startsWith('calc(') || !token.endsWith(')')) return null;
  const expression = token.slice(5, -1);
  let total = 0;
  let consumed = '';
  const terms = /([+-]?)\s*((?:\d+\.?\d*|\.\d+))\s*(%|px)/g;
  for (const match of expression.matchAll(terms)) {
    consumed += match[0];
    const sign = match[1] === '-' ? -1 : 1;
    const amount = Number.parseFloat(match[2]);
    total += sign * (match[3] === '%' ? freeSpace * amount / 100 : amount);
  }
  return consumed.replace(/\s/g, '') === expression.replace(/\s/g, '') && consumed.length > 0
    ? total
    : null;
}

function positionOffset(position: AxisPosition, freeSpace: number): number {
  const { token } = position;
  const numeric = numericPosition(token, freeSpace);
  if (position.edge) {
    const offset = numeric ?? 0;
    return position.edge === 'end' ? freeSpace - offset : offset;
  }
  if (token === 'left' || token === 'top') return 0;
  if (token === 'right' || token === 'bottom') return freeSpace;
  if (token === 'center') return freeSpace * 0.5;
  return numeric ?? freeSpace * 0.5;
}

/** Returns the visible pixels occupied by the decoded video inside its element. */
export function calculateRenderedVideoRect(input: VideoContentRectInput): VideoContentRect {
  const boxWidth = Math.max(0, input.width);
  const boxHeight = Math.max(0, input.height);
  const sourceWidth = Math.max(1, input.videoWidth || boxWidth);
  const sourceHeight = Math.max(1, input.videoHeight || boxHeight);
  const fit = input.objectFit || 'fill';
  const containScale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  let renderedWidth: number;
  let renderedHeight: number;
  if (fit === 'fill') {
    renderedWidth = boxWidth;
    renderedHeight = boxHeight;
  } else {
    const scale = fit === 'none' ? 1
      : fit === 'cover' ? Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight)
        : fit === 'scale-down' ? Math.min(1, containScale)
          : containScale;
    renderedWidth = sourceWidth * scale;
    renderedHeight = sourceHeight * scale;
  }

  const objectPosition = positions(input.objectPosition);
  const offsetX = positionOffset(objectPosition.x, boxWidth - renderedWidth);
  const offsetY = positionOffset(objectPosition.y, boxHeight - renderedHeight);
  const visibleLeft = Math.max(0, offsetX);
  const visibleTop = Math.max(0, offsetY);
  const visibleRight = Math.min(boxWidth, offsetX + renderedWidth);
  const visibleBottom = Math.min(boxHeight, offsetY + renderedHeight);
  return {
    left: input.left + visibleLeft,
    top: input.top + visibleTop,
    width: Math.max(0, visibleRight - visibleLeft),
    height: Math.max(0, visibleBottom - visibleTop),
  };
}
