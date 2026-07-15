cmake_minimum_required(VERSION 3.25)

project(Anime4KBrowserNative VERSION 1.0.0 LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "The native helper is Windows-only.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

option(ANIME4K_NATIVE_BUILD_TESTS "Build native unit tests" ON)
find_package(Python3 3.10 REQUIRED COMPONENTS Interpreter)
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
  "${CMAKE_CURRENT_SOURCE_DIR}/../preset-graph.json"
  "${CMAKE_CURRENT_SOURCE_DIR}/tools/generate_anime4k_models.py"
  "${CMAKE_CURRENT_SOURCE_DIR}/third_party/artcnn/glsl/ArtCNN_C4F16.glsl"
  "${CMAKE_CURRENT_SOURCE_DIR}/third_party/acnetglsl/glsl/acnet/acnet_f8b4.glsl"
  "${CMAKE_CURRENT_SOURCE_DIR}/third_party/acnetglsl/glsl/arnet/arnet_f8b8.glsl"
  "${CMAKE_CURRENT_SOURCE_DIR}/payload-manifest.json"
)

set(ANIME4K_NATIVE_PAYLOAD_MANIFEST "${CMAKE_CURRENT_SOURCE_DIR}/payload-manifest.json")
set(ANIME4K_NATIVE_PAYLOAD_SYNC_SCRIPT "${CMAKE_CURRENT_SOURCE_DIR}/cmake/sync_payload.cmake")
file(READ "${ANIME4K_NATIVE_PAYLOAD_MANIFEST}" ANIME4K_NATIVE_PAYLOAD_JSON)
string(JSON ANIME4K_NATIVE_PAYLOAD_VERSION GET "${ANIME4K_NATIVE_PAYLOAD_JSON}" version)
if(NOT ANIME4K_NATIVE_PAYLOAD_VERSION EQUAL 1)
  message(FATAL_ERROR
    "Unsupported native payload manifest version: ${ANIME4K_NATIVE_PAYLOAD_VERSION}"
  )
endif()
string(JSON ANIME4K_NATIVE_PAYLOAD_COUNT LENGTH "${ANIME4K_NATIVE_PAYLOAD_JSON}" files)
if(ANIME4K_NATIVE_PAYLOAD_COUNT LESS 1)
  message(FATAL_ERROR "The native payload manifest is empty.")
endif()

set(ANIME4K_NATIVE_PAYLOAD_SOURCES)
set(ANIME4K_NATIVE_PAYLOAD_DESTINATIONS)
math(EXPR ANIME4K_NATIVE_PAYLOAD_LAST "${ANIME4K_NATIVE_PAYLOAD_COUNT} - 1")
foreach(payload_index RANGE 0 ${ANIME4K_NATIVE_PAYLOAD_LAST})
  string(JSON payload_source_relative
    GET "${ANIME4K_NATIVE_PAYLOAD_JSON}" files ${payload_index} source)
  string(JSON payload_destination_relative
    GET "${ANIME4K_NATIVE_PAYLOAD_JSON}" files ${payload_index} destination)
  cmake_path(ABSOLUTE_PATH payload_source_relative
    BASE_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}" NORMALIZE
    OUTPUT_VARIABLE payload_source)
  cmake_path(NORMAL_PATH payload_destination_relative
    OUTPUT_VARIABLE payload_destination)

  if(NOT EXISTS "${payload_source}" OR IS_DIRECTORY "${payload_source}")
    message(FATAL_ERROR "Native payload source is missing: ${payload_source}")
  endif()
  if(IS_ABSOLUTE "${payload_destination}" OR payload_destination MATCHES "^\\.\\.(/|$)")
    message(FATAL_ERROR
      "Native payload destination must stay below the output directory: ${payload_destination}"
    )
  endif()
  list(FIND ANIME4K_NATIVE_PAYLOAD_DESTINATIONS "${payload_destination}" duplicate_index)
  if(NOT duplicate_index EQUAL -1)
    message(FATAL_ERROR "Duplicate native payload destination: ${payload_destination}")
  endif()

  list(APPEND ANIME4K_NATIVE_PAYLOAD_SOURCES "${payload_source}")
  list(APPEND ANIME4K_NATIVE_PAYLOAD_DESTINATIONS "${payload_destination}")
endforeach()
execute_process(
  COMMAND "${Python3_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/tools/generate_anime4k_models.py"
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/.."
  RESULT_VARIABLE ANIME4K_MODEL_GENERATION_RESULT
  OUTPUT_VARIABLE ANIME4K_MODEL_GENERATION_OUTPUT
  ERROR_VARIABLE ANIME4K_MODEL_GENERATION_ERROR
)
if(NOT ANIME4K_MODEL_GENERATION_RESULT EQUAL 0)
  message(FATAL_ERROR
    "Anime4K model generation failed:\n${ANIME4K_MODEL_GENERATION_OUTPUT}${ANIME4K_MODEL_GENERATION_ERROR}"
  )
endif()

add_library(anime4k_native_common STATIC
  src/common/capture_health.cpp
  src/common/geometry.cpp
  src/common/json.cpp
  src/common/protocol.cpp
  src/common/win32_util.cpp
)
target_include_directories(anime4k_native_common PUBLIC include)
target_compile_definitions(anime4k_native_common PUBLIC
  UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX
)
target_compile_options(anime4k_native_common PRIVATE /W4 /permissive- /EHsc /utf-8)
target_link_libraries(anime4k_native_common PUBLIC advapi32)

add_executable(Anime4K.NativeHost src/host/main.cpp)
target_link_libraries(Anime4K.NativeHost PRIVATE anime4k_native_common)
target_compile_options(Anime4K.NativeHost PRIVATE /W4 /permissive- /EHsc /utf-8)
add_custom_command(TARGET Anime4K.NativeHost POST_BUILD
  COMMAND "${CMAKE_COMMAND}" -E copy_if_different
          "${CMAKE_CURRENT_SOURCE_DIR}/manifests/native-host-allowlist.json"
          "$<TARGET_FILE_DIR:Anime4K.NativeHost>/native-host-allowlist.json"
  VERBATIM
)

find_program(FXC_EXECUTABLE fxc.exe
  HINTS
    "$ENV{WindowsSdkVerBinPath}/x64"
    "$ENV{WindowsSdkDir}/bin/${CMAKE_VS_WINDOWS_TARGET_PLATFORM_VERSION}/x64"
    "$ENV{WindowsSdkDir}/bin/$ENV{WindowsSDKVersion}/x64"
)
if(NOT FXC_EXECUTABLE)
  set(PROGRAM_FILES_X86 "$ENV{ProgramFiles\(x86\)}")
  if(NOT PROGRAM_FILES_X86)
    set(PROGRAM_FILES_X86 "C:/Program Files (x86)")
  endif()
  file(GLOB FXC_SDK_CANDIDATES
    LIST_DIRECTORIES false
    "${PROGRAM_FILES_X86}/Windows Kits/10/bin/*/x64/fxc.exe"
  )
  if(FXC_SDK_CANDIDATES)
    list(SORT FXC_SDK_CANDIDATES COMPARE NATURAL ORDER DESCENDING)
    list(GET FXC_SDK_CANDIDATES 0 FXC_NEWEST_SDK_EXECUTABLE)
    set(FXC_EXECUTABLE "${FXC_NEWEST_SDK_EXECUTABLE}" CACHE FILEPATH "Path to fxc.exe" FORCE)
  endif()
endif()
if(NOT FXC_EXECUTABLE)
  message(FATAL_ERROR "fxc.exe was not found. Install the Windows SDK HLSL tools.")
endif()

set(SHADER_OUTPUT_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated/shaders")
file(MAKE_DIRECTORY "${SHADER_OUTPUT_DIR}")

function(embed_hlsl output_name source entry profile symbol)
  set(cso "${SHADER_OUTPUT_DIR}/${output_name}.cso")
  set(header "${SHADER_OUTPUT_DIR}/${output_name}.hpp")
  add_custom_command(
    OUTPUT "${cso}"
    COMMAND "${FXC_EXECUTABLE}" /nologo /O3 /Ges /WX /T "${profile}" /E "${entry}" /Fo "${cso}" "${source}"
    DEPENDS "${source}"
    VERBATIM
  )
  add_custom_command(
    OUTPUT "${header}"
    COMMAND "${CMAKE_COMMAND}" "-DINPUT=${cso}" "-DOUTPUT=${header}" "-DSYMBOL=${symbol}" -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/EmbedBinary.cmake"
    DEPENDS "${cso}" "${CMAKE_CURRENT_SOURCE_DIR}/cmake/EmbedBinary.cmake"
    VERBATIM
  )
  set(${output_name}_HEADER "${header}" PARENT_SCOPE)
endfunction()

embed_hlsl(FullscreenVS "${CMAKE_CURRENT_SOURCE_DIR}/shaders/fullscreen.hlsl" VSMain vs_5_0 kFullscreenVS)
embed_hlsl(PresentPS "${CMAKE_CURRENT_SOURCE_DIR}/shaders/present.hlsl" PSMain ps_5_0 kPresentPS)
embed_hlsl(FrameInterpolationPS "${CMAKE_CURRENT_SOURCE_DIR}/shaders/frame_interpolation.hlsl" PSMain ps_5_0 kFrameInterpolationPS)

set(MODEL_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/generated-models/hlsl")
set(MODEL_BUILD_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated/models")
set(MODEL_CSO_MAP "${MODEL_BUILD_DIR}/cso-map.json")
set(MODEL_PACKAGE_CPP "${CMAKE_CURRENT_BINARY_DIR}/generated/Anime4KModelPackage.cpp")
file(GLOB_RECURSE MODEL_HLSL CONFIGURE_DEPENDS "${MODEL_SOURCE_DIR}/*.hlsl")
list(SORT MODEL_HLSL)
if(NOT MODEL_HLSL)
  message(FATAL_ERROR "No generated Anime4K model shaders were found.")
endif()

file(MAKE_DIRECTORY "${MODEL_BUILD_DIR}")
set(MODEL_CSO_FILES "")
set(MODEL_MAP_ENTRIES "")
set(MODEL_MAP_SEPARATOR "")
foreach(model_source IN LISTS MODEL_HLSL)
  file(RELATIVE_PATH model_relative "${MODEL_SOURCE_DIR}" "${model_source}")
  cmake_path(GET model_relative PARENT_PATH model_effect)
  cmake_path(GET model_relative STEM model_pass)
  cmake_path(REPLACE_EXTENSION model_relative LAST_ONLY ".cso" OUTPUT_VARIABLE model_cso_relative)
  set(model_cso "${MODEL_BUILD_DIR}/${model_cso_relative}")
  get_filename_component(model_cso_directory "${model_cso}" DIRECTORY)
  add_custom_command(
    OUTPUT "${model_cso}"
    COMMAND "${CMAKE_COMMAND}" -E make_directory "${model_cso_directory}"
    COMMAND "${FXC_EXECUTABLE}" /nologo /O3 /Ges /WX /T cs_5_0 /E main /Fo "${model_cso}" "${model_source}"
    DEPENDS "${model_source}"
    VERBATIM
  )
  list(APPEND MODEL_CSO_FILES "${model_cso}")
  string(APPEND MODEL_MAP_ENTRIES "${MODEL_MAP_SEPARATOR}    \"${model_effect}.${model_pass}\": \"${model_cso_relative}\"")
  set(MODEL_MAP_SEPARATOR ",\n")
endforeach()
# file(GENERATE) preserves the timestamp when the content is unchanged. The
# normal build script reconfigures CMake on every invocation, so file(WRITE)
# here would otherwise make the model map look newer and repack all 321 CSOs.
file(GENERATE
  OUTPUT "${MODEL_CSO_MAP}"
  CONTENT "{\n  \"schema_version\": 1,\n  \"passes\": {\n${MODEL_MAP_ENTRIES}\n  }\n}\n"
)

add_custom_command(
  OUTPUT "${MODEL_PACKAGE_CPP}"
  COMMAND "${Python3_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/tools/pack_anime4k_models.py"
          --manifest "${CMAKE_CURRENT_SOURCE_DIR}/generated-models/manifest.json"
          --cso-map "${MODEL_CSO_MAP}"
          --output "${MODEL_PACKAGE_CPP}"
  # write_if_changed deliberately preserves the large source file when its
  # contents are identical. Advance the declared output timestamp separately
  # so build tools do not rerun this 321-shader packing step forever.
  COMMAND "${CMAKE_COMMAND}" -E touch "${MODEL_PACKAGE_CPP}"
  DEPENDS
    ${MODEL_CSO_FILES}
    "${MODEL_CSO_MAP}"
    "${CMAKE_CURRENT_SOURCE_DIR}/generated-models/manifest.json"
    "${CMAKE_CURRENT_SOURCE_DIR}/tools/pack_anime4k_models.py"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/anime4k/model_package.hpp"
  VERBATIM
)
set_source_files_properties("${MODEL_PACKAGE_CPP}" PROPERTIES GENERATED TRUE)

add_library(anime4k_model_package OBJECT "${MODEL_PACKAGE_CPP}")
target_include_directories(anime4k_model_package PRIVATE include)
target_compile_options(anime4k_model_package PRIVATE /W4 /permissive- /EHsc /utf-8)

add_library(anime4k_native_pipeline STATIC
  src/renderer/anime4k_pipeline.cpp
  src/renderer/animejanai_pipeline.cpp
  src/renderer/frame_generation_pipeline.cpp
  ${FullscreenVS_HEADER}
  ${PresentPS_HEADER}
  ${FrameInterpolationPS_HEADER}
  $<TARGET_OBJECTS:anime4k_model_package>
)
target_include_directories(anime4k_native_pipeline PUBLIC include src/renderer)
target_include_directories(anime4k_native_pipeline PRIVATE
  "${CMAKE_CURRENT_BINARY_DIR}/generated"
  "${CMAKE_CURRENT_SOURCE_DIR}/third_party/animejanai/include"
)
target_link_libraries(anime4k_native_pipeline PUBLIC anime4k_native_common d3d11 windowsapp)
target_compile_options(anime4k_native_pipeline PRIVATE /W4 /permissive- /EHsc /utf-8)

add_executable(Anime4K.Renderer WIN32
  src/renderer/main.cpp
  src/renderer/capture_renderer.cpp
  ${FullscreenVS_HEADER}
  ${PresentPS_HEADER}
)
target_include_directories(Anime4K.Renderer PRIVATE include "${CMAKE_CURRENT_BINARY_DIR}/generated")
target_link_libraries(Anime4K.Renderer PRIVATE
  anime4k_native_common
  anime4k_native_pipeline
  d3d11 dxgi dwmapi shell32 windowsapp
)
target_compile_options(Anime4K.Renderer PRIVATE /W4 /permissive- /EHsc /utf-8)

set(ANIME4K_NATIVE_PAYLOAD_OUTPUT_ROOT "${CMAKE_BINARY_DIR}/bin/$<CONFIG>")
set(ANIME4K_NATIVE_PAYLOAD_STAMP_DIRECTORY
  "${CMAKE_CURRENT_BINARY_DIR}/payload/$<CONFIG>"
)
set(ANIME4K_NATIVE_PAYLOAD_STAMP
  "${ANIME4K_NATIVE_PAYLOAD_STAMP_DIRECTORY}/sync.stamp"
)
set(ANIME4K_NATIVE_PAYLOAD_OUTPUTS)
foreach(payload_destination IN LISTS ANIME4K_NATIVE_PAYLOAD_DESTINATIONS)
  list(APPEND ANIME4K_NATIVE_PAYLOAD_OUTPUTS
    "${ANIME4K_NATIVE_PAYLOAD_OUTPUT_ROOT}/${payload_destination}"
  )
endforeach()
add_custom_command(
  OUTPUT "${ANIME4K_NATIVE_PAYLOAD_STAMP}"
  BYPRODUCTS ${ANIME4K_NATIVE_PAYLOAD_OUTPUTS}
  COMMAND "${CMAKE_COMMAND}" -E make_directory
          "${ANIME4K_NATIVE_PAYLOAD_STAMP_DIRECTORY}"
  COMMAND "${CMAKE_COMMAND}"
          "-DSOURCE_ROOT=${CMAKE_CURRENT_SOURCE_DIR}"
          "-DDESTINATION_ROOT=${ANIME4K_NATIVE_PAYLOAD_OUTPUT_ROOT}"
          "-DPAYLOAD_MANIFEST=${ANIME4K_NATIVE_PAYLOAD_MANIFEST}"
          -P "${ANIME4K_NATIVE_PAYLOAD_SYNC_SCRIPT}"
  COMMAND "${CMAKE_COMMAND}" -E touch "${ANIME4K_NATIVE_PAYLOAD_STAMP}"
  DEPENDS
    "${ANIME4K_NATIVE_PAYLOAD_MANIFEST}"
    "${ANIME4K_NATIVE_PAYLOAD_SYNC_SCRIPT}"
    ${ANIME4K_NATIVE_PAYLOAD_SOURCES}
  COMMENT "Synchronizing native runtime payload"
  VERBATIM
)
add_custom_target(anime4k_renderer_payload
  DEPENDS "${ANIME4K_NATIVE_PAYLOAD_STAMP}"
)
add_dependencies(Anime4K.Renderer anime4k_renderer_payload)

add_executable(Anime4K.Benchmark
  src/benchmark/main.cpp
  ${FullscreenVS_HEADER}
  ${PresentPS_HEADER}
)
target_include_directories(Anime4K.Benchmark PRIVATE include "${CMAKE_CURRENT_BINARY_DIR}/generated")
target_link_libraries(Anime4K.Benchmark PRIVATE anime4k_native_pipeline dxgi)
target_compile_options(Anime4K.Benchmark PRIVATE /W4 /permissive- /EHsc /utf-8)

add_executable(Anime4K.NeuralBenchmark src/benchmark/neural.cpp)
target_include_directories(Anime4K.NeuralBenchmark PRIVATE include src/renderer)
target_link_libraries(Anime4K.NeuralBenchmark PRIVATE anime4k_native_pipeline dxgi)
target_compile_options(Anime4K.NeuralBenchmark PRIVATE /W4 /permissive- /EHsc /utf-8)

add_executable(Anime4K.Golden src/golden/main.cpp)
target_include_directories(Anime4K.Golden PRIVATE include src/renderer)
target_link_libraries(Anime4K.Golden PRIVATE anime4k_native_pipeline)
target_compile_options(Anime4K.Golden PRIVATE /W4 /permissive- /EHsc /utf-8)

set_target_properties(Anime4K.NativeHost Anime4K.Renderer Anime4K.Benchmark Anime4K.NeuralBenchmark Anime4K.Golden PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)

install(TARGETS Anime4K.NativeHost Anime4K.Renderer RUNTIME DESTINATION .)
install(TARGETS Anime4K.Benchmark RUNTIME DESTINATION tools)
install(TARGETS Anime4K.Golden RUNTIME DESTINATION tools)
install(FILES README.md DESTINATION . RENAME NATIVE-README.md)
install(FILES "${CMAKE_CURRENT_SOURCE_DIR}/../LICENSE" DESTINATION . RENAME LICENSE.txt)
install(FILES third_party/anime4k/LICENSE DESTINATION licenses RENAME Anime4K-LICENSE.txt)
foreach(payload_source payload_destination IN ZIP_LISTS
    ANIME4K_NATIVE_PAYLOAD_SOURCES ANIME4K_NATIVE_PAYLOAD_DESTINATIONS)
  cmake_path(GET payload_destination PARENT_PATH payload_install_directory)
  cmake_path(GET payload_destination FILENAME payload_install_name)
  install(FILES "${payload_source}"
    DESTINATION "${payload_install_directory}"
    RENAME "${payload_install_name}"
  )
endforeach()
install(FILES "${ANIME4K_NATIVE_PAYLOAD_MANIFEST}" DESTINATION .)
install(FILES manifests/native-host-allowlist.json DESTINATION .)
install(DIRECTORY manifests DESTINATION .)
install(DIRECTORY scripts DESTINATION .)

if(ANIME4K_NATIVE_BUILD_TESTS)
  enable_testing()
  add_executable(anime4k_renderer_lifecycle_tests tests/renderer_lifecycle_tests.cpp)
  target_include_directories(anime4k_renderer_lifecycle_tests PRIVATE include)
  target_compile_options(anime4k_renderer_lifecycle_tests PRIVATE /W4 /permissive- /EHsc /utf-8)
  add_test(NAME anime4k_native_renderer_lifecycle COMMAND anime4k_renderer_lifecycle_tests)
  add_executable(anime4k_native_tests tests/protocol_tests.cpp)
  target_link_libraries(anime4k_native_tests PRIVATE anime4k_native_common)
  target_compile_options(anime4k_native_tests PRIVATE /W4 /permissive- /EHsc /utf-8)
  add_test(NAME anime4k_native_protocol COMMAND anime4k_native_tests)
  add_executable(anime4k_pipeline_tests tests/model_pipeline_tests.cpp)
  target_link_libraries(anime4k_pipeline_tests PRIVATE anime4k_native_pipeline)
  target_compile_options(anime4k_pipeline_tests PRIVATE /W4 /permissive- /EHsc /utf-8)
  add_test(NAME anime4k_native_model_pipeline COMMAND anime4k_pipeline_tests)
  add_executable(anime4k_frame_generation_tests
    tests/frame_generation_pipeline_tests.cpp
    ${FullscreenVS_HEADER}
  )
  target_include_directories(anime4k_frame_generation_tests PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/generated")
  target_link_libraries(anime4k_frame_generation_tests PRIVATE anime4k_native_pipeline)
  target_compile_options(anime4k_frame_generation_tests PRIVATE /W4 /permissive- /EHsc /utf-8)
  add_test(NAME anime4k_native_frame_generation COMMAND anime4k_frame_generation_tests)
  add_executable(anime4k_animejanai_tests tests/animejanai_pipeline_tests.cpp)
  target_link_libraries(anime4k_animejanai_tests PRIVATE anime4k_native_pipeline)
  target_compile_options(anime4k_animejanai_tests PRIVATE /W4 /permissive- /EHsc /utf-8)
  add_test(NAME anime4k_native_animejanai COMMAND anime4k_animejanai_tests)
  add_test(
    NAME anime4k_native_payload_assets
    COMMAND "${CMAKE_COMMAND}"
            "-DSOURCE_ROOT=${CMAKE_CURRENT_SOURCE_DIR}"
            "-DDESTINATION_ROOT=$<TARGET_FILE_DIR:Anime4K.Renderer>"
            "-DPAYLOAD_MANIFEST=${ANIME4K_NATIVE_PAYLOAD_MANIFEST}"
            -DVERIFY_ONLY=ON
            -P "${ANIME4K_NATIVE_PAYLOAD_SYNC_SCRIPT}"
  )
  add_test(
    NAME anime4k_native_host_handshake
    COMMAND "${Python3_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/tests/native_host_handshake.py"
            --host "$<TARGET_FILE:Anime4K.NativeHost>"
  )
  add_test(
    NAME anime4k_native_shader_codegen
    COMMAND "${Python3_EXECUTABLE}" -m unittest discover -s "${CMAKE_CURRENT_SOURCE_DIR}/tools/tests" -p "test_*.py"
  )
endif()
