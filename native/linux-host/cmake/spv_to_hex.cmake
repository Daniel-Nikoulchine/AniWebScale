# must define SHADER_SRC (spv file), SHADER_COMP_HEADER (output), SHADER_SYMBOL (C symbol)
#
# Emits a uint32_t[] SPIR-V image. SPIR-V words are little-endian on disk, so
# each word is assembled from 4 hex byte-pairs in reverse order: bytes
# 03 02 23 07 form the word 0x07230203.

file(READ ${SHADER_SRC} spv_bytes HEX)
string(LENGTH "${spv_bytes}" spv_hex_len)

set(spv_words "")
set(offset 0)
while(offset LESS spv_hex_len)
    string(SUBSTRING "${spv_bytes}" ${offset} 8 word_bytes)
    string(SUBSTRING "${word_bytes}" 6 2 b0)
    string(SUBSTRING "${word_bytes}" 4 2 b1)
    string(SUBSTRING "${word_bytes}" 2 2 b2)
    string(SUBSTRING "${word_bytes}" 0 2 b3)
    string(APPEND spv_words "0x${b0}${b1}${b2}${b3},")
    math(EXPR offset "${offset} + 8")
endwhile()

string(FIND "${spv_words}" "," tail_comma REVERSE)
string(SUBSTRING "${spv_words}" 0 ${tail_comma} spv_words)

file(WRITE ${SHADER_COMP_HEADER} "static const uint32_t ${SHADER_SYMBOL}[] = {${spv_words}};\n")
