/**
 * Canonical RealESRGAN worker protocol types (see realesrgan-worker-protocol.js).
 * The worker client, the worker .d.ts mirror and test fakes all import these
 * instead of redeclaring message shapes.
 */

export interface WorkerInitMessage {
  type: 'init';
  ortUrl: string;
  wasmDir: string;
  /** Pixel-kernel module URL (optional; lazy non-fatal load). */
  pixelsUrl?: string;
}

export interface WorkerInferMessage {
  type: 'infer';
  id: number;
  modelUrl: string;
  modelUrlFp16: string | null;
  width: number;
  height: number;
  data: Float32Array;
  /** Presentation target (absent/0 = full 4x). */
  targetWidth?: number;
  targetHeight?: number;
}

export interface WorkerInitReply {
  type: 'init';
  ok: boolean;
  error?: string;
}

export interface WorkerInferReply {
  type: 'infer';
  id: number;
  ok: boolean;
  /** Taxonomy code on ok:false (see realesrgan-worker-protocol.js). */
  code?: 'worker-timeout' | 'worker-failed';
  width?: number;
  height?: number;
  /** Fresh ArrayBuffer clone per structured-clone delivery (never shared). */
  data?: Uint8Array<ArrayBuffer>;
  path?: string;
  /** True when the fp16 model served this frame (ok:true only). */
  fp16?: boolean;
  error?: string;
}

export type WorkerReply = WorkerInitReply | WorkerInferReply;

export declare function isWorkerReply(value: unknown): value is WorkerReply;

/** Canonical error codes on ok:false infer replies (the worker inlines them). */
export declare const WORKER_REPLY_ERROR_CODES: {
  readonly TIMEOUT: 'worker-timeout';
  readonly FAILED: 'worker-failed';
};

/** Build the init message the client sends right after spawning the worker. */
export declare function buildWorkerInitMessage(init: {
  ortUrl: string;
  wasmDir: string;
  pixelsUrl?: string;
}): WorkerInitMessage;

/** Build one infer request (target fields ride along only when positive). */
export declare function buildWorkerInferMessage(infer: {
  id: number;
  modelUrl: string;
  modelUrlFp16: string | null;
  width: number;
  height: number;
  data: Float32Array;
  targetWidth?: number;
  targetHeight?: number;
}): WorkerInferMessage;
