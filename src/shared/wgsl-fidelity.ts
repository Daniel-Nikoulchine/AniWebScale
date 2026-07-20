const PATCH_MARKER = '// anime4k-texture-load-clamp:v1';

const ANIME4K_OVERLAY_SIGNATURES = [
  'var tex_diff: texture_2d<f32>',
  'var tex_origin: texture_2d<f32>',
  'textureSample(tex_origin, mySampler, fragUV)',
  'textureSample(tex_diff, mySampler, fragUV)',
] as const;

const CLAMPED_OVERLAY_RETURN = /return\s+clamp\(\s*color_bilinear\s*\+\s*color_addon\s*,\s*vec4<f32>\(\s*0\.\s*,\s*0\.\s*,\s*0\.\s*,\s*0\.\s*\)\s*,\s*vec4<f32>\(\s*1\.\s*,\s*1\.\s*,\s*1\.\s*,\s*1\.\s*\)\s*\)\s*;/;

function isIdentifierCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function isIdentifierStartCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function skipLineComment(source: string, start: number): number {
  const lineEnd = source.indexOf('\n', start + 2);
  return lineEnd < 0 ? source.length : lineEnd + 1;
}

function skipBlockComment(source: string, start: number): number {
  // WGSL permits nested block comments. Keeping their nesting prevents comment
  // punctuation from being mistaken for part of a textureLoad call.
  let depth = 1;
  let cursor = start + 2;
  while (cursor < source.length && depth > 0) {
    if (source.startsWith('/*', cursor)) {
      depth += 1;
      cursor += 2;
    } else if (source.startsWith('*/', cursor)) {
      depth -= 1;
      cursor += 2;
    } else {
      cursor += 1;
    }
  }
  return cursor;
}

function skipQuotedText(source: string, start: number): number {
  const quote = source[start];
  let cursor = start + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') cursor += 2;
    else if (source[cursor] === quote) return cursor + 1;
    else cursor += 1;
  }
  return source.length;
}

function skipTrivia(source: string, start: number): number {
  let cursor = start;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) cursor += 1;
    else if (source.startsWith('//', cursor)) cursor = skipLineComment(source, cursor);
    else if (source.startsWith('/*', cursor)) cursor = skipBlockComment(source, cursor);
    else break;
  }
  return cursor;
}

function zeroLiteralIgnoringTrivia(source: string): string | null {
  let cursor = skipTrivia(source, 0);
  const start = cursor;
  if (source[cursor] !== '0') return null;
  cursor += 1;
  if (source[cursor] === 'u' || source[cursor] === 'i') cursor += 1;
  const literal = source.slice(start, cursor);
  cursor = skipTrivia(source, cursor);
  return cursor === source.length ? literal : null;
}

function identifierIgnoringTrivia(source: string): string | null {
  let cursor = skipTrivia(source, 0);
  if (!isIdentifierStartCharacter(source[cursor])) return null;
  const start = cursor;
  cursor += 1;
  while (isIdentifierCharacter(source[cursor])) cursor += 1;
  const identifier = source.slice(start, cursor);
  cursor = skipTrivia(source, cursor);
  return cursor === source.length ? identifier : null;
}

function sampledTexture2DIdentifiers(source: string): Set<string> {
  const identifiers = new Set<string>();
  const textureType = 'texture_2d';
  let cursor = 0;

  while (cursor < source.length) {
    if (source.startsWith('//', cursor)) {
      cursor = skipLineComment(source, cursor);
      continue;
    }
    if (source.startsWith('/*', cursor)) {
      cursor = skipBlockComment(source, cursor);
      continue;
    }
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipQuotedText(source, cursor);
      continue;
    }
    if (!isIdentifierStartCharacter(source[cursor])) {
      cursor += 1;
      continue;
    }

    const nameStart = cursor;
    cursor += 1;
    while (isIdentifierCharacter(source[cursor])) cursor += 1;
    const name = source.slice(nameStart, cursor);
    const colon = skipTrivia(source, cursor);
    if (source[colon] !== ':') continue;
    const typeStart = skipTrivia(source, colon + 1);
    if (!source.startsWith(textureType, typeStart)
        || isIdentifierCharacter(source[typeStart + textureType.length])) continue;
    const genericStart = skipTrivia(source, typeStart + textureType.length);
    if (source[genericStart] === '<') identifiers.add(name);
  }

  return identifiers;
}

interface ParsedCall {
  arguments: string[];
  end: number;
}

function parseCall(source: string, openParenthesis: number): ParsedCall | null {
  const argumentsFound: string[] = [];
  let argumentStart = openParenthesis + 1;
  let parenthesisDepth = 1;
  let bracketDepth = 0;
  let braceDepth = 0;
  let cursor = argumentStart;

  while (cursor < source.length) {
    if (source.startsWith('//', cursor)) {
      cursor = skipLineComment(source, cursor);
      continue;
    }
    if (source.startsWith('/*', cursor)) {
      cursor = skipBlockComment(source, cursor);
      continue;
    }
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipQuotedText(source, cursor);
      continue;
    }

    const character = source[cursor];
    if (character === '(') parenthesisDepth += 1;
    else if (character === ')') {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        argumentsFound.push(source.slice(argumentStart, cursor).trim());
        return { arguments: argumentsFound, end: cursor + 1 };
      }
    } else if (character === '[') bracketDepth += 1;
    else if (character === ']') bracketDepth -= 1;
    else if (character === '{') braceDepth += 1;
    else if (character === '}') braceDepth -= 1;
    else if (character === ',' && parenthesisDepth === 1 && bracketDepth === 0 && braceDepth === 0) {
      argumentsFound.push(source.slice(argumentStart, cursor).trim());
      argumentStart = cursor + 1;
    }
    cursor += 1;
  }

  return null;
}

/**
 * Makes Anime4K's integer texel reads match the clamp-to-edge sampling used by
 * the official GLSL. WebGPU leaves out-of-bounds textureLoad values undefined;
 * those values otherwise compound into visible edge errors in repeated passes.
 *
 * Calls are parsed with balanced delimiters instead of a regular expression
 * because the generated CNN coordinates contain nested constructors/comments.
 */
export function clampTextureLoadCoordinates(source: string): string {
  if (source.startsWith(PATCH_MARKER)) return source;

  const sampledTextures = sampledTexture2DIdentifiers(source);
  if (sampledTextures.size === 0) return source;

  const identifier = 'textureLoad';
  const chunks: string[] = [];
  let copiedThrough = 0;
  let cursor = 0;
  let replacements = 0;

  while (cursor < source.length) {
    if (source.startsWith('//', cursor)) {
      cursor = skipLineComment(source, cursor);
      continue;
    }
    if (source.startsWith('/*', cursor)) {
      cursor = skipBlockComment(source, cursor);
      continue;
    }
    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipQuotedText(source, cursor);
      continue;
    }
    if (!source.startsWith(identifier, cursor)
        || isIdentifierCharacter(source[cursor - 1])
        || isIdentifierCharacter(source[cursor + identifier.length])) {
      cursor += 1;
      continue;
    }

    const openParenthesis = skipTrivia(source, cursor + identifier.length);
    if (source[openParenthesis] !== '(') {
      cursor += identifier.length;
      continue;
    }
    const parsed = parseCall(source, openParenthesis);
    if (!parsed) break;

    // Anime4K's CNN WGSL uses only 2D sampled textures at mip zero. Storage
    // reads, array reads and nonzero mip reads are deliberately left alone.
    const mip = parsed.arguments.length === 3
      ? zeroLiteralIgnoringTrivia(parsed.arguments[2])
      : null;
    if (mip) {
      const [texture, coordinate] = parsed.arguments;
      const textureIdentifier = texture ? identifierIgnoringTrivia(texture) : null;
      if (textureIdentifier && sampledTextures.has(textureIdentifier) && coordinate) {
        const boundedCoordinate = `clamp(vec2i(${coordinate}), vec2i(0), vec2i(textureDimensions(${texture})) - vec2i(1))`;
        chunks.push(source.slice(copiedThrough, cursor));
        chunks.push(`textureLoad(${texture}, ${boundedCoordinate}, ${mip})`);
        copiedThrough = parsed.end;
        replacements += 1;
      }
    }
    cursor = parsed.end;
  }

  if (replacements === 0) return source;
  chunks.push(source.slice(copiedThrough));
  return `${PATCH_MARKER}\n${chunks.join('')}`;
}

/**
 * The upstream WebGPU helper clips every residual-overlay result to [0, 1].
 * Official Anime4K GLSL returns the sum unchanged, preserving negative and
 * over-range RGBA16F values for a following restore/upscale pass. Clipping is
 * especially visible in A+A after its second pass, so remove only the exact
 * known helper statement and leave every model-authored clamp untouched.
 */
export function preserveAnime4KIntermediateRange(source: string): string {
  if (!ANIME4K_OVERLAY_SIGNATURES.every(signature => source.includes(signature))) return source;
  return source.replace(CLAMPED_OVERLAY_RETURN, 'return color_bilinear + color_addon;');
}

/**
 * Facade used only for Anime4K pipelines. Canvas/context APIs keep the native
 * GPUDevice identity, while every WebGPU method remains bound to that device.
 */
export function createAnime4KShaderDevice(
  device: GPUDevice,
  onTextureCreated?: (texture: GPUTexture) => void,
): GPUDevice {
  const createShaderModule = device.createShaderModule.bind(device);
  const createTexture = device.createTexture.bind(device);
  return new Proxy(device, {
    get(target, property) {
      if (property === 'createShaderModule') {
        return (descriptor: GPUShaderModuleDescriptor): GPUShaderModule => createShaderModule({
          ...descriptor,
          code: preserveAnime4KIntermediateRange(clampTextureLoadCoordinates(descriptor.code)),
        });
      }
      if (property === 'createTexture') {
        return (descriptor: GPUTextureDescriptor): GPUTexture => {
          const texture = createTexture(descriptor);
          onTextureCreated?.(texture);
          return texture;
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
