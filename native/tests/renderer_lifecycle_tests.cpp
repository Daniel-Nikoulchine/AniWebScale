#include "anime4k/capture_lifecycle.hpp"
#include "anime4k/d3d_device_status.hpp"

#include <cstdlib>
#include <iostream>

namespace {

int failures = 0;

void expect(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAILED: " << message << '\n';
    ++failures;
  }
}

void test_device_status() {
  expect(!anime4k::d3d::requires_device_recreation(S_OK, S_OK),
      "a healthy device remains reusable");
  expect(anime4k::d3d::requires_device_recreation(DXGI_ERROR_DEVICE_REMOVED, S_OK),
      "an operation-level device removal forces recreation");
  expect(anime4k::d3d::requires_device_recreation(DXGI_ERROR_DEVICE_RESET, S_OK),
      "an operation-level device reset forces recreation");
  expect(anime4k::d3d::requires_device_recreation(E_FAIL, DXGI_ERROR_DEVICE_HUNG),
      "a failing removal reason forces recreation even when the operation error is generic");
  expect(!anime4k::d3d::requires_device_recreation(E_FAIL, S_OK),
      "an ordinary operation failure does not discard a healthy device");
}

void test_capture_close_generation() {
  expect(anime4k::capture::should_handle_close(true, 7, 7),
      "the active capture handles its own close notification");
  expect(!anime4k::capture::should_handle_close(true, 7, 8),
      "a delayed close notification cannot stop a newer capture");
  expect(!anime4k::capture::should_handle_close(false, 7, 7),
      "an inactive capture ignores duplicate close notifications");
  expect(!anime4k::capture::should_handle_close(true, 0, 0),
      "the uninitialized generation is never a valid close notification");
}

void test_capture_window_dispatch_generation() {
  expect(anime4k::capture::should_dispatch_capture_window_message(true, 9, 9, true),
      "a current callback may post while its output-window lease is held");
  expect(!anime4k::capture::should_dispatch_capture_window_message(false, 9, 9, true),
      "shutdown invalidates a callback before output dispatch");
  expect(!anime4k::capture::should_dispatch_capture_window_message(true, 8, 9, true),
      "an old callback cannot dispatch into a replacement session");
  expect(!anime4k::capture::should_dispatch_capture_window_message(true, 9, 9, false),
      "a missing output target cannot receive frame or resize messages");

  expect(anime4k::capture::should_handle_capture_window_message(true, 9, 9),
      "the active capture handles a queued message carrying its generation");
  expect(!anime4k::capture::should_handle_capture_window_message(true, 9, 10),
      "a queued message cannot run after a new capture reuses the HWND value");
  expect(!anime4k::capture::should_handle_capture_window_message(false, 9, 9),
      "a queued message cannot run after capture shutdown");
  expect(!anime4k::capture::should_handle_capture_window_message(true, 0, 9),
      "an untagged frame or resize message is never accepted");
}

}  // namespace

int main() {
  test_device_status();
  test_capture_close_generation();
  test_capture_window_dispatch_generation();
  if (failures != 0) {
    std::cerr << failures << " test(s) failed\n";
    return EXIT_FAILURE;
  }
  std::cout << "All renderer lifecycle tests passed\n";
  return EXIT_SUCCESS;
}
