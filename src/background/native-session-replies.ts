/**
 * Pure readers for the native session's cross-frame and host replies.
 *
 * The native session and bridge receive replies whose runtime shape is only
 * guaranteed by the peer. Each reader narrows one of those replies to the
 * exact typed surface the caller consumes. Only object-shaped replies are
 * accepted; anything else (null, undefined, strings, …) returns null so the
 * call site's existing truthiness checks keep their behaviour. Accepted
 * fields are passed through untouched, so a partial reply that used to be
 * accepted is still accepted with the same values.
 *
 * Pure: no chrome, DOM or transport imports.
 */
import type { PopupMeasurement, PreparedVideo } from '../background-types';

/** The `NATIVE_SET_TITLE_NONCE` reply read by the session. */
export interface TitleNonceReply {
  ok?: boolean;
  originalTitle?: string;
}

function asReply<T>(value: unknown): T | null {
  return value !== null && typeof value === 'object' ? (value as T) : null;
}

/** The `NATIVE_MEASURE_FULLSCREEN` frame reply. */
export function readMeasurementReply(value: unknown): PopupMeasurement | null {
  return asReply<PopupMeasurement>(value);
}

/** The `NATIVE_PREPARE_FULLSCREEN` frame reply. */
export function readPrepareReply(value: unknown): PreparedVideo | null {
  return asReply<PreparedVideo>(value);
}

/** The `NATIVE_SET_TITLE_NONCE` reply. */
export function readTitleNonceReply(value: unknown): TitleNonceReply | null {
  return asReply<TitleNonceReply>(value);
}
