#pragma once

#include <cstdint>

// Shared wire-protocol version for every AniWebScale native host (Windows
// renderer + Linux ncnn host). Kept in a platform-agnostic header so the
// Linux host can include it without pulling in <Windows.h>; protocol.hpp
// re-exports it for the Windows side. The TypeScript mirror is
// NATIVE_PROTOCOL_VERSION in src/native/protocol.ts; a drift test
// (tests/native-protocol-version-drift.test.ts) keeps the two in lockstep.
namespace anime4k::protocol {

inline constexpr std::uint32_t kProtocolVersion = 3;

}  // namespace anime4k::protocol
