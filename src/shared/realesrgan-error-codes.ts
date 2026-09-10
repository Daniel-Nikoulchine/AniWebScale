/**
 * Canonical RealESRGAN failure codes (single source of truth).
 *
 * Every verdict-relevant failure logs `[RealESRGAN:{code}]` ahead of its
 * human text. The E2E verdict matches codes instead of free prose, so a
 * reworded message can no longer slip past the gate silently. Codes split
 * fatal (no recovery: gate fails) from transient (retry covers it: gate
 * reports counts). Human text stays untouched for console debugging.
 */
export const REALESRGAN_ERROR_CODES = {
  /** Pipeline frame failed; next frame retries (transient). */
  PIPELINE_INFER_RETRY: 'infer-retry',
  /** Worker inference timed out; worker retries next frame (transient). */
  WORKER_TIMEOUT: 'worker-timeout',
  /** Worker inference failed; main-thread session takes over (fatal). */
  WORKER_FAILED: 'worker-failed',
  /** Worker would not spawn; main-thread session serves (fatal). */
  WORKER_SPAWN_FAILED: 'worker-spawn-failed',
  /** Worker init handshake timed out; main-thread session serves (fatal). */
  WORKER_INIT_TIMEOUT: 'worker-init-timeout',
  /** Every session fallback level failed (fatal). */
  SESSION_CREATE_FAILED: 'session-create-failed',
  /** One native host frame failed incl. stage; next frame retries (transient). */
  NATIVE_FRAME_FAILED: 'native-frame-failed',
  /** Native host frame timed out (fetch guard or body read); retries next frame (transient). */
  NATIVE_FRAME_TIMEOUT: 'native-frame-timeout',
  /** Native host handshake timed out, likely cold start (transient). */
  NATIVE_HANDSHAKE_TIMEOUT: 'native-handshake-timeout',
  /**
   * Informational: an Auto-Cap ladder step committed live (not a failure —
   * in neither the fatal nor the transient set; the E2E gate counts these).
   */
  AUTO_CAP_STEP: 'auto-cap-step',
} as const;

export type RealEsrganErrorCode =
  (typeof REALESRGAN_ERROR_CODES)[keyof typeof REALESRGAN_ERROR_CODES];

/**
 * Native-host transport/protocol error codes (wire strings on the framed
 * JSON replies and in the HTTP error text). Deliberately a separate table
 * from RealEsrganErrorCode: these are host-side request/transport verdicts,
 * not runner failures, and they keep the host's snake_case wire spelling.
 * The C++ source of truth is native/include/anime4k/native_error_codes.hpp;
 * tests/native-host-error-codes.test.ts asserts this table against it.
 */
export const NATIVE_HOST_ERROR_CODES = {
  INVALID_JSON: 'invalid_json',
  UNKNOWN_TYPE: 'unknown_type',
  MESSAGE_TOO_LARGE: 'message_too_large',
  INVALID_REQUEST: 'invalid_request',
  INVALID_DATA: 'invalid_data',
  INFERENCE_FAILED: 'inference_failed',
  DMA_BUF_UNSUPPORTED: 'dma_buf_unsupported',
  SHM_PATH_REJECTED: 'shm_path_rejected',
  SHM_OPEN_FAILED: 'shm_open_failed',
  SHM_READ_FAILED: 'shm_read_failed',
  SHM_WRITE_FAILED: 'shm_write_failed',
  SHM_WRITE_INCOMPLETE: 'shm_write_incomplete',
} as const;

export type NativeHostErrorCode =
  (typeof NATIVE_HOST_ERROR_CODES)[keyof typeof NATIVE_HOST_ERROR_CODES];

/**
 * Codes the Runner-Guard treats as transient: they get the retry budget
 * instead of disabling the runner on first sight. Everything untagged (or
 * tagged otherwise) is permanent — producers tag, the guard decides.
 */
export const REALESRGAN_TRANSIENT_ERROR_CODES: ReadonlyArray<RealEsrganErrorCode> = [
  REALESRGAN_ERROR_CODES.PIPELINE_INFER_RETRY,
  REALESRGAN_ERROR_CODES.WORKER_TIMEOUT,
  REALESRGAN_ERROR_CODES.NATIVE_FRAME_FAILED,
  REALESRGAN_ERROR_CODES.NATIVE_FRAME_TIMEOUT,
  REALESRGAN_ERROR_CODES.NATIVE_HANDSHAKE_TIMEOUT,
];

/** Codes that fail the E2E gate on first sight (no recovery path). */
export const REALESRGAN_FATAL_ERROR_CODES: ReadonlyArray<RealEsrganErrorCode> = [
  REALESRGAN_ERROR_CODES.WORKER_FAILED,
  REALESRGAN_ERROR_CODES.WORKER_SPAWN_FAILED,
  REALESRGAN_ERROR_CODES.WORKER_INIT_TIMEOUT,
  REALESRGAN_ERROR_CODES.SESSION_CREATE_FAILED,
];

/** Prefix a human message with its machine-readable code. */
export function formatRealEsrganError(code: RealEsrganErrorCode, detail: string): string {
  return `[RealESRGAN:${code}] ${detail}`;
}

export type RealEsrganCodedError = Error & { code: RealEsrganErrorCode };

/**
 * Tag a rejection with its failure code so consumers classify policy
 * (retry vs disable) without re-parsing human text. The message stays
 * untouched for console debugging.
 */
export function withRealEsrganCode(error: Error, code: RealEsrganErrorCode): RealEsrganCodedError {
  (error as { code?: RealEsrganErrorCode }).code = code;
  return error as RealEsrganCodedError;
}

/** Read back a rejection tag (null = untagged, treated as permanent). */
export function realEsrganErrorCodeOf(error: unknown): RealEsrganErrorCode | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code: unknown }).code;
  return typeof code === 'string'
    && (Object.values(REALESRGAN_ERROR_CODES) as string[]).includes(code)
    ? (code as RealEsrganErrorCode)
    : null;
}
