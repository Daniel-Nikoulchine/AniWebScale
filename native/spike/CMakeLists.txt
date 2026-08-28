# ncnn-Vulkan spike for Real-ESRGAN realesr-animevideov3 (x4).
#
# This is a self-contained diagnostic build, deliberately separate from the
# Windows-only D3D11 renderer CMake tree. It configures the pinned ncnn source
# (see third_party/PINS.md) with Vulkan compute and links the one-file spike
# executable against it. The quality comparison against the ONNX reference
# lives in scripts/validate-ncnn-model.py (Phase 2 of the Vulkan-only plan).
#
# Build (Linux, target hardware RX 6750 XT):
#   cmake -S native/spike -B native/spike/build -G Ninja -DCMAKE_BUILD_TYPE=Release
#   cmake --build native/spike/build
#
# Windows x64: same commands with the Visual Studio generator; no source
# changes are required.
cmake_minimum_required(VERSION 3.25)
project(Anime4kBrowserNcnnSpike VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Vulkan REQUIRED)

set(NCNN_VULKAN ON CACHE BOOL "" FORCE)
set(NCNN_BUILD_WITH_STATIC_CRT OFF CACHE BOOL "" FORCE)
set(NCNN_SHARED_LIB OFF CACHE BOOL "" FORCE)
set(NCNN_OPENMP OFF CACHE BOOL "" FORCE)
set(NCNN_STDIO ON CACHE BOOL "" FORCE)
set(NCNN_STRING ON CACHE BOOL "" FORCE)
set(NCNN_INSTALL_SDK OFF CACHE BOOL "" FORCE)
set(NCNN_SIMPLEOCV ON CACHE BOOL "" FORCE)
set(NCNN_SIMPLEOMP OFF CACHE BOOL "" FORCE)
set(NCNN_SIMPLESTL OFF CACHE BOOL "" FORCE)
set(NCNN_SIMPLEMATH OFF CACHE BOOL "" FORCE)
set(NCNN_THREADS ON CACHE BOOL "" FORCE)
set(NCNN_BENCHMARK OFF CACHE BOOL "" FORCE)
set(NCNN_C_API OFF CACHE BOOL "" FORCE)
set(NCNN_PLATFORM_API OFF CACHE BOOL "" FORCE)
set(NCNN_WINXP OFF CACHE BOOL "" FORCE)
set(NCNN_PIXEL ON CACHE BOOL "" FORCE)
set(NCNN_PIXEL_ROTATE OFF CACHE BOOL "" FORCE)
set(NCNN_PIXEL_AFFINE OFF CACHE BOOL "" FORCE)
set(NCNN_PIXEL_DRAWING OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_BENCHMARK OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(NCNN_PYTHON OFF CACHE BOOL "" FORCE)
set(NCNN_DISABLE_RTTI OFF CACHE BOOL "" FORCE)
set(NCNN_DISABLE_EXCEPTION OFF CACHE BOOL "" FORCE)
set(NCNN_ENABLE_LTO OFF CACHE BOOL "" FORCE)

add_subdirectory(third_party/ncnn)

add_executable(ncnn-spike ncnn_realesrgan_spike.cpp)
target_include_directories(ncnn-spike PRIVATE
    third_party/ncnn/src
    third_party/ncnn/build/src
)
target_link_libraries(ncnn-spike PRIVATE ncnn Vulkan::Vulkan)
