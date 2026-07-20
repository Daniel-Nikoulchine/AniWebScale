#pragma once

#include <dxgi.h>

namespace anime4k::d3d {

[[nodiscard]] constexpr bool is_device_loss_hresult(HRESULT result) noexcept {
  return result == DXGI_ERROR_DEVICE_HUNG || result == DXGI_ERROR_DEVICE_REMOVED
      || result == DXGI_ERROR_DEVICE_RESET || result == DXGI_ERROR_DRIVER_INTERNAL_ERROR;
}

// GetDeviceRemovedReason returns S_OK while a device remains usable and a
// failing HRESULT once the device must be recreated. Keep the operation result
// as a second signal because Present can report the loss first.
[[nodiscard]] constexpr bool requires_device_recreation(
    HRESULT operation_result,
    HRESULT removal_reason) noexcept {
  return is_device_loss_hresult(operation_result) || FAILED(removal_reason);
}

}  // namespace anime4k::d3d
