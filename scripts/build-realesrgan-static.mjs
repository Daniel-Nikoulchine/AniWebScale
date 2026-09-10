#!/usr/bin/env node
/**
 * Build static-shape RealESRGAN variants (Hebel 2.1).
 *
 * The shipped model carries symbolic dims (batch_size/height/width), so every
 * path needs crutches: freeDimensionOverrides per session, shape-pinned
 * session caches, and ORT 1.29's "Shape mismatch attempting to re-use
 * buffer" rebuild workaround. A static variant has concrete dims baked in:
 * no symbolic dims, no overrides, no rebuild path, and both runtimes may
 * constant-fold harder and pick kernels up front.
 *
 * This script rewrites ONLY the 6 dim leaves (input + output decls, batch and
 * spatial; channel stays 3) of the base model with zero dependencies: a minimal protobuf tree codec parses
 * the file, the patch swaps dim_param -> dim_value at the four input and
 * four output positions, and lengths are recomputed bottom-up on serialize.
 * Everything else round-trips byte-identically BY CONSTRUCTION (the codec
 * preserves field order, wire types and minimal varint encoding).
 *
 * Equivalence proof (no ORT needed, runs every build): the script re-parses
 * base + derived and asserts via a path-tracked recursive diff that the ONLY
 * differences are the 6 dim leaves (old: the symbolic names, new: the
 * concrete values), plus node/initializer counts. Same graph, same weights,
 * same ops — shapes are session-build metadata.
 *
 * Usage:
 *   node scripts/build-realesrgan-static.mjs [--check] [--force]
 *   --check  fail when a present variant does not byte-match the deterministic
 *            derivation from the base model; a missing (git-ignored, build-only)
 *            variant is reported but not fatal
 *   --force  rebuild every variant
 *
 * Idempotent by content: a variant is skipped when its bytes already equal the
 * deterministic derivation from the base model. Generated files live next to
 * the base model and are git-ignored build artifacts; the runtime serves them
 * only on exact-shape match with dynamic fallback otherwise.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_DIR = join(repoRoot, 'models', 'realesrgan');
const BASE_FILE = 'RealESR-AnimeVideo-v3_x4.onnx';

/**
 * Cap presets (16:9) plus the 4:3@480 shape that already existed by hand.
 * Sourced from the single asset registry (src/shared/realesrgan-assets.json)
 * so the builder and the runtime cannot drift — same list, height-first
 * shape like before.
 */
const assetRegistry = JSON.parse(readFileSync(join(repoRoot, 'src', 'shared', 'realesrgan-assets.json'), 'utf8'));
export const STATIC_TARGETS = assetRegistry.staticShapes.map(shape => ({
  height: shape.height,
  width: shape.width,
}));

export function staticFileName(height, width) {
  return `RealESR-AnimeVideo-v3_x4.static-${height}x${width}.onnx`;
}

// --- Minimal protobuf tree codec -------------------------------------------
// Nodes: { field, wire, varint?: bigint, fixed?: Buffer, bytes?: Buffer, children?: Node[] }.
// LEN payloads are always parsed recursively; re-serialization recomputes
// lengths, so untouched subtrees round-trip byte-identically. Groups (wire
// 3/4) never occur in modern ONNX and abort loudly.

function readVarint(buf, offset) {
  let value = 0n;
  let shift = 0n;
  let pos = offset;
  for (;;) {
    if (pos >= buf.length) throw new Error('protobuf: truncated varint');
    const byte = buf[pos];
    pos += 1;
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7n;
    if (shift > 70n) throw new Error('protobuf: varint overflow');
  }
  return { value, next: pos };
}

function writeVarint(value, out) {
  let v = BigInt(value);
  for (;;) {
    const byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v === 0n) {
      out.push(byte);
      return;
    }
    out.push(byte | 0x80);
  }
}

function parseMessage(buf, start, end) {
  const nodes = [];
  let pos = start;
  while (pos < end) {
    const tag = readVarint(buf, pos);
    pos = tag.next;
    const field = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (field <= 0) throw new Error('protobuf: invalid field number');
    if (wire === 0) {
      const v = readVarint(buf, pos);
      pos = v.next;
      nodes.push({ field, wire, varint: v.value });
    } else if (wire === 1 || wire === 5) {
      const size = wire === 1 ? 8 : 4;
      if (pos + size > end) throw new Error('protobuf: truncated fixed');
      nodes.push({ field, wire, fixed: buf.subarray(pos, pos + size) });
      pos += size;
    } else if (wire === 2) {
      const len = readVarint(buf, pos);
      pos = len.next;
      const payloadEnd = pos + Number(len.value);
      if (payloadEnd > end) throw new Error('protobuf: truncated length-delimited');
      const payload = buf.subarray(pos, payloadEnd);
      // Empty payload parses as zero children; garbage throws and stays
      // opaque bytes. A payload that parses is only treated as a message
      // when it re-serializes byte-identically (see guard below).
      let children = null;
      try {
        const parsed = payload.length === 0 ? [] : parseMessage(payload, 0, payload.length);
        if (Buffer.from(serializeNodes(parsed)).equals(payload)) children = parsed;
      } catch {
        children = null;
      }
      // Heuristic guard (folded into the try above): a payload that parses
      // but does not re-serialize byte-identically (e.g. raw weight bytes
      // that happen to look like fields) stays opaque, so the structural
      // diff below never sees phantom structure. Either way the codec
      // round-trips byte-identically.
      nodes.push(children !== null
        ? { field, wire, children }
        : { field, wire, bytes: payload });
      pos = payloadEnd;
    } else {
      throw new Error(`protobuf: unsupported wire type ${wire} (groups?)`);
    }
  }
  if (pos !== end) throw new Error('protobuf: trailing bytes');
  return nodes;
}

export function parseProto(buf) {
  return parseMessage(Buffer.from(buf), 0, buf.length);
}

function serializeNodes(nodes) {
  const out = [];
  for (const node of nodes) {
    writeVarint((BigInt(node.field) << 3n) | BigInt(node.wire), out);
    if (node.wire === 0 && node.varint !== undefined) {
      writeVarint(node.varint, out);
    } else if ((node.wire === 1 || node.wire === 5) && node.fixed) {
      for (const byte of node.fixed) out.push(byte);
    } else if (node.wire === 2) {
      const payload = node.children
        ? Buffer.from(serializeNodes(node.children))
        : (node.bytes ?? Buffer.alloc(0));
      writeVarint(BigInt(payload.length), out);
      for (const byte of payload) out.push(byte);
    } else {
      throw new Error('protobuf: cannot serialize node (lost payload?)');
    }
  }
  return out;
}

export function serializeProto(nodes) {
  return Buffer.from(serializeNodes(nodes));
}

function childByField(nodes, field) {
  return nodes.filter(n => n.field === field);
}

function singleChild(nodes, field, what) {
  const found = childByField(nodes, field);
  if (found.length !== 1) throw new Error(`onnx: expected exactly one ${what}, got ${found.length}`);
  return found[0];
}

function childrenOf(node) {
  if (!node.children) throw new Error('onnx: expected message payload, found opaque bytes');
  return node.children;
}

// --- Static-dim patch --------------------------------------------------------
// ModelProto.graph = 7; GraphProto: node = 1, initializer = 5, input = 11,
// output = 12. ValueInfo: name = 1, type = 2; Type.tensor_type = 1;
// Tensor: elem_type = 1, shape = 2; Shape: dim = 1 (repeated);
// Dim: dim_value = 1 (varint), dim_param = 2 (string).

function leafString(node) {
  if (node.wire !== 2 || node.children) throw new Error('onnx: expected string leaf');
  return (node.bytes ?? Buffer.alloc(0)).toString('utf8');
}

function getIoShapeDims(ioNode) {
  const type = singleChild(childrenOf(ioNode), 2, 'ValueInfo.type');
  const tensor = singleChild(childrenOf(type), 1, 'Type.tensor_type');
  const shape = singleChild(childrenOf(tensor), 2, 'Tensor.shape');
  return childByField(childrenOf(shape), 1);
}

function readDimValue(dim) {
  for (const leaf of childrenOf(dim)) {
    if (leaf.field === 1 && leaf.wire === 0) return { kind: 'value', value: Number(leaf.varint) };
    if (leaf.field === 2) return { kind: 'param', value: leafString(leaf) };
  }
  throw new Error('onnx: dim has neither dim_value nor dim_param');
}

function setDimValue(dim, value) {
  const kids = childrenOf(dim);
  const idx = kids.findIndex(leaf => leaf.field === 1 || leaf.field === 2);
  if (idx === -1) throw new Error('onnx: dim has no value leaf to replace');
  kids[idx] = { field: 1, wire: 0, varint: BigInt(value) };
}

/**
 * Patch the graph's input[0]/output[0] decls to concrete dims. Returns the
 * patched tree; throws unless the base decls are exactly [1,3,H,W]-shaped
 * with symbolic spatial dims (position-based, any param names).
 */
export function patchStaticDims(tree, height, width) {
  const graph = singleChild(tree, 7, 'ModelProto.graph');
  const gkids = childrenOf(graph);
  const inputDecl = singleChild(gkids, 11, 'graph.input');
  const outputDecl = singleChild(gkids, 12, 'graph.output');
  const inputName = leafString(singleChild(childrenOf(inputDecl), 1, 'ValueInfo.name'));
  if (inputName !== 'input') throw new Error(`onnx: unexpected graph input name ${inputName}`);
  const shapes = [
    { decl: inputDecl, dims: [1, 3, height, width], what: 'input' },
    { decl: outputDecl, dims: [1, 3, height * 4, width * 4], what: 'output' },
  ];
  for (const { decl, dims, what } of shapes) {
    const dimNodes = getIoShapeDims(decl);
    if (dimNodes.length !== 4) throw new Error(`onnx: ${what} decl is not 4-D`);
    const current = dimNodes.map(readDimValue);
    // Position-based: [batch, 3, H, W] with symbolic batch + spatial dims
    // (any param names: batch_size/height/width, possibly out_* on outputs).
    const batchOk = (current[0].kind === 'value' && current[0].value === 1) || current[0].kind === 'param';
    if (!batchOk
      || current[1].kind !== 'value' || current[1].value !== 3
      || current[2].kind !== 'param' || current[3].kind !== 'param') {
      throw new Error(`onnx: ${what} decl is not [batch,3,sym,sym]: ${JSON.stringify(current)}`);
    }
    dims.forEach((value, i) => setDimValue(dimNodes[i], value));
  }
  return tree;
}

/** Read back [N,C,H,W] of graph input[0]/output[0]; throws on symbolic dims. */export function extractIoShapes(tree) {
  const graph = singleChild(tree, 7, 'ModelProto.graph');
  const gkids = childrenOf(graph);
  const read = (field, what) => {
    const decls = childByField(gkids, field);
    if (decls.length < 1) throw new Error(`onnx: graph has no ${what} decl`);
    return getIoShapeDims(decls[0]).map(d => {
      const v = readDimValue(d);
      if (v.kind !== 'value') throw new Error(`onnx: ${what} dim still symbolic: ${v.value}`);
      return v.value;
    });
  };
  return { input: read(11, 'input'), output: read(12, 'output') };
}

/**
 * Hebel 2.3 census: node op_type counts + input fan-out of the graph. The
 * perf page claims three fusion gaps (input Split, unfused Conv+PReLU,
 * extra pre/postproc passes) — this census is the regression gate: any graph
 * change that adds data-movement nodes fails the suite instead of silently
 * shipping a fatter graph.
 */
export function censusGraphOps(tree) {
  const graph = singleChild(tree, 7, 'ModelProto.graph');
  const counts = {};
  for (const node of childByField(childrenOf(graph), 1)) {
    const kids = childrenOf(node);
    const opLeaf = kids.find(n => n.field === 4 && n.wire === 2 && !n.children);
    if (!opLeaf) throw new Error('onnx: node without op_type');
    const op = (opLeaf.bytes ?? Buffer.alloc(0)).toString('utf8');
    counts[op] = (counts[op] ?? 0) + 1;
  }
  return counts;
}

/** Names of nodes consuming the graph input directly (Split-free fan-out?). */
export function graphInputConsumers(tree, inputName = 'input') {
  const graph = singleChild(tree, 7, 'ModelProto.graph');
  const consumers = [];
  for (const node of childByField(childrenOf(graph), 1)) {
    const kids = childrenOf(node);
    const inputs = kids.filter(n => n.field === 1 && n.wire === 2 && !n.children)
      .map(n => (n.bytes ?? Buffer.alloc(0)).toString('utf8'));
    if (inputs.includes(inputName)) {
      const opLeaf = kids.find(n => n.field === 4 && n.wire === 2 && !n.children);
      const nameLeaf = kids.find(n => n.field === 3 && n.wire === 2 && !n.children);
      consumers.push({
        op: opLeaf ? opLeaf.bytes.toString('utf8') : '?',
        name: nameLeaf ? nameLeaf.bytes.toString('utf8') : '?',
      });
    }
  }
  return consumers;
}

/**
 * Path-tracked recursive diff. Returns human-readable difference lines;
 * empty means byte-identical trees (length prefixes excluded — they are
 * implicit in the tree form).
 */
export function diffProtoTrees(a, b, path = '') {
  const diffs = [];
  if (a.length !== b.length) {
    diffs.push(`${path || '<root>'}: child count ${a.length} != ${b.length}`);
    return diffs;
  }
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    const here = `${path}/${x.field}${x.wire === 2 ? (x.children ? '{}' : '()') : ''}[${i}]`;
    if (x.field !== y.field || x.wire !== y.wire) {
      diffs.push(`${here}: node mismatch`);
      continue;
    }
    if (x.children || y.children) {
      if (!x.children || !y.children) {
        diffs.push(`${here}: message vs bytes`);
        continue;
      }
      diffs.push(...diffProtoTrees(x.children, y.children, here));
      continue;
    }
    if (x.wire === 0) {
      if (x.varint !== y.varint) diffs.push(`${here}: ${x.varint} != ${y.varint}`);
    } else if (x.wire === 1 || x.wire === 5) {
      if (!Buffer.from(x.fixed).equals(Buffer.from(y.fixed))) diffs.push(`${here}: fixed bytes differ`);
    } else {
      const xb = Buffer.from(x.bytes ?? []);
      const yb = Buffer.from(y.bytes ?? []);
      if (!xb.equals(yb)) {
        const preview = (buf) => (buf.length <= 24 ? buf.toString('utf8') : `${buf.toString('utf8').slice(0, 24)}…[${buf.length}B]`);
        diffs.push(`${here}: bytes differ: ${JSON.stringify(preview(xb))} != ${JSON.stringify(preview(yb))}`);
      }
    }
  }
  return diffs;
}

/** Assert the ONLY tree differences are the 6 symbolic->concrete dim swaps
 * (batch + spatial, in + out; the channel dim is 3 on both sides), and that
 * the derived I/O shapes equal the targets. */
export function assertDimOnlyDiff(baseTree, derivedTree, height, width) {
  const diffs = diffProtoTrees(baseTree, derivedTree);
  const dimDiff = /^\/7\{\}\[\d+\]\/(11|12)\{\}\[\d+\]\/2\{\}\[\d+\]\/1\{\}\[\d+\]\/2\{\}\[\d+\]\/1\{\}\[(\d+)\]\/(1|2)(\{\}|\(\))\[\d+\]$/;
  const positions = [];
  const bad = [];
  for (const line of diffs) {
    const match = dimDiff.exec(line.split(':')[0]);
    if (!match) {
      bad.push(line);
      continue;
    }
    positions.push(`${match[1]}:${match[2]}`);
  }
  if (bad.length > 0) {
    throw new Error(`static model changes non-dim nodes:\n${bad.slice(0, 10).join('\n')}`);
  }
  // 6 dim leaves changed (batch+2 spatial, in+out); channel stays 3 == 3.
  const want = ['11:0', '11:2', '11:3', '12:0', '12:2', '12:3'].sort().join(',');
  if (positions.sort().join(',') !== want) {
    throw new Error(`static model expected dim swaps at ${want}, got ${positions.sort().join(',') || '(none)'}`);
  }
  const shapes = extractIoShapes(derivedTree);
  const wantIn = [1, 3, height, width];
  const wantOut = [1, 3, height * 4, width * 4];
  if (JSON.stringify(shapes.input) !== JSON.stringify(wantIn)
    || JSON.stringify(shapes.output) !== JSON.stringify(wantOut)) {
    throw new Error(`static shape mismatch: got ${JSON.stringify(shapes)}`);
  }
}

// --- Build -------------------------------------------------------------------

function buildVariant(height, width, force) {
  return buildVariantTo(height, width, MODEL_DIR, force);
}

/**
 * Deterministically derive the expected variant bytes from the base model and
 * prove the only differences are the 6 dim leaves. Pure content comparison —
 * no mtimes, so a fresh checkout (all files sharing a timestamp) cannot look
 * stale.
 */
function expectedVariantBytes(height, width, modelDir) {
  const basePath = join(modelDir, BASE_FILE);
  if (!existsSync(basePath)) throw new Error(`base model missing: ${basePath}`);
  const baseBytes = readFileSync(basePath);
  const baseTree = parseProto(baseBytes);
  // Round-trip self-check: the codec must reproduce the base byte-identically
  // before it is trusted to rewrite anything.
  if (!serializeProto(baseTree).equals(baseBytes)) {
    throw new Error('protobuf codec round-trip mismatch on the base model; refusing to patch');
  }
  const patched = patchStaticDims(baseTree, height, width);
  const derivedBytes = serializeProto(patched);
  assertDimOnlyDiff(parseProto(baseBytes), parseProto(derivedBytes), height, width);
  return derivedBytes;
}

export function buildVariantTo(height, width, modelDir, force) {
  const file = staticFileName(height, width);
  const outPath = join(modelDir, file);
  const derivedBytes = expectedVariantBytes(height, width, modelDir);
  const current = existsSync(outPath) ? readFileSync(outPath) : null;
  if (!force && current && current.equals(derivedBytes)) {
    return { file, skipped: true };
  }
  mkdirSync(modelDir, { recursive: true });
  writeFileSync(outPath, derivedBytes);
  return { file, skipped: false, bytes: derivedBytes.length };
}

/** 'current' when the bytes match, 'stale' when present but divergent, 'missing' when absent. */
function variantStatus(height, width) {
  const outPath = join(MODEL_DIR, staticFileName(height, width));
  if (!existsSync(outPath)) return 'missing';
  return readFileSync(outPath).equals(expectedVariantBytes(height, width, MODEL_DIR)) ? 'current' : 'stale';
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has('--check');
  const force = args.has('--force');
  if (check) {
    const stale = [];
    const missing = [];
    for (const t of STATIC_TARGETS) {
      const status = variantStatus(t.height, t.width);
      if (status === 'stale') stale.push(staticFileName(t.height, t.width));
      else if (status === 'missing') missing.push(staticFileName(t.height, t.width));
    }
    if (stale.length > 0) {
      console.error(`realesrgan-static --check: present but divergent (run npm run generate:realesrgan-static): ${stale.join(', ')}`);
      process.exit(1);
    }
    if (missing.length > 0) {
      console.warn(`realesrgan-static --check: ${missing.length} variant(s) not built in this checkout (git-ignored build output): ${missing.join(', ')}`);
    }
    console.log(`realesrgan-static --check: ${STATIC_TARGETS.length - missing.length} variants byte-match the deterministic derivation.`);
    return;
  }
  for (const t of STATIC_TARGETS) {
    const result = buildVariant(t.height, t.width, force);
    console.log(`realesrgan-static: ${result.file} ${result.skipped ? 'fresh, skipped' : `built (${result.bytes} bytes)`}`);
  }
}

const invokedAsScript = typeof process.argv[1] === 'string'
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  await main();
}
