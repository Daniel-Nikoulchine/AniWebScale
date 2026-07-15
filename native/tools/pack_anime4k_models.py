#!/usr/bin/env python3
"""Pack compiled Anime4K DXBC and the model graph into one C++ source file.

The generated translation unit implements the fixed API declared by
``anime4k/model_package.hpp``. A JSON map supplies the compiled ``.cso`` path
for every pass ID in ``native/generated-models/manifest.json``::

    {
      "schema_version": 1,
      "passes": {
        "clamp.pass_000": "path/to/pass_000.cso",
        "restore_m.pass_000": "path/to/pass_000.cso"
      }
    }

Relative CSO paths are resolved against the map file's directory. The map must
contain every pass exactly once; missing, extra, empty, or non-DXBC inputs are
rejected so an incomplete model package cannot reach the renderer.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Mapping, Sequence


NATIVE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = NATIVE_ROOT / "generated-models" / "manifest.json"
DEFAULT_HEADER_INCLUDE = "anime4k/model_package.hpp"
EXPECTED_MANIFEST_SCHEMA = 1
EXPECTED_MAP_SCHEMA = 1


class PackingError(RuntimeError):
    """Raised when the manifest or compiled shader map is incomplete."""


def _require_object(value: object, location: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise PackingError(f"{location} must be a JSON object")
    return value


def _require_list(value: object, location: str) -> list[object]:
    if not isinstance(value, list):
        raise PackingError(f"{location} must be a JSON array")
    return value


def _require_string(value: object, location: str) -> str:
    if not isinstance(value, str) or not value:
        raise PackingError(f"{location} must be a non-empty string")
    return value


def _require_uint(value: object, location: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > 0xFFFFFFFF:
        raise PackingError(f"{location} must be an unsigned 32-bit integer")
    return value


def _cpp_string(value: str) -> str:
    """Return a portable narrow C++ string literal for manifest ASCII."""

    try:
        value.encode("ascii")
    except UnicodeEncodeError as error:
        raise PackingError(f"generated package strings must be ASCII: {value!r}") from error
    return json.dumps(value, ensure_ascii=True)


def _identifier(prefix: str, index: int) -> str:
    return f"{prefix}{index:04d}"


def load_manifest(path: Path) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise PackingError(f"manifest does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise PackingError(f"manifest is invalid JSON: {path}: {error}") from error
    manifest = _require_object(value, "manifest")
    if manifest.get("schema_version") != EXPECTED_MANIFEST_SCHEMA:
        raise PackingError(
            f"unsupported manifest schema {manifest.get('schema_version')!r}; "
            f"expected {EXPECTED_MANIFEST_SCHEMA}"
        )
    return manifest


def flatten_effects(manifest: Mapping[str, object]) -> list[dict[str, object]]:
    shared = _require_list(manifest.get("shared_effects"), "manifest.shared_effects")
    variants = _require_list(manifest.get("effect_variants"), "manifest.effect_variants")
    effects = [
        _require_object(value, f"manifest effect {index}")
        for index, value in enumerate(shared + variants)
    ]
    effect_ids = [_require_string(effect.get("id"), "effect.id") for effect in effects]
    if len(effect_ids) != len(set(effect_ids)):
        raise PackingError("manifest contains duplicate effect IDs")
    return effects


def flatten_passes(effects: Sequence[Mapping[str, object]]) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    pass_ids: set[str] = set()
    for effect in effects:
        effect_id = _require_string(effect.get("id"), "effect.id")
        passes = _require_list(effect.get("passes"), f"effect {effect_id}.passes")
        if not passes:
            raise PackingError(f"effect {effect_id} has no passes")
        for value in passes:
            shader_pass = _require_object(value, f"effect {effect_id} pass")
            pass_id = _require_string(shader_pass.get("id"), f"effect {effect_id} pass.id")
            if pass_id in pass_ids:
                raise PackingError(f"duplicate pass ID: {pass_id}")
            if not pass_id.startswith(effect_id + "."):
                raise PackingError(f"pass {pass_id} does not belong to effect {effect_id}")
            pass_ids.add(pass_id)
            shader_pass = dict(shader_pass)
            shader_pass["_effect_id"] = effect_id
            result.append(shader_pass)
    return result


def load_cso_map(path: Path, required_pass_ids: set[str]) -> dict[str, Path]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise PackingError(f"CSO map does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise PackingError(f"CSO map is invalid JSON: {path}: {error}") from error
    root = _require_object(raw, "CSO map")
    if "passes" in root:
        if root.get("schema_version") != EXPECTED_MAP_SCHEMA:
            raise PackingError(
                f"unsupported CSO map schema {root.get('schema_version')!r}; "
                f"expected {EXPECTED_MAP_SCHEMA}"
            )
        entries = _require_object(root.get("passes"), "CSO map.passes")
    else:
        # A bare pass-ID-to-path object is accepted for simple CMake-generated
        # maps. It has the same strict coverage rules as the versioned form.
        entries = root

    supplied = set(entries)
    missing = sorted(required_pass_ids - supplied)
    extra = sorted(supplied - required_pass_ids)
    if missing or extra:
        details: list[str] = []
        if missing:
            details.append(f"missing {len(missing)} pass(es): {', '.join(missing[:5])}")
        if extra:
            details.append(f"unknown {len(extra)} pass(es): {', '.join(extra[:5])}")
        raise PackingError("CSO map coverage mismatch; " + "; ".join(details))

    result: dict[str, Path] = {}
    for pass_id, raw_cso_path in entries.items():
        cso_path_text = _require_string(raw_cso_path, f"CSO map entry {pass_id}")
        cso_path = Path(cso_path_text)
        if not cso_path.is_absolute():
            cso_path = path.parent / cso_path
        result[pass_id] = cso_path.resolve()
    return result


def read_dxbc(cso_paths: Mapping[str, Path]) -> dict[str, bytes]:
    result: dict[str, bytes] = {}
    for pass_id, path in sorted(cso_paths.items()):
        try:
            bytecode = path.read_bytes()
        except FileNotFoundError as error:
            raise PackingError(f"compiled shader for {pass_id} does not exist: {path}") from error
        if len(bytecode) < 32 or bytecode[:4] != b"DXBC":
            raise PackingError(f"compiled shader for {pass_id} is not a valid DXBC container: {path}")
        result[pass_id] = bytecode
    return result


def _validate_rpn(value: object, location: str) -> list[str]:
    tokens = _require_list(value, location)
    return [_require_string(token, f"{location} token") for token in tokens]


def _bytes_initializer(value: bytes, indent: str = "    ") -> list[str]:
    result: list[str] = []
    for offset in range(0, len(value), 12):
        chunk = value[offset : offset + 12]
        result.append(indent + ", ".join(f"0x{byte:02x}" for byte in chunk) + ",")
    return result


def generate_cpp(
    manifest: Mapping[str, object],
    bytecode_by_pass: Mapping[str, bytes],
    header_include: str = DEFAULT_HEADER_INCLUDE,
) -> str:
    effects = flatten_effects(manifest)
    passes = flatten_passes(effects)
    pass_index_by_id = {
        _require_string(shader_pass.get("id"), "pass.id"): index
        for index, shader_pass in enumerate(passes)
    }
    if set(pass_index_by_id) != set(bytecode_by_pass):
        raise PackingError("bytecode set does not exactly match manifest pass IDs")

    lines: list[str] = [
        "// Generated file. Do not edit.",
        "// Source: native/generated-models/manifest.json + FXC cs_5_0 outputs.",
        f"#include {_cpp_string(header_include)}",
        "",
        "#include <cstdint>",
        "#include <span>",
        "#include <string_view>",
        "",
        "namespace anime4k::models {",
        "namespace {",
        "",
    ]

    # Pass-local bytecode, binding, and RPN storage. The final Pass arrays refer
    # to these objects and are themselves grouped by effect below.
    pass_data: dict[str, dict[str, object]] = {}
    for global_index, shader_pass in enumerate(passes):
        pass_id = _require_string(shader_pass.get("id"), "pass.id")
        output = _require_object(shader_pass.get("output"), f"pass {pass_id}.output")
        bindings_raw = _require_list(shader_pass.get("bindings"), f"pass {pass_id}.bindings")
        if not bindings_raw:
            raise PackingError(f"pass {pass_id} has no bindings")
        bindings: list[tuple[str, int]] = []
        for binding_index, value in enumerate(bindings_raw):
            binding = _require_object(value, f"pass {pass_id}.bindings[{binding_index}]")
            bindings.append(
                (
                    _require_string(binding.get("logical_resource"), "binding.logical_resource"),
                    _require_uint(binding.get("srv_slot"), "binding.srv_slot"),
                )
            )
        expected_slots = list(range(len(bindings)))
        if [slot for _, slot in bindings] != expected_slots:
            raise PackingError(f"pass {pass_id} bindings must occupy contiguous t0..tN slots")

        width_rpn = _validate_rpn(output.get("width_rpn"), f"pass {pass_id}.width_rpn")
        height_rpn = _validate_rpn(output.get("height_rpn"), f"pass {pass_id}.height_rpn")
        when_rpn = _validate_rpn(shader_pass.get("when_rpn"), f"pass {pass_id}.when_rpn")
        if not width_rpn or not height_rpn:
            raise PackingError(f"pass {pass_id} has an empty output dimension expression")
        replaces = output.get("replaces_bound_resource")
        if not isinstance(replaces, bool):
            raise PackingError(f"pass {pass_id}.replaces_bound_resource must be boolean")

        bytecode_name = _identifier("kBytecode", global_index)
        bindings_name = _identifier("kBindings", global_index)
        width_name = _identifier("kWidthRpn", global_index)
        height_name = _identifier("kHeightRpn", global_index)
        when_name = _identifier("kWhenRpn", global_index)

        lines.append(f"alignas(4) constexpr std::uint8_t {bytecode_name}[] = {{")
        lines.extend(_bytes_initializer(bytecode_by_pass[pass_id]))
        lines.extend(["};", ""])
        lines.append(f"constexpr Binding {bindings_name}[] = {{")
        for logical, slot in bindings:
            lines.append(f"    {{{_cpp_string(logical)}, {slot}u}},")
        lines.extend(["};", ""])

        def emit_tokens(name: str, tokens: Sequence[str]) -> None:
            if not tokens:
                return
            lines.append(f"constexpr const char* {name}[] = {{")
            for token in tokens:
                lines.append(f"    {_cpp_string(token)},")
            lines.extend(["};", ""])

        emit_tokens(width_name, width_rpn)
        emit_tokens(height_name, height_rpn)
        emit_tokens(when_name, when_rpn)
        pass_data[pass_id] = {
            "bytecode": bytecode_name,
            "bindings": bindings_name,
            "binding_count": len(bindings),
            "width": width_name,
            "width_count": len(width_rpn),
            "height": height_name,
            "height_count": len(height_rpn),
            "when": when_name,
            "when_count": len(when_rpn),
            "output": _require_string(output.get("logical_resource"), f"pass {pass_id}.output.resource"),
            "replaces": replaces,
            "bytecode_size": len(bytecode_by_pass[pass_id]),
        }

    effect_storage_names: list[str] = []
    for effect_index, effect in enumerate(effects):
        effect_id = _require_string(effect.get("id"), "effect.id")
        effect_passes = _require_list(effect.get("passes"), f"effect {effect_id}.passes")
        storage_name = _identifier("kPasses", effect_index)
        effect_storage_names.append(storage_name)
        lines.append(f"constexpr Pass {storage_name}[] = {{")
        for value in effect_passes:
            shader_pass = _require_object(value, f"effect {effect_id} pass")
            pass_id = _require_string(shader_pass.get("id"), "pass.id")
            data = pass_data[pass_id]
            when_pointer = data["when"] if data["when_count"] else "nullptr"
            lines.extend(
                [
                    "    {",
                    f"        {_cpp_string(pass_id)},",
                    f"        {data['bindings']},",
                    f"        {data['binding_count']}u,",
                    f"        {_cpp_string(str(data['output']))},",
                    f"        {data['width']},",
                    f"        {data['width_count']}u,",
                    f"        {data['height']},",
                    f"        {data['height_count']}u,",
                    f"        {when_pointer},",
                    f"        {data['when_count']}u,",
                    f"        {'true' if data['replaces'] else 'false'},",
                    f"        {data['bytecode']},",
                    f"        {data['bytecode_size']}u,",
                    "    },",
                ]
            )
        lines.extend(["};", ""])

    lines.append("constexpr Effect kEffectStorage[] = {")
    for effect_index, effect in enumerate(effects):
        effect_id = _require_string(effect.get("id"), "effect.id")
        family = _require_string(effect.get("family"), f"effect {effect_id}.family")
        pass_count = len(_require_list(effect.get("passes"), f"effect {effect_id}.passes"))
        lines.append(
            f"    {{{_cpp_string(effect_id)}, {_cpp_string(family)}, "
            f"{effect_storage_names[effect_index]}, {pass_count}u}},"
        )
    lines.extend(["};", ""])

    presets_raw = _require_list(manifest.get("presets"), "manifest.presets")
    if not presets_raw:
        raise PackingError("manifest contains no presets")
    preset_effect_names: list[str] = []
    effect_ids = {_require_string(effect.get("id"), "effect.id") for effect in effects}
    presets: list[dict[str, object]] = []
    preset_keys: set[tuple[str, str]] = set()
    for preset_index, raw_preset in enumerate(presets_raw):
        preset = _require_object(raw_preset, f"preset {preset_index}")
        preset_id = _require_string(preset.get("id"), "preset.id")
        mode = _require_string(preset.get("mode"), f"preset {preset_id}.mode")
        quality = _require_string(preset.get("quality"), f"preset {preset_id}.quality")
        if (mode, quality) in preset_keys:
            raise PackingError(f"duplicate preset mode/quality pair: {mode}/{quality}")
        preset_keys.add((mode, quality))
        raw_effect_ids = _require_list(preset.get("effects"), f"preset {preset_id}.effects")
        selected_effects = [
            _require_string(value, f"preset {preset_id}.effect") for value in raw_effect_ids
        ]
        unknown = [effect_id for effect_id in selected_effects if effect_id not in effect_ids]
        if unknown:
            raise PackingError(f"preset {preset_id} references unknown effects: {', '.join(unknown)}")
        storage_name = _identifier("kPresetEffects", preset_index)
        preset_effect_names.append(storage_name)
        lines.append(f"constexpr const char* {storage_name}[] = {{")
        for selected_effect in selected_effects:
            lines.append(f"    {_cpp_string(selected_effect)},")
        lines.extend(["};", ""])
        presets.append(preset)

    lines.append("constexpr Preset kPresetStorage[] = {")
    for preset_index, preset in enumerate(presets):
        preset_id = _require_string(preset.get("id"), "preset.id")
        mode = _require_string(preset.get("mode"), f"preset {preset_id}.mode")
        quality = _require_string(preset.get("quality"), f"preset {preset_id}.quality")
        effect_count = len(_require_list(preset.get("effects"), f"preset {preset_id}.effects"))
        lines.append(
            f"    {{{_cpp_string(preset_id)}, {_cpp_string(mode)}, {_cpp_string(quality)}, "
            f"{preset_effect_names[preset_index]}, {effect_count}u}},"
        )
    lines.extend(
        [
            "};",
            "",
            "}  // namespace",
            "",
            "std::span<const Effect> effects() noexcept {",
            "  return {kEffectStorage, sizeof(kEffectStorage) / sizeof(kEffectStorage[0])};",
            "}",
            "",
            "std::span<const Preset> presets() noexcept {",
            "  return {kPresetStorage, sizeof(kPresetStorage) / sizeof(kPresetStorage[0])};",
            "}",
            "",
            "const Effect* find_effect(std::string_view id) noexcept {",
            "  for (const Effect& effect : kEffectStorage) {",
            "    if (id == effect.id) {",
            "      return &effect;",
            "    }",
            "  }",
            "  return nullptr;",
            "}",
            "",
            "const Preset* find_preset(std::string_view mode, std::string_view quality) noexcept {",
            "  for (const Preset& preset : kPresetStorage) {",
            "    if (mode == preset.mode && quality == preset.quality) {",
            "      return &preset;",
            "    }",
            "  }",
            "  return nullptr;",
            "}",
            "",
            "}  // namespace anime4k::models",
            "",
        ]
    )
    return "\n".join(lines)


def write_if_changed(path: Path, content: str) -> None:
    encoded = content.encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == encoded:
        return
    path.write_bytes(encoded)


def pack(
    manifest_path: Path,
    cso_map_path: Path,
    output_path: Path,
    header_include: str = DEFAULT_HEADER_INCLUDE,
) -> str:
    manifest = load_manifest(manifest_path)
    effects = flatten_effects(manifest)
    passes = flatten_passes(effects)
    pass_ids = {_require_string(shader_pass.get("id"), "pass.id") for shader_pass in passes}
    cso_paths = load_cso_map(cso_map_path, pass_ids)
    bytecode = read_dxbc(cso_paths)
    generated = generate_cpp(manifest, bytecode, header_include)
    write_if_changed(output_path, generated)
    return generated


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--cso-map", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True, help="generated .cpp path")
    parser.add_argument(
        "--header-include",
        default=DEFAULT_HEADER_INCLUDE,
        help=f"include used by generated source (default: {DEFAULT_HEADER_INCLUDE})",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    try:
        generated = pack(
            args.manifest.resolve(),
            args.cso_map.resolve(),
            args.output.resolve(),
            args.header_include,
        )
    except PackingError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"packed model package to {args.output} ({len(generated.encode('utf-8'))} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
