#include "anime4k/json.hpp"
#include "anime4k/protocol.hpp"

#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <random>
#include <string>
#include <string_view>
#include <vector>

namespace {

std::uint64_t environment_number(
    const char* name,
    const std::uint64_t fallback,
    const std::uint64_t maximum) {
  char* raw = nullptr;
  std::size_t length = 0;
  if (_dupenv_s(&raw, &length, name) != 0 || raw == nullptr) {
    return fallback;
  }
  char* end = nullptr;
  const auto parsed = std::strtoull(raw, &end, 0);
  const bool valid = end != raw && *end == '\0';
  std::free(raw);
  if (!valid || parsed == 0) {
    return fallback;
  }
  return std::min<std::uint64_t>(parsed, maximum);
}

std::string random_bytes(std::mt19937_64& random) {
  std::uniform_int_distribution<std::size_t> length_distribution(0, 8192);
  std::uniform_int_distribution<unsigned int> byte_distribution(0, 255);
  std::string input(length_distribution(random), '\0');
  for (char& value : input) {
    value = static_cast<char>(byte_distribution(random));
  }
  return input;
}

std::string mutate(std::string input, std::mt19937_64& random) {
  std::uniform_int_distribution<unsigned int> operation_distribution(0, 5);
  std::uniform_int_distribution<unsigned int> byte_distribution(0, 255);
  const unsigned int operations = 1 + operation_distribution(random);
  for (unsigned int operation = 0; operation < operations; ++operation) {
    const unsigned int choice = operation_distribution(random);
    const std::size_t position = input.empty()
        ? 0
        : std::uniform_int_distribution<std::size_t>(0, input.size() - 1)(random);
    switch (choice) {
      case 0:
        if (!input.empty()) input[position] = static_cast<char>(byte_distribution(random));
        break;
      case 1:
        if (input.size() < 65536) input.insert(input.begin() + static_cast<std::ptrdiff_t>(position),
            static_cast<char>(byte_distribution(random)));
        break;
      case 2:
        if (!input.empty()) input.erase(position, 1);
        break;
      case 3:
        if (!input.empty()) input.resize(position);
        break;
      case 4:
        if (!input.empty() && input.size() < 32768) input += input;
        break;
      default:
        if (input.size() < 65536) input.append("\\uD800");
        break;
    }
  }
  return input;
}

bool exercise(std::string_view input, const std::uint64_t iteration) {
  try {
    const auto parsed = anime4k::json::parse(input);
    if (!parsed.value.has_value()) {
      if (parsed.error.empty() || parsed.error_offset > input.size()) {
        std::cerr << "Invalid parser error metadata at iteration " << iteration << '\n';
        return false;
      }
      return true;
    }

    const auto browser = anime4k::protocol::validate_browser_request(*parsed.value);
    const auto renderer = anime4k::protocol::validate_renderer_event(*parsed.value);
    if (browser.code.size() > 4096 || browser.message.size() > 4096
        || renderer.code.size() > 4096 || renderer.message.size() > 4096) {
      std::cerr << "Unbounded validation result at iteration " << iteration << '\n';
      return false;
    }

    const std::string encoded = anime4k::json::stringify(*parsed.value);
    if (!anime4k::json::parse(encoded).value.has_value()) {
      std::cerr << "Stringify/parse invariant failed at iteration " << iteration << '\n';
      return false;
    }
    return true;
  } catch (const std::exception& error) {
    std::cerr << "Unexpected exception at iteration " << iteration << ": " << error.what() << '\n';
    return false;
  } catch (...) {
    std::cerr << "Unexpected non-standard exception at iteration " << iteration << '\n';
    return false;
  }
}

}  // namespace

int main() {
  constexpr std::uint64_t kDefaultSeed = 0xA41B40B5ULL;
  const std::uint64_t seed = environment_number("ANIME4K_FUZZ_SEED", kDefaultSeed,
      std::numeric_limits<std::uint64_t>::max());
  const std::uint64_t iterations = environment_number("ANIME4K_FUZZ_ITERATIONS", 20000, 2000000);
  std::mt19937_64 random(seed);
  const std::vector<std::string> corpus{
      R"({"type":"hello","protocolVersion":3,"requestId":"r"})",
      R"({"type":"start","protocolVersion":3,"requestId":"r","sessionId":"s","windowNonce":"0123456789abcdef0123456789abcdef","mode":"A","quality":"M","frameGenerationEnabled":false})",
      R"({"type":"updateConfiguration","protocolVersion":3,"requestId":"r","sessionId":"s","mode":"ARTCNN","quality":"UL","frameGenerationEnabled":true})",
      R"({"type":"pointer","protocolVersion":3,"requestId":"r","sessionId":"s","event":"move","x":0.5,"y":0.25,"button":0,"buttons":0,"shiftKey":false,"ctrlKey":false,"altKey":false})",
      R"({"type":"metrics","protocolVersion":3,"sessionId":"s","fps":24,"frameTimeMs":3,"droppedFrames":0})",
      R"({"emoji":"\uD83D\uDE80","nested":[true,false,null,{"n":1.25}]})",
  };

  const std::vector<std::string> edge_cases{
      "", "\0", "[1,]", "{\"a\":1,\"a\":2}", "\xF0\x28\x8C\x28",
      std::string(65536, '['), std::string(anime4k::protocol::kMaximumMessageBytes + 1U, 'x'),
  };
  std::uint64_t iteration = 0;
  for (const auto& input : edge_cases) {
    if (!exercise(input, iteration++)) return EXIT_FAILURE;
  }
  std::uniform_int_distribution<std::size_t> corpus_distribution(0, corpus.size() - 1);
  for (; iteration < iterations; ++iteration) {
    const std::string input = (iteration % 3U == 0U)
        ? random_bytes(random)
        : mutate(corpus[corpus_distribution(random)], random);
    if (!exercise(input, iteration)) {
      std::cerr << "Reproduce with ANIME4K_FUZZ_SEED=" << seed
                << " ANIME4K_FUZZ_ITERATIONS=" << iterations << '\n';
      return EXIT_FAILURE;
    }
  }
  std::cout << "Native protocol fuzz passed: seed=" << seed
            << " iterations=" << iterations << '\n';
  return EXIT_SUCCESS;
}
