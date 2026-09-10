/**
 * Type declarations for scripts/build-realesrgan-static.mjs (Hebel 2.1).
 * The script itself stays dependency-free plain JS (build-time only, never
 * bundled); this file types its testable surface for tsc/ts-loader.
 */

export interface RealEsrganStaticTarget {
  height: number;
  width: number;
}

export declare const STATIC_TARGETS: RealEsrganStaticTarget[];

export declare function staticFileName(height: number, width: number): string;

export interface ProtoNode {
  field: number;
  wire: number;
  varint?: bigint;
  fixed?: Uint8Array;
  bytes?: Uint8Array;
  children?: ProtoNode[];
}

export declare function parseProto(buf: Uint8Array): ProtoNode[];
export declare function serializeProto(nodes: ProtoNode[]): Buffer;
export declare function patchStaticDims(tree: ProtoNode[], height: number, width: number): ProtoNode[];
export declare function extractIoShapes(tree: ProtoNode[]): { input: number[]; output: number[] };
export declare function diffProtoTrees(a: ProtoNode[], b: ProtoNode[], path?: string): string[];
export declare function assertDimOnlyDiff(
  baseTree: ProtoNode[],
  derivedTree: ProtoNode[],
  height: number,
  width: number,
): void;
export declare function censusGraphOps(tree: ProtoNode[]): Record<string, number>;
export declare function graphInputConsumers(
  tree: ProtoNode[],
  inputName?: string,
): Array<{ op: string; name: string }>;
export declare function buildVariantTo(
  height: number,
  width: number,
  modelDir: string,
  force: boolean,
): { file: string; skipped: boolean; bytes?: number };
