cmake_minimum_required(VERSION 3.25)

foreach(required_variable IN ITEMS SOURCE_ROOT DESTINATION_ROOT PAYLOAD_MANIFEST)
  if(NOT DEFINED ${required_variable} OR "${${required_variable}}" STREQUAL "")
    message(FATAL_ERROR "${required_variable} must be provided.")
  endif()
endforeach()

file(READ "${PAYLOAD_MANIFEST}" payload_manifest_json)
string(JSON payload_manifest_version GET "${payload_manifest_json}" version)
if(NOT payload_manifest_version EQUAL 1)
  message(FATAL_ERROR "Unsupported native payload manifest version: ${payload_manifest_version}")
endif()

string(JSON payload_count LENGTH "${payload_manifest_json}" files)
if(payload_count LESS 1)
  message(FATAL_ERROR "The native payload manifest is empty.")
endif()

set(payload_contains_models FALSE)
math(EXPR payload_last "${payload_count} - 1")
foreach(payload_index RANGE 0 ${payload_last})
  string(JSON payload_source_relative
    GET "${payload_manifest_json}" files ${payload_index} source)
  string(JSON payload_destination_relative
    GET "${payload_manifest_json}" files ${payload_index} destination)
  if(payload_destination_relative MATCHES "^models(/|$)")
    set(payload_contains_models TRUE)
  endif()

  cmake_path(ABSOLUTE_PATH payload_source_relative
    BASE_DIRECTORY "${SOURCE_ROOT}" NORMALIZE
    OUTPUT_VARIABLE payload_source)
  cmake_path(ABSOLUTE_PATH payload_destination_relative
    BASE_DIRECTORY "${DESTINATION_ROOT}" NORMALIZE
    OUTPUT_VARIABLE payload_destination)

  if(NOT EXISTS "${payload_source}")
    message(FATAL_ERROR "Native payload source is missing: ${payload_source}")
  endif()

  if(VERIFY_ONLY)
    if(NOT EXISTS "${payload_destination}")
      message(FATAL_ERROR "Native payload output is missing: ${payload_destination}")
    endif()
    execute_process(
      COMMAND "${CMAKE_COMMAND}" -E compare_files
              "${payload_source}" "${payload_destination}"
      RESULT_VARIABLE compare_result
    )
    if(NOT compare_result EQUAL 0)
      message(FATAL_ERROR "Native payload output is stale: ${payload_destination}")
    endif()
  else()
    cmake_path(GET payload_destination PARENT_PATH payload_destination_directory)
    file(MAKE_DIRECTORY "${payload_destination_directory}")
    execute_process(
      COMMAND "${CMAKE_COMMAND}" -E copy_if_different
              "${payload_source}" "${payload_destination}"
      RESULT_VARIABLE copy_result
    )
    if(NOT copy_result EQUAL 0)
      message(FATAL_ERROR "Could not copy native payload file: ${payload_source}")
    endif()
  endif()
endforeach()

if(NOT VERIFY_ONLY AND NOT payload_contains_models)
  file(REMOVE_RECURSE "${DESTINATION_ROOT}/models")
endif()
