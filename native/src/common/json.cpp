#include "anime4k/json.hpp"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <limits>
#include <sstream>

namespace anime4k::json {
namespace {

class Parser {
 public:
  explicit Parser(std::string_view input) : input_(input) {}

  ParseResult run() {
    skip_whitespace();
    auto value = parse_value(0);
    if (!value.has_value()) {
      return {std::nullopt, error_, error_offset_};
    }
    skip_whitespace();
    if (position_ != input_.size()) {
      fail("unexpected trailing data");
      return {std::nullopt, error_, error_offset_};
    }
    return {std::move(value), {}, 0};
  }

 private:
  static constexpr std::size_t kMaximumDepth = 64;

  std::optional<Value> parse_value(std::size_t depth) {
    if (depth > kMaximumDepth) {
      fail("maximum nesting depth exceeded");
      return std::nullopt;
    }
    if (position_ >= input_.size()) {
      fail("unexpected end of input");
      return std::nullopt;
    }

    switch (input_[position_]) {
      case '{': return parse_object(depth + 1);
      case '[': return parse_array(depth + 1);
      case '"': {
        auto string = parse_string();
        if (!string.has_value()) return std::nullopt;
        return Value(std::move(*string));
      }
      case 't': return parse_literal("true", Value(true));
      case 'f': return parse_literal("false", Value(false));
      case 'n': return parse_literal("null", Value(nullptr));
      default:
        if (input_[position_] == '-' || (input_[position_] >= '0' && input_[position_] <= '9')) {
          return parse_number();
        }
        fail("invalid value");
        return std::nullopt;
    }
  }

  std::optional<Value> parse_object(std::size_t depth) {
    ++position_;
    skip_whitespace();
    Object object;
    if (consume('}')) return Value(std::move(object));

    while (position_ < input_.size()) {
      if (input_[position_] != '"') {
        fail("object key must be a string");
        return std::nullopt;
      }
      auto key = parse_string();
      if (!key.has_value()) return std::nullopt;
      skip_whitespace();
      if (!consume(':')) {
        fail("expected ':' after object key");
        return std::nullopt;
      }
      skip_whitespace();
      auto value = parse_value(depth);
      if (!value.has_value()) return std::nullopt;
      if (!object.emplace(std::move(*key), std::move(*value)).second) {
        fail("duplicate object key");
        return std::nullopt;
      }
      skip_whitespace();
      if (consume('}')) return Value(std::move(object));
      if (!consume(',')) {
        fail("expected ',' or '}' in object");
        return std::nullopt;
      }
      skip_whitespace();
    }
    fail("unterminated object");
    return std::nullopt;
  }

  std::optional<Value> parse_array(std::size_t depth) {
    ++position_;
    skip_whitespace();
    Array array;
    if (consume(']')) return Value(std::move(array));

    while (position_ < input_.size()) {
      auto value = parse_value(depth);
      if (!value.has_value()) return std::nullopt;
      array.push_back(std::move(*value));
      skip_whitespace();
      if (consume(']')) return Value(std::move(array));
      if (!consume(',')) {
        fail("expected ',' or ']' in array");
        return std::nullopt;
      }
      skip_whitespace();
    }
    fail("unterminated array");
    return std::nullopt;
  }

  std::optional<std::string> parse_string() {
    ++position_;
    std::string output;
    while (position_ < input_.size()) {
      const unsigned char character = static_cast<unsigned char>(input_[position_++]);
      if (character == '"') return output;
      if (character < 0x20) {
        fail("unescaped control character in string");
        return std::nullopt;
      }
      if (character != '\\') {
        output.push_back(static_cast<char>(character));
        continue;
      }
      if (position_ >= input_.size()) {
        fail("unterminated string escape");
        return std::nullopt;
      }
      const char escape = input_[position_++];
      switch (escape) {
        case '"': output.push_back('"'); break;
        case '\\': output.push_back('\\'); break;
        case '/': output.push_back('/'); break;
        case 'b': output.push_back('\b'); break;
        case 'f': output.push_back('\f'); break;
        case 'n': output.push_back('\n'); break;
        case 'r': output.push_back('\r'); break;
        case 't': output.push_back('\t'); break;
        case 'u': {
          auto code_point = parse_hex_quad();
          if (!code_point.has_value()) return std::nullopt;
          if (*code_point >= 0xD800 && *code_point <= 0xDBFF) {
            if (position_ + 2 > input_.size() || input_[position_] != '\\' || input_[position_ + 1] != 'u') {
              fail("high surrogate without low surrogate");
              return std::nullopt;
            }
            position_ += 2;
            auto low = parse_hex_quad();
            if (!low.has_value() || *low < 0xDC00 || *low > 0xDFFF) {
              fail("invalid low surrogate");
              return std::nullopt;
            }
            *code_point = 0x10000 + ((*code_point - 0xD800) << 10) + (*low - 0xDC00);
          } else if (*code_point >= 0xDC00 && *code_point <= 0xDFFF) {
            fail("unexpected low surrogate");
            return std::nullopt;
          }
          append_utf8(output, *code_point);
          break;
        }
        default:
          fail("invalid string escape");
          return std::nullopt;
      }
    }
    fail("unterminated string");
    return std::nullopt;
  }

  std::optional<std::uint32_t> parse_hex_quad() {
    if (position_ + 4 > input_.size()) {
      fail("incomplete unicode escape");
      return std::nullopt;
    }
    std::uint32_t value = 0;
    for (int index = 0; index < 4; ++index) {
      const char character = input_[position_++];
      value <<= 4;
      if (character >= '0' && character <= '9') value += static_cast<std::uint32_t>(character - '0');
      else if (character >= 'a' && character <= 'f') value += static_cast<std::uint32_t>(character - 'a' + 10);
      else if (character >= 'A' && character <= 'F') value += static_cast<std::uint32_t>(character - 'A' + 10);
      else {
        fail("invalid unicode escape");
        return std::nullopt;
      }
    }
    return value;
  }

  static void append_utf8(std::string& output, std::uint32_t code_point) {
    if (code_point <= 0x7F) {
      output.push_back(static_cast<char>(code_point));
    } else if (code_point <= 0x7FF) {
      output.push_back(static_cast<char>(0xC0 | (code_point >> 6)));
      output.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
    } else if (code_point <= 0xFFFF) {
      output.push_back(static_cast<char>(0xE0 | (code_point >> 12)));
      output.push_back(static_cast<char>(0x80 | ((code_point >> 6) & 0x3F)));
      output.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
    } else {
      output.push_back(static_cast<char>(0xF0 | (code_point >> 18)));
      output.push_back(static_cast<char>(0x80 | ((code_point >> 12) & 0x3F)));
      output.push_back(static_cast<char>(0x80 | ((code_point >> 6) & 0x3F)));
      output.push_back(static_cast<char>(0x80 | (code_point & 0x3F)));
    }
  }

  std::optional<Value> parse_number() {
    const std::size_t start = position_;
    if (consume('-') && position_ >= input_.size()) {
      fail("incomplete number");
      return std::nullopt;
    }
    if (consume('0')) {
      if (position_ < input_.size() && input_[position_] >= '0' && input_[position_] <= '9') {
        fail("leading zero in number");
        return std::nullopt;
      }
    } else {
      if (position_ >= input_.size() || input_[position_] < '1' || input_[position_] > '9') {
        fail("invalid number");
        return std::nullopt;
      }
      while (position_ < input_.size() && input_[position_] >= '0' && input_[position_] <= '9') ++position_;
    }
    if (consume('.')) {
      if (position_ >= input_.size() || input_[position_] < '0' || input_[position_] > '9') {
        fail("fraction has no digits");
        return std::nullopt;
      }
      while (position_ < input_.size() && input_[position_] >= '0' && input_[position_] <= '9') ++position_;
    }
    if (position_ < input_.size() && (input_[position_] == 'e' || input_[position_] == 'E')) {
      ++position_;
      if (position_ < input_.size() && (input_[position_] == '+' || input_[position_] == '-')) ++position_;
      if (position_ >= input_.size() || input_[position_] < '0' || input_[position_] > '9') {
        fail("exponent has no digits");
        return std::nullopt;
      }
      while (position_ < input_.size() && input_[position_] >= '0' && input_[position_] <= '9') ++position_;
    }

    double number = 0.0;
    const auto text = input_.substr(start, position_ - start);
    const auto result = std::from_chars(text.data(), text.data() + text.size(), number);
    if (result.ec != std::errc{} || result.ptr != text.data() + text.size() || !std::isfinite(number)) {
      fail("number is outside the supported range");
      return std::nullopt;
    }
    return Value(number);
  }

  std::optional<Value> parse_literal(std::string_view literal, Value value) {
    if (input_.substr(position_, literal.size()) != literal) {
      fail("invalid literal");
      return std::nullopt;
    }
    position_ += literal.size();
    return value;
  }

  void skip_whitespace() {
    while (position_ < input_.size()) {
      const char character = input_[position_];
      if (character != ' ' && character != '\t' && character != '\r' && character != '\n') break;
      ++position_;
    }
  }

  bool consume(char expected) {
    if (position_ < input_.size() && input_[position_] == expected) {
      ++position_;
      return true;
    }
    return false;
  }

  void fail(std::string message) {
    if (error_.empty()) {
      error_ = std::move(message);
      error_offset_ = position_;
    }
  }

  std::string_view input_;
  std::size_t position_{};
  std::string error_;
  std::size_t error_offset_{};
};

void append_escaped(std::string& output, std::string_view value) {
  output.push_back('"');
  for (const unsigned char character : value) {
    switch (character) {
      case '"': output += "\\\""; break;
      case '\\': output += "\\\\"; break;
      case '\b': output += "\\b"; break;
      case '\f': output += "\\f"; break;
      case '\n': output += "\\n"; break;
      case '\r': output += "\\r"; break;
      case '\t': output += "\\t"; break;
      default:
        if (character < 0x20) {
          char buffer[7]{};
          std::snprintf(buffer, sizeof(buffer), "\\u%04x", static_cast<unsigned int>(character));
          output += buffer;
        } else {
          output.push_back(static_cast<char>(character));
        }
    }
  }
  output.push_back('"');
}

void append_value(std::string& output, const Value& value) {
  if (std::holds_alternative<std::nullptr_t>(value.storage)) {
    output += "null";
  } else if (const auto* boolean = std::get_if<bool>(&value.storage)) {
    output += *boolean ? "true" : "false";
  } else if (const auto* number = std::get_if<double>(&value.storage)) {
    char buffer[64]{};
    const auto result = std::to_chars(buffer, buffer + sizeof(buffer), *number, std::chars_format::general, 17);
    output.append(buffer, result.ptr);
  } else if (const auto* string = std::get_if<std::string>(&value.storage)) {
    append_escaped(output, *string);
  } else if (const auto* array = std::get_if<Array>(&value.storage)) {
    output.push_back('[');
    bool first = true;
    for (const auto& item : *array) {
      if (!first) output.push_back(',');
      first = false;
      append_value(output, item);
    }
    output.push_back(']');
  } else if (const auto* object = std::get_if<Object>(&value.storage)) {
    output.push_back('{');
    bool first = true;
    for (const auto& [key, item] : *object) {
      if (!first) output.push_back(',');
      first = false;
      append_escaped(output, key);
      output.push_back(':');
      append_value(output, item);
    }
    output.push_back('}');
  }
}

}  // namespace

bool Value::is_object() const noexcept { return std::holds_alternative<Object>(storage); }
bool Value::is_array() const noexcept { return std::holds_alternative<Array>(storage); }
const Object* Value::as_object() const noexcept { return std::get_if<Object>(&storage); }
Object* Value::as_object() noexcept { return std::get_if<Object>(&storage); }
const Array* Value::as_array() const noexcept { return std::get_if<Array>(&storage); }
const std::string* Value::as_string() const noexcept { return std::get_if<std::string>(&storage); }
std::optional<double> Value::as_number() const noexcept {
  if (const auto* value = std::get_if<double>(&storage)) return *value;
  return std::nullopt;
}
std::optional<bool> Value::as_bool() const noexcept {
  if (const auto* value = std::get_if<bool>(&storage)) return *value;
  return std::nullopt;
}

ParseResult parse(std::string_view text) { return Parser(text).run(); }

std::string stringify(const Value& value) {
  std::string output;
  append_value(output, value);
  return output;
}

const Value* find(const Object& object, std::string_view key) noexcept {
  const auto iterator = object.find(key);
  return iterator == object.end() ? nullptr : &iterator->second;
}

}  // namespace anime4k::json

