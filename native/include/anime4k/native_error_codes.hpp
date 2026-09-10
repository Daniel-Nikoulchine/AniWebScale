#pragma once

// Canonical native-host error codes (wire strings sent on the framed JSON
// and surfaced in HTTP error text). Platform-agnostic so both the Windows
// renderer and the Linux ncnn host can share one definition. The TS mirror is
// NATIVE_HOST_ERROR_CODES in src/shared/realesrgan-error-codes.ts; a drift
// test (tests/native-host-error-codes.test.ts) parses this header and asserts
// the literals match the TypeScript table.
//
// Keep each code on its own single-line inline constexpr declaration; the
// drift test extracts the quoted values from those declarations.
namespace anime4k::protocol::native_errors {

inline constexpr char kInvalidJson[] = "invalid_json";
inline constexpr char kUnknownType[] = "unknown_type";
inline constexpr char kMessageTooLarge[] = "message_too_large";
inline constexpr char kInvalidRequest[] = "invalid_request";
inline constexpr char kInvalidData[] = "invalid_data";
inline constexpr char kInferenceFailed[] = "inference_failed";
inline constexpr char kDmaBufUnsupported[] = "dma_buf_unsupported";
inline constexpr char kShmPathRejected[] = "shm_path_rejected";
inline constexpr char kShmOpenFailed[] = "shm_open_failed";
inline constexpr char kShmReadFailed[] = "shm_read_failed";
inline constexpr char kShmWriteFailed[] = "shm_write_failed";
inline constexpr char kShmWriteIncomplete[] = "shm_write_incomplete";

}  // namespace anime4k::protocol::native_errors
