if(NOT DEFINED INPUT OR NOT DEFINED OUTPUT OR NOT DEFINED SYMBOL)
  message(FATAL_ERROR "INPUT, OUTPUT and SYMBOL are required")
endif()

file(READ "${INPUT}" CONTENT HEX)
string(LENGTH "${CONTENT}" HEX_LENGTH)
math(EXPR BYTE_COUNT "${HEX_LENGTH} / 2")
set(BYTES "")
set(INDEX 0)
while(INDEX LESS HEX_LENGTH)
  string(SUBSTRING "${CONTENT}" ${INDEX} 2 BYTE)
  string(APPEND BYTES "0x${BYTE},")
  math(EXPR INDEX "${INDEX} + 2")
endwhile()

get_filename_component(OUTPUT_DIR "${OUTPUT}" DIRECTORY)
file(MAKE_DIRECTORY "${OUTPUT_DIR}")
file(WRITE "${OUTPUT}" "#pragma once\n#include <cstddef>\n#include <cstdint>\ninline constexpr std::uint8_t ${SYMBOL}[] = {${BYTES}};\ninline constexpr std::size_t ${SYMBOL}Size = ${BYTE_COUNT};\n")

