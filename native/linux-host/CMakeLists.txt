cmake_minimum_required(VERSION 3.25)
project(AniWebScaleNcnnHost VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Vulkan REQUIRED)
find_package(Threads REQUIRED)

# Reuse pinned ncnn from spike (fetch via native/spike/fetch-sources.py)
set(NCNN_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../spike/third_party/ncnn")
if(NOT EXISTS "${NCNN_SOURCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "ncnn source not found at ${NCNN_SOURCE_DIR} — run python3 native/spike/fetch-sources.py first")
endif()

set(NCNN_VULKAN ON CACHE BOOL "" FORCE)
set(NCNN_SHARED_LIB OFF CACHE BOOL "" FORCE)
set(NCNN_OPENMP OFF CACHE BOOL "" FORCE)
set(NCNN_STDIO ON CACHE BOOL "" FORCE)
set(NCNN_STRING ON CACHE BOOL "" FORCE)
set(NCNN_INSTALL_SDK OFF CACHE BOOL "" FORCE)
set(NCNN_SIMPLEOCV ON CACHE BOOL "" FORCE)
set(NCNN_SIMPLEOMP OFF CACHE BOOL "" FORCE)
set(NCNN_SIMPLESTL OFF CACHE BOOL "" FORCE)
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
set(NCNN_RTTI OFF CACHE BOOL "" FORCE)
set(NCNN_EXCEPTIONS OFF CACHE BOOL "" FORCE)

add_subdirectory(${NCNN_SOURCE_DIR} ${CMAKE_BINARY_DIR}/ncnn_build)

find_program(GLSLANG_VALIDATOR glslangValidator REQUIRED)
set(SHADER_DIR "${CMAKE_CURRENT_SOURCE_DIR}/shaders")
set(SHADER_GEN_DIR "${CMAKE_BINARY_DIR}/generated/shaders")
file(MAKE_DIRECTORY "${SHADER_GEN_DIR}")

set(SHADER_HEADERS "")
foreach(shader_name IN ITEMS realesrgan_spike_postproc realesrgan_spike_preproc realesrgan_spike_preproc_f32 realesrgan_spike_postproc_f32 realesrgan_spike_preproc_down2 srvgg_conv srvgg_tail srvgg_conv_tiled srvgg_traffic)
    set(spv "${SHADER_GEN_DIR}/${shader_name}.spv")
    set(hex_header "${SHADER_GEN_DIR}/${shader_name}.comp.hex.h")
    add_custom_command(
        OUTPUT "${spv}"
        COMMAND "${GLSLANG_VALIDATOR}" -V --target-env vulkan1.1 -e main -o "${spv}" "${SHADER_DIR}/${shader_name}.comp"
        DEPENDS "${SHADER_DIR}/${shader_name}.comp"
        VERBATIM
    )
    add_custom_command(
        OUTPUT "${hex_header}"
        COMMAND "${CMAKE_COMMAND}" "-DSHADER_SRC=${spv}" "-DSHADER_COMP_HEADER=${hex_header}" "-DSHADER_SYMBOL=${shader_name}_comp_data" -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/spv_to_hex.cmake"
        DEPENDS "${spv}" "${CMAKE_CURRENT_SOURCE_DIR}/cmake/spv_to_hex.cmake"
        VERBATIM
    )
    list(APPEND SHADER_HEADERS "${hex_header}")
endforeach()

# json helper from Windows host (header-only + cpp, platform agnostic)
set(JSON_SRC "${CMAKE_CURRENT_SOURCE_DIR}/../src/common/json.cpp")
set(JSON_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../include")

add_executable(aniwebscale-ncnn-host
    main.cpp
    srvgg-vulkan.cpp
    ${JSON_SRC}
    ${SHADER_HEADERS}
)
target_include_directories(aniwebscale-ncnn-host PRIVATE
    "${JSON_INCLUDE_DIR}"
    "${NCNN_SOURCE_DIR}/src"
    "${CMAKE_BINARY_DIR}/ncnn_build/src"
    "${SHADER_GEN_DIR}"
)
target_link_libraries(aniwebscale-ncnn-host PRIVATE ncnn Vulkan::Vulkan Threads::Threads)
target_compile_options(aniwebscale-ncnn-host PRIVATE -Wall -Wextra -Wno-unused-parameter -march=native -flto)
target_link_options(aniwebscale-ncnn-host PRIVATE -flto)

# Hygiene (2.9.): mimalloc nie gemessen. Opt-in per Default: linken, wenn die
# Lib da ist (Arch: pacman -S mimalloc), sonst still weiter ohne. A/B per
# -DANIWEBSCALE_USE_MIMALLOC=ON/OFF plus bench:ncnn:quick.
option(ANIWEBSCALE_USE_MIMALLOC "Link the host against mimalloc when found" ON)
if(ANIWEBSCALE_USE_MIMALLOC)
  find_library(MIMALLOC_LIB NAMES mimalloc)
  if(MIMALLOC_LIB)
    target_link_libraries(aniwebscale-ncnn-host PRIVATE ${MIMALLOC_LIB})
    message(STATUS "mimalloc enabled for host: ${MIMALLOC_LIB}")
  else()
    message(STATUS "mimalloc not found, host builds without it (LD_PRELOAD-A/B: LD_PRELOAD=/usr/lib/libmimalloc.so)")
  endif()
endif()

# PGO für den Host (LTO ist schon an): zweiphasig.
#   Phase 1: cmake -DANIWEBSCALE_PGO=GENERATE ... && cmake --build ... && <repräsentativen Clip fahren>
#   Phase 2: cmake -DANIWEBSCALE_PGO=USE ... && cmake --build ...
set(ANIWEBSCALE_PGO "OFF" CACHE STRING "PGO for the host: OFF, GENERATE or USE")
set_property(CACHE ANIWEBSCALE_PGO PROPERTY STRINGS OFF GENERATE USE)
if(ANIWEBSCALE_PGO STREQUAL "GENERATE")
  target_compile_options(aniwebscale-ncnn-host PRIVATE -fprofile-generate=${CMAKE_BINARY_DIR}/pgo)
  target_link_options(aniwebscale-ncnn-host PRIVATE -fprofile-generate=${CMAKE_BINARY_DIR}/pgo)
elseif(ANIWEBSCALE_PGO STREQUAL "USE")
  target_compile_options(aniwebscale-ncnn-host PRIVATE -fprofile-use=${CMAKE_BINARY_DIR}/pgo -Wno-missing-profile)
  target_link_options(aniwebscale-ncnn-host PRIVATE -fprofile-use=${CMAKE_BINARY_DIR}/pgo)
endif()

add_executable(aniwebscale-ncnn-benchmark
    benchmark.cpp
    ${SHADER_HEADERS}
)
target_include_directories(aniwebscale-ncnn-benchmark PRIVATE
    "${NCNN_SOURCE_DIR}/src"
    "${CMAKE_BINARY_DIR}/ncnn_build/src"
    "${SHADER_GEN_DIR}"
)
target_link_libraries(aniwebscale-ncnn-benchmark PRIVATE ncnn Vulkan::Vulkan)
target_compile_options(aniwebscale-ncnn-benchmark PRIVATE -Wall -Wextra -Wno-unused-parameter -march=native -flto)
target_link_options(aniwebscale-ncnn-benchmark PRIVATE -flto)

# Allow overriding model paths at build time
set(DEFAULT_PARAM "${CMAKE_CURRENT_SOURCE_DIR}/../../models/realesrgan/ncnn/realesr-animevideov3-x4.param")
set(DEFAULT_BIN "${CMAKE_CURRENT_SOURCE_DIR}/../../models/realesrgan/ncnn/realesr-animevideov3-x4.bin")
target_compile_definitions(aniwebscale-ncnn-host PRIVATE
    "DEFAULT_PARAM_PATH=\"${DEFAULT_PARAM}\""
    "DEFAULT_BIN_PATH=\"${DEFAULT_BIN}\""
)
target_compile_definitions(aniwebscale-ncnn-benchmark PRIVATE
    "DEFAULT_PARAM_PATH=\"${DEFAULT_PARAM}\""
    "DEFAULT_BIN_PATH=\"${DEFAULT_BIN}\""
)
