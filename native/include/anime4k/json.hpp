#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace anime4k::json {

struct Value;
using Array = std::vector<Value>;
using Object = std::map<std::string, Value, std::less<>>;

struct Value {
  using Storage = std::variant<std::nullptr_t, bool, double, std::string, Array, Object>;
  Storage storage{nullptr};

  Value() = default;
  Value(std::nullptr_t) : storage(nullptr) {}
  Value(bool value) : storage(value) {}
  Value(double value) : storage(value) {}
  Value(int value) : storage(static_cast<double>(value)) {}
  Value(std::string value) : storage(std::move(value)) {}
  Value(const char* value) : storage(std::string(value)) {}
  Value(Array value) : storage(std::move(value)) {}
  Value(Object value) : storage(std::move(value)) {}

  [[nodiscard]] bool is_object() const noexcept;
  [[nodiscard]] bool is_array() const noexcept;
  [[nodiscard]] const Object* as_object() const noexcept;
  [[nodiscard]] Object* as_object() noexcept;
  [[nodiscard]] const Array* as_array() const noexcept;
  [[nodiscard]] const std::string* as_string() const noexcept;
  [[nodiscard]] std::optional<double> as_number() const noexcept;
  [[nodiscard]] std::optional<bool> as_bool() const noexcept;
};

struct ParseResult {
  std::optional<Value> value;
  std::string error;
  std::size_t error_offset{};
};

[[nodiscard]] ParseResult parse(std::string_view text);
[[nodiscard]] std::string stringify(const Value& value);
[[nodiscard]] const Value* find(const Object& object, std::string_view key) noexcept;

}  // namespace anime4k::json

