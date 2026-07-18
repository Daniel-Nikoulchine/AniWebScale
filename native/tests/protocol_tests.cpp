#include "anime4k/capture_health.hpp"
#include "anime4k/capture_resize.hpp"
#include "anime4k/geometry.hpp"
#include "anime4k/json.hpp"
#include "anime4k/protocol.hpp"

#include <Windows.h>

#include <cstdlib>
#include <iostream>
#include <mutex>
#include <string>

namespace {

int failures = 0;

void expect(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAILED: " << message << '\n';
    ++failures;
  }
}

anime4k::json::Value parse_or_fail(std::string_view text) {
  auto result = anime4k::json::parse(text);
  expect(result.value.has_value(), "JSON fixture must parse");
  return result.value.value_or(anime4k::json::Value{});
}

void test_json() {
  const auto parsed = anime4k::json::parse(R"({"emoji":"\uD83D\uDE80","array":[true,false,null,1.25]})");
  expect(parsed.value.has_value(), "valid JSON with surrogate pair parses");
  if (parsed.value.has_value()) {
    const std::string encoded = anime4k::json::stringify(*parsed.value);
    expect(anime4k::json::parse(encoded).value.has_value(), "stringified JSON parses again");
  }
  expect(!anime4k::json::parse(R"({"a":1,"a":2})").value.has_value(), "duplicate JSON keys are rejected");
  expect(!anime4k::json::parse("[1,]").value.has_value(), "trailing array comma is rejected");
  expect(!anime4k::json::parse("01").value.has_value(), "leading zero is rejected");
}

void test_request_validation() {
  constexpr const char* modes[] = {
      "OFF", "A", "B", "C", "AA", "BB", "CA", "CNNX2",
      "ARTCNN", "ACNET", "ARNET"};
  constexpr const char* qualities[] = {"M", "VL", "UL"};
  for (const char* mode : modes) {
    for (const char* quality : qualities) {
      for (const bool frame_generation : {false, true}) {
        anime4k::json::Object request{
            {"type", "start"},
            {"protocolVersion", 3},
            {"requestId", "request-1"},
            {"sessionId", "session-1"},
            {"windowNonce", "0123456789abcdef0123456789abcdef"},
            {"mode", mode},
            {"quality", quality},
            {"frameGenerationEnabled", frame_generation},
        };
        expect(anime4k::protocol::validate_browser_request(request).valid,
            "all mode, quality, and frame-generation combinations validate");
      }
    }
  }

  auto unknown_property = parse_or_fail(
      R"({"type":"hello","protocolVersion":3,"requestId":"r","unexpected":true})");
  expect(!anime4k::protocol::validate_browser_request(unknown_property).valid, "unknown request properties are rejected");
  auto invalid_nonce = parse_or_fail(
      R"({"type":"start","protocolVersion":3,"requestId":"r","sessionId":"s","windowNonce":"ABC","mode":"A","quality":"M","frameGenerationEnabled":false})");
  expect(!anime4k::protocol::validate_browser_request(invalid_nonce).valid, "invalid nonce is rejected");
  auto mismatched_dimensions = parse_or_fail(
      R"({"type":"start","protocolVersion":3,"requestId":"r","sessionId":"s","windowNonce":"0123456789abcdef0123456789abcdef","mode":"A","quality":"M","frameGenerationEnabled":false,"targetWidth":1920})");
  expect(!anime4k::protocol::validate_browser_request(mismatched_dimensions).valid, "one-sided output dimensions are rejected");
  auto crop_region = parse_or_fail(
      R"({"type":"start","protocolVersion":3,"requestId":"r","sessionId":"s","windowNonce":"0123456789abcdef0123456789abcdef","mode":"A","quality":"M","frameGenerationEnabled":false,"captureX":10,"captureY":20,"captureWidth":1280,"captureHeight":720})");
  expect(anime4k::protocol::validate_browser_request(crop_region).valid, "complete physical capture region validates");
  auto incomplete_crop = parse_or_fail(
      R"({"type":"start","protocolVersion":3,"requestId":"r","sessionId":"s","windowNonce":"0123456789abcdef0123456789abcdef","mode":"A","quality":"M","frameGenerationEnabled":false,"captureX":10,"captureWidth":1280,"captureHeight":720})");
  expect(!anime4k::protocol::validate_browser_request(incomplete_crop).valid, "incomplete capture region is rejected");
  auto missing_frame_generation = parse_or_fail(
      R"({"type":"start","protocolVersion":3,"requestId":"r","sessionId":"s","windowNonce":"0123456789abcdef0123456789abcdef","mode":"A","quality":"M"})");
  expect(!anime4k::protocol::validate_browser_request(missing_frame_generation).valid,
      "start requires an explicit frame-generation flag");
  auto invalid_frame_generation = parse_or_fail(
      R"({"type":"updateConfiguration","protocolVersion":3,"requestId":"r","sessionId":"s","mode":"A","quality":"UL","frameGenerationEnabled":"yes"})");
  expect(!anime4k::protocol::validate_browser_request(invalid_frame_generation).valid,
      "frame-generation flag must be boolean");
  auto update_configuration = parse_or_fail(
      R"({"type":"updateConfiguration","protocolVersion":3,"requestId":"r","sessionId":"s","mode":"ARTCNN","quality":"UL","frameGenerationEnabled":true})");
  expect(anime4k::protocol::validate_browser_request(update_configuration).valid,
      "complete configuration updates validate");
  auto removed_gan = parse_or_fail(
      R"({"type":"updateConfiguration","protocolVersion":3,"requestId":"r","sessionId":"s","mode":"GANX4","quality":"UL","frameGenerationEnabled":false})");
  expect(!anime4k::protocol::validate_browser_request(removed_gan).valid,
      "removed GAN configurations are rejected");
  auto removed_real_esrgan = parse_or_fail(
      R"({"type":"updateConfiguration","protocolVersion":3,"requestId":"r","sessionId":"s","mode":"REALESRGANX4","quality":"UL","frameGenerationEnabled":false})");
  expect(!anime4k::protocol::validate_browser_request(removed_real_esrgan).valid,
      "removed Real-ESRGAN configurations are rejected");
}

void test_renderer_events() {
  auto pointer = parse_or_fail(
      R"({"type":"pointer","protocolVersion":3,"requestId":"native-pointer-1","sessionId":"s","event":"move","x":0.5,"y":0.25,"button":0,"buttons":0,"shiftKey":true,"ctrlKey":false,"altKey":false})");
  expect(anime4k::protocol::validate_renderer_event(pointer).valid, "native pointer event validates");
  auto playback_status = parse_or_fail(
      R"({"type":"status","protocolVersion":3,"requestId":"status-playback","sessionId":"s","playbackActive":true,"mediaTime":12.5})");
  expect(anime4k::protocol::validate_browser_request(playback_status).valid, "status playback heartbeat validates");
  auto incomplete_playback_status = parse_or_fail(
      R"({"type":"status","protocolVersion":3,"requestId":"status-invalid","sessionId":"s","playbackActive":true})");
  expect(!anime4k::protocol::validate_browser_request(incomplete_playback_status).valid,
      "status playback heartbeat requires both activity and media time");
  auto media = parse_or_fail(
      R"({"type":"mediaCommand","protocolVersion":3,"requestId":"native-key-1","sessionId":"s","command":"seekBy","value":5})");
  expect(anime4k::protocol::validate_renderer_event(media).valid, "native media command validates");
  auto exit_fullscreen = parse_or_fail(
      R"({"type":"mediaCommand","protocolVersion":3,"requestId":"native-key-2","sessionId":"s","command":"exitFullscreen"})");
  expect(anime4k::protocol::validate_renderer_event(exit_fullscreen).valid,
      "protocol-v3 exitFullscreen command validates");
  auto capabilities = parse_or_fail(
      R"({"type":"capabilities","protocolVersion":3,"requestId":"cap-1","windowsCapture":true,"d3d11":true,"modes":["OFF","A","B","C","AA","BB","CA","CNNX2","ARTCNN","ACNET","ARNET"],"qualities":["M","VL","UL"],"frameGeneration":true})");
  expect(anime4k::protocol::validate_renderer_event(capabilities).valid,
      "complete protocol-v3 capabilities validate");
  auto invalid_capability_mode = parse_or_fail(
      R"({"type":"capabilities","protocolVersion":3,"requestId":"cap-2","windowsCapture":true,"d3d11":true,"modes":["CUSTOM"],"qualities":["M"],"frameGeneration":true})");
  expect(!anime4k::protocol::validate_renderer_event(invalid_capability_mode).valid,
      "unsupported capability modes are rejected");
  auto invalid_capability_request = parse_or_fail(
      R"({"type":"capabilities","protocolVersion":3,"requestId":7,"windowsCapture":true,"d3d11":true,"modes":["A"],"qualities":["M"],"frameGeneration":true})");
  expect(!anime4k::protocol::validate_renderer_event(invalid_capability_request).valid,
      "capability events require a valid correlation identifier");
  auto invalid_status_state = parse_or_fail(
      R"({"type":"status","protocolVersion":3,"requestId":"status-1","sessionId":"s","state":"unknown","message":"bad state"})");
  expect(!anime4k::protocol::validate_renderer_event(invalid_status_state).valid,
      "status events reject unknown session states");
  auto invalid_metrics = parse_or_fail(
      R"({"type":"metrics","protocolVersion":3,"sessionId":"s","fps":24,"frameTimeMs":-1,"droppedFrames":0})");
  expect(!anime4k::protocol::validate_renderer_event(invalid_metrics).valid,
      "metrics reject negative measurements");
  auto invalid_stopped_session = parse_or_fail(
      R"({"type":"stopped","protocolVersion":3,"requestId":"stop-1","sessionId":"not valid","reason":"requested"})");
  expect(!anime4k::protocol::validate_renderer_event(invalid_stopped_session).valid,
      "stopped events require a valid session identifier");
  auto extra = parse_or_fail(
      R"({"type":"metrics","protocolVersion":3,"sessionId":"s","fps":24,"frameTimeMs":3,"droppedFrames":0,"extra":1})");
  expect(!anime4k::protocol::validate_renderer_event(extra).valid, "unknown renderer event properties are rejected");
}

void test_framing() {
  HANDLE read_handle = nullptr;
  HANDLE write_handle = nullptr;
  expect(CreatePipe(&read_handle, &write_handle, nullptr, 4096) != FALSE, "anonymous pipe is created");
  if (read_handle == nullptr || write_handle == nullptr) return;
  std::mutex mutex;
  std::string error;
  constexpr std::string_view payload = R"({"type":"hello"})";
  expect(anime4k::protocol::write_framed_message(write_handle, payload, &mutex, error), "framed message writes");
  std::string received;
  expect(anime4k::protocol::read_framed_message(read_handle, received, error) == anime4k::protocol::ReadResult::message,
         "framed message reads");
  expect(received == payload, "framed payload round-trips");
  CloseHandle(read_handle);
  CloseHandle(write_handle);
}

void test_capture_health() {
  expect(anime4k::capture::is_effectively_black(95, 100), "95-percent black probe is classified as black");
  expect(!anime4k::capture::is_effectively_black(94, 100), "probe below black ratio threshold remains visible");
  expect(!anime4k::capture::is_effectively_black(0, 0), "empty probe is never classified as black");
  anime4k::capture::HealthDetector detector;
  expect(detector.observe(true, 7, 0) == anime4k::capture::HealthState::healthy, "first black frame is not rejected");
  expect(detector.observe(true, 7, 60000) == anime4k::capture::HealthState::healthy,
      "paused black capture is not classified as protected content");
  expect(detector.observe(true, 7, 61000, true, 1.0) == anime4k::capture::HealthState::healthy,
      "playing black capture starts a fresh interval");
  expect(detector.observe(true, 7, 68500, true, 8.5) == anime4k::capture::HealthState::healthy,
      "short playing black interval is tolerated");
  expect(detector.observe(true, 7, 76000, true, 16.0) == anime4k::capture::HealthState::continuously_black,
      "sustained black capture is rejected only while media time advances");

  detector.reset();
  expect(detector.observe(false, 10, 0) == anime4k::capture::HealthState::healthy, "first visible frame is healthy");
  expect(detector.observe(false, 10, 60000) == anime4k::capture::HealthState::healthy,
      "paused bit-identical capture is never classified as frozen");
  expect(detector.observe(false, 10, 61000, true, 1.0) == anime4k::capture::HealthState::healthy,
      "playback starts a fresh frozen interval");
  expect(detector.observe(false, 10, 76000, true, 16.0) == anime4k::capture::HealthState::healthy,
      "short moving-media interval is tolerated");
  expect(detector.observe(false, 10, 91000, true, 31.0) == anime4k::capture::HealthState::continuously_frozen,
      "thirty-second bit-identical capture is rejected only while media time advances");
  detector.reset();
  (void)detector.observe(false, 1, 0, true, 0.0);
  (void)detector.observe(false, 1, 15000, true, 15.0);
  expect(detector.observe(false, 2, 30000, true, 30.0) == anime4k::capture::HealthState::healthy, "changed frame resets frozen timer");
}

void test_capture_resize_state() {
  anime4k::capture::FramePoolResizeState state;
  state.reset(1280, 720);
  const auto initial_generation = state.generation();
  expect(initial_generation != 0, "capture resize state assigns an initial content generation");
  expect(state.current_extent() == anime4k::capture::CaptureExtent{1280, 720},
      "capture resize state records the initial frame-pool extent");
  expect(!state.request(1280, 720), "unchanged content size does not request a frame-pool recreate");
  expect(state.generation() == initial_generation,
      "unchanged content does not invalidate work from the current extent");
  expect(!state.request(0, 720) && !state.request(1280, -1),
      "non-positive content sizes are ignored");
  expect(state.request(1920, 1080), "a positive content-size change requests a frame-pool recreate");
  const auto resized_generation = state.generation();
  expect(resized_generation != initial_generation,
      "an accepted resize immediately invalidates work from the old extent");
  expect(state.has_pending(), "resize remains pending until the window thread applies it");
  expect(state.pending_extent() == anime4k::capture::CaptureExtent{1920, 1080},
      "the exact pending capture extent is preserved");
  expect(!state.request(2560, 1440), "only one resize can be in flight at a time");
  expect(state.generation() == resized_generation,
      "a rejected resize cannot advance the content generation");
  expect(state.pending_extent() == anime4k::capture::CaptureExtent{1920, 1080},
      "a second callback cannot replace the in-flight resize");
  expect(!state.mark_applied({2560, 1440}), "the wrong extent cannot clear an in-flight resize");
  expect(state.current_extent() == anime4k::capture::CaptureExtent{1280, 720},
      "a mismatched apply cannot change the committed frame-pool extent");
  expect(state.has_pending(), "a mismatched apply leaves the original resize pending");
  expect(state.mark_applied({1920, 1080}), "the requested frame-pool extent can be committed");
  expect(state.generation() == resized_generation,
      "applying an accepted resize keeps its content generation stable");
  expect(!state.has_pending(), "committing a resize re-enables captured frames");
  expect(state.current_extent() == anime4k::capture::CaptureExtent{1920, 1080},
      "committing updates the current frame-pool extent");
  state.reset();
  expect(state.generation() != resized_generation,
      "session cleanup invalidates every outstanding extent snapshot");
  expect(!state.has_pending() && !static_cast<bool>(state.current_extent()),
      "session cleanup clears current and pending capture extents");
}

void test_pointer_geometry() {
  const anime4k::geometry::PixelRectangle content{100, 50, 900, 500};
  const auto center = anime4k::geometry::normalize_pointer(content, 500, 275);
  expect(center.has_value() && center->x == 0.5 && center->y == 0.5, "content center maps to normalized center");
  const auto left_letterbox = anime4k::geometry::normalize_pointer(content, 0, 275);
  expect(!left_letterbox.has_value(), "left letterbox does not generate a pointer event");
  const auto lower_letterbox = anime4k::geometry::normalize_pointer(content, 500, 900);
  expect(!lower_letterbox.has_value(), "bottom letterbox does not generate a pointer event");
  expect(!anime4k::geometry::normalize_pointer({1, 1, 1, 10}, 1, 1).has_value(), "zero-width content rectangle is rejected");
  const auto wide_contain = anime4k::geometry::contain_rectangle(1920, 1080, 1200, 900);
  expect(wide_contain.left == 0 && wide_contain.top == 112
          && wide_contain.right == 1200 && wide_contain.bottom == 787,
      "contain scaling letterboxes a wide source without cropping it");
  const auto tall_contain = anime4k::geometry::contain_rectangle(1200, 900, 1600, 900);
  expect(tall_contain.left == 200 && tall_contain.top == 0
          && tall_contain.right == 1400 && tall_contain.bottom == 900,
      "contain scaling pillarboxes a tall source without cropping it");
  const auto contained_pointer = anime4k::geometry::normalize_pointer(wide_contain, 600, 450);
  expect(contained_pointer.has_value() && contained_pointer->x == 0.5
          && contained_pointer->y > 0.49 && contained_pointer->y < 0.51,
      "pointer coordinates use the centered contained video rectangle");
  expect(!anime4k::geometry::normalize_pointer(wide_contain, 600, 50).has_value(),
      "letterbox bars do not generate pointer events");
  expect(anime4k::geometry::dom_buttons_from_win32(0x0001U | 0x0002U | 0x0010U) == 7,
      "Win32 left/right/middle state maps to DOM buttons");
  expect(anime4k::geometry::dom_buttons_from_win32(0x0004U | 0x0008U) == 0,
      "Win32 shift/control flags do not become DOM mouse buttons");
  expect(anime4k::geometry::dom_buttons_from_win32(0x0020U | 0x0040U) == 24,
      "Win32 auxiliary buttons map to DOM back/forward buttons");
  expect(anime4k::geometry::dom_wheel_delta_from_win32(120) == -120,
      "Win32 wheel-up maps to negative DOM deltaY");
  const auto crop = anime4k::geometry::clip_capture_region(1920, 1080, 200, -10, 1800, 1000);
  expect(crop.has_value() && crop->left == 200 && crop->top == 0 && crop->right == 1920 && crop->bottom == 1000,
      "player crop is clipped to the browser client area");
  expect(!anime4k::geometry::clip_capture_region(1920, 1080, 1900, 1000, 200, 200).has_value(),
      "a clipped player crop smaller than the minimum is rejected");
}

}  // namespace

int main() {
  test_json();
  test_request_validation();
  test_renderer_events();
  test_framing();
  test_capture_health();
  test_capture_resize_state();
  test_pointer_geometry();
  if (failures != 0) {
    std::cerr << failures << " test(s) failed\n";
    return EXIT_FAILURE;
  }
  std::cout << "All native protocol tests passed\n";
  return EXIT_SUCCESS;
}
