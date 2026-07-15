#!/usr/bin/env python3
"""Generate deterministic Direct3D 11 HLSL kernels from Anime4K mpv GLSL.

The upstream Anime4K model files are sequences of mpv user-shader passes. Each
``//!DESC`` section becomes one independent Shader Model 5 compute shader. The
accompanying manifest preserves the logical resource graph, dimensions, and
``//!WHEN`` expression so a D3D11 renderer can schedule the passes exactly.

Only Python's standard library is required. Generated shader binaries are
deliberately not checked in: pass ``--validate-fxc`` to compile every generated
kernel into the repository-local ``.tmp`` directory as a build-time check.
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Iterable, Mapping, Sequence


GENERATOR_VERSION = 1
THREAD_GROUP = (8, 8, 1)
MAX_D3D11_CS_SRVS = 128

NATIVE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = NATIVE_ROOT.parent
VENDORED_ROOT = NATIVE_ROOT / "third_party" / "anime4k"
VENDORED_ROOTS = {
    "anime4k": VENDORED_ROOT,
    "artcnn": NATIVE_ROOT / "third_party" / "artcnn",
    "acnetglsl": NATIVE_ROOT / "third_party" / "acnetglsl",
}
DEFAULT_OUTPUT_ROOT = NATIVE_ROOT / "generated-models"
DEFAULT_VALIDATION_ROOT = REPOSITORY_ROOT / ".tmp" / "anime4k-fxc"
PRESET_GRAPH_PATH = REPOSITORY_ROOT / "preset-graph.json"


@dataclasses.dataclass(frozen=True)
class ModelSpec:
    model_id: str
    family: str
    quality: str
    source: str
    scale: int
    vendor: str = "anime4k"
    luma_model: bool = False


MODEL_SPECS: tuple[ModelSpec, ...] = (
    ModelSpec("restore_m", "restore", "M", "glsl/Restore/Anime4K_Restore_CNN_M.glsl", 1),
    ModelSpec("restore_vl", "restore", "VL", "glsl/Restore/Anime4K_Restore_CNN_VL.glsl", 1),
    ModelSpec("restore_ul", "restore", "UL", "glsl/Restore/Anime4K_Restore_CNN_UL.glsl", 1),
    ModelSpec(
        "restore_soft_m",
        "restore_soft",
        "M",
        "glsl/Restore/Anime4K_Restore_CNN_Soft_M.glsl",
        1,
    ),
    ModelSpec(
        "restore_soft_vl",
        "restore_soft",
        "VL",
        "glsl/Restore/Anime4K_Restore_CNN_Soft_VL.glsl",
        1,
    ),
    ModelSpec(
        "restore_soft_ul",
        "restore_soft",
        "UL",
        "glsl/Restore/Anime4K_Restore_CNN_Soft_UL.glsl",
        1,
    ),
    ModelSpec("upscale_m", "upscale", "M", "glsl/Upscale/Anime4K_Upscale_CNN_x2_M.glsl", 2),
    ModelSpec("upscale_vl", "upscale", "VL", "glsl/Upscale/Anime4K_Upscale_CNN_x2_VL.glsl", 2),
    ModelSpec("upscale_ul", "upscale", "UL", "glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl", 2),
    ModelSpec(
        "denoise_upscale_m",
        "denoise_upscale",
        "M",
        "glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_M.glsl",
        2,
    ),
    ModelSpec(
        "denoise_upscale_vl",
        "denoise_upscale",
        "VL",
        "glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl",
        2,
    ),
    ModelSpec(
        "denoise_upscale_ul",
        "denoise_upscale",
        "UL",
        "glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_UL.glsl",
        2,
    ),
)

EXTERNAL_MODEL_SPECS: tuple[ModelSpec, ...] = (
    ModelSpec(
        "artcnn_c4f16",
        "artcnn",
        "realtime",
        "glsl/ArtCNN_C4F16.glsl",
        2,
        vendor="artcnn",
        luma_model=True,
    ),
    ModelSpec(
        "acnet_f8b4",
        "acnet",
        "realtime",
        "glsl/acnet/acnet_f8b4.glsl",
        2,
        vendor="acnetglsl",
        luma_model=True,
    ),
    ModelSpec(
        "arnet_f8b8",
        "arnet",
        "realtime",
        "glsl/arnet/arnet_f8b8.glsl",
        2,
        vendor="acnetglsl",
        luma_model=True,
    ),
)

CLAMP_SPEC = ModelSpec(
    "clamp",
    "clamp",
    "shared",
    "glsl/Restore/Anime4K_Clamp_Highlights.glsl",
    1,
)

@dataclasses.dataclass(frozen=True)
class ShaderPass:
    description: str
    hook: str
    bindings: tuple[str, ...]
    save: str | None
    components: int
    width_rpn: tuple[str, ...]
    height_rpn: tuple[str, ...]
    when_rpn: tuple[str, ...]
    body: str
    source_line: int


_DESC_RE = re.compile(r"^//!DESC(?:[ \t]+.*)?$", re.MULTILINE)
_DIRECTIVE_RE = re.compile(r"^//!([A-Z]+)(?:[ \t]+(.*?))?[ \t]*$")
_RESOURCE_REFERENCE_RE = re.compile(
    r"\b([A-Za-z_][A-Za-z0-9_]*)_(?:texOff|tex|pos|pt|size)\b"
)
_TEXOFF_REFERENCE_RE = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)_texOff\b")
_TEX_CURRENT_REFERENCE_RE = re.compile(
    r"\b([A-Za-z_][A-Za-z0-9_]*)_tex\(\s*\1_pos\s*\)"
)
_NUMBER_TOKEN_RE = re.compile(
    r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$"
)
_MATRIX_MULTIPLY_RE = re.compile(
    r"\bmat4\((?P<args>[^()]+)\)\s*\*\s*(?P<rhs>[^;\r\n]+)"
)


class GenerationError(RuntimeError):
    """Raised when a vendored source violates the supported Anime4K grammar."""


@dataclasses.dataclass(frozen=True)
class SamplingPlan:
    """Per-pass sampling specializations proven from the resource graph.

    Equal-sized texel neighbors are exact integer ``Texture.Load`` operations.
    Depth-to-space passes can also sample lower-resolution feature maps while
    writing a larger output; those lookups must retain mpv's normalized
    ``texture(..., pos + offset * pt)`` semantics instead.
    """

    current_texel_loads: frozenset[str]
    texoff_integer_loads: frozenset[str]


def load_preset_graph() -> tuple[Mapping[str, tuple[str, ...]], tuple[str, ...], str]:
    try:
        encoded = PRESET_GRAPH_PATH.read_bytes()
        graph = json.loads(encoded.decode("utf-8"))
    except (FileNotFoundError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise GenerationError(f"invalid canonical preset graph: {PRESET_GRAPH_PATH}") from error

    expected_modes = ("A", "B", "C", "AA", "BB", "CA")
    expected_qualities = ("M", "VL", "UL")
    step_to_family = {
        "ClampHighlights": "clamp",
        "Restore": "restore",
        "RestoreSoft": "restore_soft",
        "Upscale": "upscale",
        "DenoiseUpscale": "denoise_upscale",
    }
    if not isinstance(graph, dict) or graph.get("schemaVersion") != 1:
        raise GenerationError("canonical preset graph schemaVersion must be 1")
    modes = graph.get("modes")
    if not isinstance(modes, dict) or tuple(modes) != expected_modes:
        raise GenerationError("canonical preset graph contains unexpected modes or ordering")
    qualities = graph.get("qualities")
    if not isinstance(qualities, list) or tuple(qualities) != expected_qualities:
        raise GenerationError("canonical preset graph contains unexpected qualities")

    families: dict[str, tuple[str, ...]] = {}
    for mode, steps in modes.items():
        if not isinstance(steps, list) or not steps or steps[0] != "ClampHighlights":
            raise GenerationError(f"preset {mode} must begin with ClampHighlights")
        try:
            families[mode] = tuple(step_to_family[step] for step in steps)
        except (KeyError, TypeError) as error:
            raise GenerationError(f"preset {mode} contains an unsupported step") from error
    return families, expected_qualities, sha256_bytes(encoded)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


PRESET_FAMILIES, PRESET_QUALITIES, PRESET_GRAPH_SHA256 = load_preset_graph()


def parse_shader_passes(source: str, source_name: str) -> list[ShaderPass]:
    starts = [match.start() for match in _DESC_RE.finditer(source)]
    if not starts:
        raise GenerationError(f"{source_name}: no //!DESC sections found")

    result: list[ShaderPass] = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(source)
        chunk = source[start:end]
        directives: dict[str, list[str]] = {}
        body_lines: list[str] = []

        for line in chunk.splitlines():
            directive = _DIRECTIVE_RE.match(line)
            if directive:
                key = directive.group(1)
                directives.setdefault(key, []).append(directive.group(2) or "")
            else:
                body_lines.append(line.rstrip())

        def exactly_one(key: str) -> str:
            values = directives.get(key, [])
            if len(values) != 1:
                raise GenerationError(
                    f"{source_name}: pass {index} needs exactly one //!{key}, got {len(values)}"
                )
            return values[0]

        description = exactly_one("DESC")
        hook = exactly_one("HOOK")
        bindings = tuple(directives.get("BIND", []))
        if not bindings:
            raise GenerationError(f"{source_name}: pass {index} has no //!BIND")
        if len(set(bindings)) != len(bindings):
            raise GenerationError(f"{source_name}: pass {index} contains duplicate bindings")
        if len(bindings) > MAX_D3D11_CS_SRVS:
            raise GenerationError(
                f"{source_name}: pass {index} needs {len(bindings)} SRVs; D3D11 allows "
                f"{MAX_D3D11_CS_SRVS}"
            )

        saves = directives.get("SAVE", [])
        if len(saves) > 1:
            raise GenerationError(f"{source_name}: pass {index} contains multiple //!SAVE lines")
        save = saves[0] if saves else None

        component_values = directives.get("COMPONENTS", ["4"])
        if len(component_values) != 1 or component_values[0] not in {"1", "2", "3", "4"}:
            raise GenerationError(f"{source_name}: pass {index} has invalid //!COMPONENTS")

        default_dimension_resource = "HOOKED" if "HOOKED" in bindings else bindings[0]
        width_values = directives.get("WIDTH", [f"{default_dimension_resource}.w"])
        height_values = directives.get("HEIGHT", [f"{default_dimension_resource}.h"])
        when_values = directives.get("WHEN", [])
        if len(width_values) != 1 or len(height_values) != 1 or len(when_values) > 1:
            raise GenerationError(f"{source_name}: pass {index} has ambiguous dimensions/condition")

        body = "\n".join(body_lines).strip() + "\n"
        if not re.search(r"\bvec4\s+hook\s*\(\s*\)", body):
            raise GenerationError(f"{source_name}: pass {index} has no vec4 hook()")

        result.append(
            ShaderPass(
                description=description,
                hook=hook,
                bindings=bindings,
                save=save,
                components=int(component_values[0]),
                width_rpn=tuple(width_values[0].split()),
                height_rpn=tuple(height_values[0].split()),
                when_rpn=tuple(when_values[0].split()) if when_values else (),
                body=body,
                source_line=source.count("\n", 0, start) + 1,
            )
        )

    return result


def resource_slot_map(shader_pass: ShaderPass) -> tuple[dict[str, int], dict[str, int]]:
    """Return (declared bindings, all GLSL aliases) mapped to t-register slots."""

    declared = {name: index for index, name in enumerate(shader_pass.bindings)}
    aliases = dict(declared)
    referenced = set(_RESOURCE_REFERENCE_RE.findall(shader_pass.body))

    for name in sorted(referenced):
        if name in aliases:
            continue
        # In an mpv MAIN hook, HOOKED is the current MAIN texture. The clamp
        # source declares BIND HOOKED but intentionally samples it as MAIN in
        # its horizontal statistics pass.
        if name == "MAIN" and shader_pass.hook == "MAIN" and "HOOKED" in declared:
            aliases[name] = declared["HOOKED"]
            continue
        if name == "HOOKED" and shader_pass.hook in declared:
            aliases[name] = declared[shader_pass.hook]
            continue
        raise GenerationError(
            f"{shader_pass.description}: resource helper {name}_* has no resolvable //!BIND"
        )

    return declared, aliases


DimensionExpression = tuple[object, ...]


def _evaluate_dimension_expression(
    tokens: tuple[str, ...],
    component: str,
    dimensions: Mapping[str, tuple[DimensionExpression, DimensionExpression]],
) -> DimensionExpression:
    """Resolve an mpv dimension RPN expression to a canonical symbolic tree."""

    stack: list[DimensionExpression] = []
    component_index = 0 if component == "w" else 1
    for token in tokens:
        if token in {"*", "/", ">"}:
            if len(stack) < 2:
                raise GenerationError(f"invalid dimension RPN expression: {' '.join(tokens)}")
            right = stack.pop()
            left = stack.pop()
            if token == "*" and right == ("constant", "1"):
                stack.append(left)
            elif token == "*" and left == ("constant", "1"):
                stack.append(right)
            elif token == "/" and right == ("constant", "1"):
                stack.append(left)
            else:
                stack.append((token, left, right))
            continue
        if _NUMBER_TOKEN_RE.fullmatch(token):
            stack.append(("constant", token.rstrip("0").rstrip(".") if "." in token else token))
            continue
        dot = token.rfind(".")
        if dot <= 0 or token[dot + 1 :] != component:
            raise GenerationError(f"unsupported dimension token: {token}")
        resource = token[:dot]
        if resource == "OUTPUT":
            stack.append(("target", component))
            continue
        resource_dimensions = dimensions.get(resource)
        if resource_dimensions is None:
            raise GenerationError(f"dimension resource is not available: {resource}")
        stack.append(resource_dimensions[component_index])
    if len(stack) != 1:
        raise GenerationError(f"invalid dimension RPN expression: {' '.join(tokens)}")
    return stack[0]


def build_sampling_plans(
    model: ModelSpec, passes: Sequence[ShaderPass]
) -> tuple[SamplingPlan, ...]:
    """Choose exact integer loads or normalized sampling for every pass.

    A texOff lookup is an integer neighbor of the current hook texel. Direct
    Load preserves that operation only when the referenced resource and pass
    output have the same symbolic dimensions. Dimension identities can flow
    through several SAVE passes, so this analysis is intentionally model-wide.
    A dimensions-mismatched lookup remains valid, but must use normalized
    sampling because one output texel no longer identifies one input texel.
    """

    input_dimensions = (("input", "w"), ("input", "h"))
    dimensions: dict[str, tuple[DimensionExpression, DimensionExpression]] = {
        "MAIN": input_dimensions,
        "HOOKED": input_dimensions,
        "LUMA": input_dimensions,
    }
    plans: list[SamplingPlan] = []
    for pass_index, shader_pass in enumerate(passes):
        declared, aliases = resource_slot_map(shader_pass)
        for resource in declared:
            if resource not in dimensions:
                raise GenerationError(
                    f"{model.model_id} pass {pass_index}: bound dimension resource "
                    f"is not available: {resource}"
                )
        output_dimensions = (
            _evaluate_dimension_expression(shader_pass.width_rpn, "w", dimensions),
            _evaluate_dimension_expression(shader_pass.height_rpn, "h", dimensions),
        )
        references = set(_TEXOFF_REFERENCE_RE.findall(shader_pass.body))
        texoff_integer_loads: set[str] = set()
        for resource in sorted(references):
            slot = aliases.get(resource)
            if slot is None:
                raise GenerationError(
                    f"{shader_pass.description}: unresolved texOff resource {resource}"
                )
            bound_resource = shader_pass.bindings[slot]
            if dimensions[bound_resource] == output_dimensions:
                texoff_integer_loads.add(resource)
        safe_current_references: set[str] = set()
        for resource in set(_TEX_CURRENT_REFERENCE_RE.findall(shader_pass.body)):
            slot = aliases.get(resource)
            if slot is None:
                raise GenerationError(
                    f"{shader_pass.description}: unresolved current-texel resource {resource}"
                )
            bound_resource = shader_pass.bindings[slot]
            if dimensions[bound_resource] == output_dimensions:
                safe_current_references.add(resource)
        plans.append(
            SamplingPlan(
                current_texel_loads=frozenset(safe_current_references),
                texoff_integer_loads=frozenset(texoff_integer_loads),
            )
        )
        dimensions[shader_pass.save or "HOOKED"] = output_dimensions
    return tuple(plans)


def validate_model_texoff_load_dimensions(
    model: ModelSpec, passes: Sequence[ShaderPass]
) -> tuple[SamplingPlan, ...]:
    """Compatibility wrapper for callers of the former validation helper."""

    return build_sampling_plans(model, passes)


def translate_glsl_body(body: str, description: str) -> str:
    """Translate the deliberately small GLSL subset emitted by Anime4K."""

    # GLSL constructors are column-major. Given the same 16 constructor
    # values, mul(vector, HLSL-matrix) exactly matches GLSL matrix * vector.
    translated = _MATRIX_MULTIPLY_RE.sub(
        lambda match: (
            f"mul({match.group('rhs').strip()}, float4x4({match.group('args')}))"
        ),
        body,
    )
    translated = re.sub(r"\bivec2\b", "int2", translated)
    translated = re.sub(r"\bvec2\b", "float2", translated)
    translated = re.sub(r"\bvec3\b", "float3", translated)
    translated = re.sub(r"\bvec4\b", "float4", translated)
    translated = re.sub(r"\bfract\b", "frac", translated)
    # GLSL splats a scalar passed to a vector constructor. FXC requires the
    # component count explicitly (the upstream models currently use 0.5 and
    # 2.0 splats in their depth-to-space pass).
    scalar_literal = r"([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)"
    for component_count in (2, 3, 4):
        translated = re.sub(
            rf"\bfloat{component_count}\(\s*{scalar_literal}\s*\)",
            lambda match, count=component_count: (
                f"float{count}(" + ", ".join([match.group(1)] * count) + ")"
            ),
            translated,
        )
    translated, hook_count = re.subn(
        r"\bfloat4\s+hook\s*\(\s*\)",
        "float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel)",
        translated,
    )
    if hook_count != 1:
        raise GenerationError(f"{description}: expected one hook(), translated {hook_count}")

    unsupported = {
        token
        for token in ("mat4", "vec2", "vec3", "vec4", "ivec2", "fract")
        if re.search(rf"\b{token}\b", translated)
    }
    if unsupported:
        raise GenerationError(
            f"{description}: unsupported GLSL tokens remain: {', '.join(sorted(unsupported))}"
        )
    return translated


def generate_hlsl(
    model: ModelSpec,
    pass_index: int,
    shader_pass: ShaderPass,
    sampling_plan: SamplingPlan,
) -> tuple[str, dict[str, int]]:
    declared, aliases = resource_slot_map(shader_pass)
    texoff_references = set(_TEXOFF_REFERENCE_RE.findall(shader_pass.body))
    normalized_texoff_slots = {
        aliases[resource]
        for resource in texoff_references - set(sampling_plan.texoff_integer_loads)
    }
    specialized_body = shader_pass.body
    for resource in sorted(sampling_plan.current_texel_loads):
        specialized_body, replacement_count = re.subn(
            rf"\b{re.escape(resource)}_tex\(\s*{re.escape(resource)}_pos\s*\)",
            f"{resource}_texCurrent",
            specialized_body,
        )
        if replacement_count == 0:
            raise GenerationError(
                f"{shader_pass.description}: current-texel specialization disappeared for {resource}"
            )
    translated_body = translate_glsl_body(specialized_body, shader_pass.description)
    sample_type = "float4"

    license_notice = {
        "anime4k": "Anime4K is Copyright (c) 2019-2021 bloc97, MIT licensed.",
        "artcnn": "ArtCNN is Copyright (c) 2024 Joao Chrisostomo, MIT licensed.",
        "acnetglsl": "ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.",
    }[model.vendor]
    lines: list[str] = [
        "// Generated file. Do not edit.",
        f"// Generator: native/tools/generate_anime4k_models.py v{GENERATOR_VERSION}",
        f"// Upstream source: {model.source}:{shader_pass.source_line}",
        f"// Pass: {pass_index:03d} - {shader_pass.description}",
        f"// {license_notice}",
        "",
        "cbuffer Anime4KPassConstants : register(b0)",
        "{",
        "    uint2 Anime4KOutputSize;",
        "    uint2 Anime4KReserved;",
        f"    uint4 Anime4KInputSizes[{len(shader_pass.bindings)}];",
        "};",
        "",
    ]

    for slot in range(len(shader_pass.bindings)):
        lines.append(f"Texture2D<float4> Anime4KInput{slot} : register(t{slot});")
    lines.extend(
        [
            "SamplerState Anime4KLinearClampSampler : register(s0);",
            "RWTexture2D<float4> Anime4KOutput : register(u0);",
            "",
        ]
    )

    for slot in range(len(shader_pass.bindings)):
        if shader_pass.bindings[slot] == "LUMA":
            transform_body = (
                "    float luma = dot(value.rgb, float3(0.2126, 0.7152, 0.0722));\n"
                "    return float4(luma, 0.0, 0.0, 1.0);"
            )
        else:
            transform_body = "    return value;"
        lines.extend(
            [
                f"{sample_type} Anime4KTransform{slot}({sample_type} value)",
                "{",
                transform_body,
                "}",
                "",
                f"float2 Anime4KClampUv{slot}(float2 uv)",
                "{",
                f"    float2 size = max(float2(Anime4KInputSizes[{slot}].xy), float2(1.0, 1.0));",
                "    return clamp(uv, 0.5 / size, (size - 0.5) / size);",
                "}",
                "",
                f"{sample_type} Anime4KSample{slot}(float2 uv)",
                "{",
                f"    return Anime4KTransform{slot}({sample_type}(Anime4KInput{slot}.SampleLevel(",
                f"        Anime4KLinearClampSampler, Anime4KClampUv{slot}(uv), 0.0)));",
                "}",
                "",
                f"{sample_type} Anime4KLoadOffset{slot}(uint2 position, float2 offset)",
                "{",
                f"    int2 maximum_position = int2(Anime4KInputSizes[{slot}].xy) - 1;",
                "    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);",
                f"    return Anime4KTransform{slot}({sample_type}(Anime4KInput{slot}.Load(int3(source_position, 0))));",
                "}",
                "",
                f"{sample_type} Anime4KLoadCurrent{slot}(uint2 position)",
                "{",
                f"    return Anime4KTransform{slot}({sample_type}(Anime4KInput{slot}.Load(int3(position, 0))));",
                "}",
                "",
            ]
        )
        if slot in normalized_texoff_slots:
            lines.extend(
                [
                    f"{sample_type} Anime4KSampleOffset{slot}(float2 position, float2 offset)",
                    "{",
                    f"    float2 size = max(float2(Anime4KInputSizes[{slot}].xy), float2(1.0, 1.0));",
                    f"    return Anime4KSample{slot}(position + offset / size);",
                    "}",
                    "",
                ]
            )

    for resource_name, slot in sorted(aliases.items()):
        texoff = (
            f"Anime4KLoadOffset{slot}(anime4k_output_pixel, offset)"
            if resource_name in sampling_plan.texoff_integer_loads
            or resource_name not in texoff_references
            else f"Anime4KSampleOffset{slot}(anime4k_pos, offset)"
        )
        lines.extend(
            [
                f"#define {resource_name}_tex(position) Anime4KSample{slot}(position)",
                (
                    f"#define {resource_name}_texOff(offset) "
                    f"{texoff}"
                ),
                (
                    f"#define {resource_name}_texCurrent "
                    f"Anime4KLoadCurrent{slot}(anime4k_output_pixel)"
                ),
                f"#define {resource_name}_pos anime4k_pos",
                f"#define {resource_name}_size float2(Anime4KInputSizes[{slot}].xy)",
                f"#define {resource_name}_pt rcp({resource_name}_size)",
            ]
        )
    lines.extend(["", translated_body.rstrip(), ""])
    lines.extend(
        [
            f"[numthreads({THREAD_GROUP[0]}, {THREAD_GROUP[1]}, {THREAD_GROUP[2]})]",
            "void main(uint3 dispatchThreadId : SV_DispatchThreadID)",
            "{",
        ]
    )
    lines.extend(
        [
            (
                "    if (dispatchThreadId.x >= Anime4KOutputSize.x || "
                "dispatchThreadId.y >= Anime4KOutputSize.y)"
            ),
            "    {",
            "        return;",
            "    }",
            "",
            (
                "    float2 anime4k_pos = "
                "(float2(dispatchThreadId.xy) + 0.5) / float2(Anime4KOutputSize);"
            ),
            (
                "    Anime4KOutput[dispatchThreadId.xy] = "
                "Anime4KHook(anime4k_pos, dispatchThreadId.xy);"
            ),
            "}",
            "",
        ]
    )
    return "\n".join(lines), aliases


def _model_id_for_family(family: str, quality: str) -> str:
    if family == "clamp":
        return "clamp"
    return f"{family}_{quality.lower()}"


def build_presets() -> list[dict[str, object]]:
    presets: list[dict[str, object]] = []
    for mode, families in PRESET_FAMILIES.items():
        for quality in PRESET_QUALITIES:
            effect_ids = [_model_id_for_family(family, quality) for family in families]
            scale = 1
            for effect_id in effect_ids:
                if effect_id.startswith("upscale_") or effect_id.startswith("denoise_upscale_"):
                    scale *= 2
            presets.append(
                {
                    "id": f"{mode}_{quality}",
                    "mode": mode,
                    "quality": quality,
                    "effects": effect_ids,
                    "maximum_scale_if_all_when_conditions_pass": scale,
                }
            )
    for quality in PRESET_QUALITIES:
        presets.extend(
            [
                {
                    "id": f"CNNX2_{quality}",
                    "mode": "CNNX2",
                    "quality": quality,
                    "effects": [f"upscale_{quality.lower()}"],
                    "maximum_scale_if_all_when_conditions_pass": 2,
                },
                {
                    "id": f"ARTCNN_{quality}",
                    "mode": "ARTCNN",
                    "quality": quality,
                    "effects": ["artcnn_c4f16"],
                    "maximum_scale_if_all_when_conditions_pass": 2,
                },
                {
                    "id": f"ACNET_{quality}",
                    "mode": "ACNET",
                    "quality": quality,
                    "effects": ["acnet_f8b4"],
                    "maximum_scale_if_all_when_conditions_pass": 2,
                },
                {
                    "id": f"ARNET_{quality}",
                    "mode": "ARNET",
                    "quality": quality,
                    "effects": ["arnet_f8b8"],
                    "maximum_scale_if_all_when_conditions_pass": 2,
                },
            ]
        )
    return presets


def luma_color_merge_pass() -> ShaderPass:
    return ShaderPass(
        description="Luma model color reconstruction",
        hook="MAIN",
        bindings=("MAIN", "HOOKED"),
        save="MAIN",
        components=4,
        width_rpn=("HOOKED.w",),
        height_rpn=("HOOKED.h",),
        when_rpn=(),
        body="""vec4 hook() {
    vec4 source = MAIN_tex(MAIN_pos);
    float source_luma = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
    float enhanced_luma = HOOKED_tex(HOOKED_pos).x;
    float delta = enhanced_luma - source_luma;
    vec3 color = clamp(source.rgb + vec3(delta, delta, delta), vec3(0.0), vec3(1.0));
    return vec4(color, source.a);
}
""",
        source_line=0,
    )


def generate_model(
    spec: ModelSpec,
    generated_files: dict[Path, str],
) -> dict[str, object]:
    source_path = VENDORED_ROOTS[spec.vendor] / spec.source
    try:
        source_bytes = source_path.read_bytes()
    except FileNotFoundError as error:
        raise GenerationError(f"missing vendored shader: {source_path}") from error
    try:
        source = source_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise GenerationError(f"vendored shader is not UTF-8: {source_path}") from error

    passes = parse_shader_passes(source, spec.source)
    if spec.luma_model:
        passes.append(luma_color_merge_pass())
    sampling_plans = build_sampling_plans(spec, passes)
    pass_entries: list[dict[str, object]] = []
    for pass_index, shader_pass in enumerate(passes):
        hlsl, aliases = generate_hlsl(
            spec, pass_index, shader_pass, sampling_plans[pass_index]
        )
        relative_hlsl_path = Path("hlsl") / spec.model_id / f"pass_{pass_index:03d}.hlsl"
        generated_files[relative_hlsl_path] = hlsl

        alias_entries = {
            name: slot
            for name, slot in sorted(aliases.items())
            if name not in shader_pass.bindings
        }
        pass_entries.append(
            {
                "id": f"{spec.model_id}.pass_{pass_index:03d}",
                "description": shader_pass.description,
                "source_line": shader_pass.source_line,
                "hook": shader_pass.hook,
                "bindings": [
                    {"logical_resource": name, "srv_slot": slot}
                    for slot, name in enumerate(shader_pass.bindings)
                ],
                "aliases": alias_entries,
                "output": {
                    "logical_resource": shader_pass.save or "HOOKED",
                    "uav_slot": 0,
                    "components": shader_pass.components,
                    "format": "R16G16B16A16_FLOAT",
                    "width_rpn": list(shader_pass.width_rpn),
                    "height_rpn": list(shader_pass.height_rpn),
                    "replaces_bound_resource": (shader_pass.save or "HOOKED")
                    in shader_pass.bindings,
                },
                "when_rpn": list(shader_pass.when_rpn),
                "shader": relative_hlsl_path.as_posix(),
                "entry_point": "main",
                "target": "cs_5_0",
                "thread_group": list(THREAD_GROUP),
                "hlsl_sha256": sha256_text(hlsl),
            }
        )

    return {
        "id": spec.model_id,
        "family": spec.family,
        "quality": spec.quality,
        "scale": spec.scale,
        "vendor": spec.vendor,
        "source": spec.source,
        "source_sha256": sha256_bytes(source_bytes),
        "pass_count": len(pass_entries),
        "passes": pass_entries,
    }


def build_outputs() -> tuple[dict[Path, str], dict[str, object]]:
    revision_path = VENDORED_ROOT / "SOURCE_REVISION.json"
    try:
        revision = json.loads(revision_path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as error:
        raise GenerationError(f"invalid source revision metadata: {revision_path}") from error

    license_path = VENDORED_ROOT / "LICENSE"
    try:
        anime4k_license = license_path.read_text(encoding="utf-8")
    except (FileNotFoundError, UnicodeDecodeError) as error:
        raise GenerationError(f"invalid vendored Anime4K license: {license_path}") from error
    if not anime4k_license.endswith("\n"):
        anime4k_license += "\n"

    external_sources: dict[str, object] = {}
    external_licenses: dict[str, str] = {}
    for vendor in ("artcnn", "acnetglsl"):
        root = VENDORED_ROOTS[vendor]
        try:
            external_sources[vendor] = json.loads(
                (root / "SOURCE_REVISION.json").read_text(encoding="utf-8")
            )
            license_text = (root / "LICENSE").read_text(encoding="utf-8")
        except (FileNotFoundError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise GenerationError(f"invalid vendored {vendor} metadata") from error
        external_licenses[vendor] = license_text if license_text.endswith("\n") else license_text + "\n"

    generated_files: dict[Path, str] = {}
    clamp = generate_model(CLAMP_SPEC, generated_files)
    models = [
        generate_model(spec, generated_files)
        for spec in (*MODEL_SPECS, *EXTERNAL_MODEL_SPECS)
    ]
    manifest: dict[str, object] = {
        "schema_version": 1,
        "generator": {
            "path": "native/tools/generate_anime4k_models.py",
            "version": GENERATOR_VERSION,
            "deterministic": True,
        },
        "anime4k_source": revision,
        "anime4k_license_file": "ANIME4K_LICENSE.txt",
        "external_glsl_sources": external_sources,
        "external_license_files": {
            "artcnn": "ARTCNN_LICENSE.txt",
            "acnetglsl": "ACNETGLSL_LICENSE.txt",
        },
        "preset_graph": {
            "path": "preset-graph.json",
            "sha256": PRESET_GRAPH_SHA256,
        },
        "runtime_contract": {
            "api": "Direct3D 11",
            "shader_model": "cs_5_0",
            "constant_buffer_slot": 0,
            "linear_clamp_sampler_slot": 0,
            "output_uav_slot": 0,
            "intermediate_format": "R16G16B16A16_FLOAT",
            "maximum_srv_count": MAX_D3D11_CS_SRVS,
            "thread_group": list(THREAD_GROUP),
            "main_resource_is_effect_input_and_output": True,
            "model_temporary_resources_are_invocation_local": True,
        },
        "shared_effects": [clamp],
        "effect_variants": models,
        "presets": build_presets(),
        "counts": {
            "shared_effects": 1,
            "effect_variants": len(models),
            "presets": len(build_presets()),
            "compute_passes": clamp["pass_count"]
            + sum(int(model["pass_count"]) for model in models),
        },
    }
    manifest_text = json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    generated_files[Path("manifest.json")] = manifest_text
    generated_files[Path("ANIME4K_LICENSE.txt")] = anime4k_license
    generated_files[Path("ARTCNN_LICENSE.txt")] = external_licenses["artcnn"]
    generated_files[Path("ACNETGLSL_LICENSE.txt")] = external_licenses["acnetglsl"]
    return generated_files, manifest


def write_outputs(output_root: Path, generated_files: Mapping[Path, str]) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    expected = {relative.as_posix() for relative in generated_files}
    for existing in sorted(output_root.rglob("*.hlsl")):
        relative = existing.relative_to(output_root).as_posix()
        if relative not in expected:
            existing.unlink()

    for relative, content in sorted(generated_files.items(), key=lambda item: item[0].as_posix()):
        destination = output_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        encoded = content.encode("utf-8")
        if destination.exists() and destination.read_bytes() == encoded:
            continue
        destination.write_bytes(encoded)


def check_outputs(output_root: Path, generated_files: Mapping[Path, str]) -> list[str]:
    problems: list[str] = []
    expected = {relative.as_posix() for relative in generated_files}
    actual_hlsl = {
        path.relative_to(output_root).as_posix()
        for path in output_root.rglob("*.hlsl")
    } if output_root.exists() else set()
    for extra in sorted(actual_hlsl - expected):
        problems.append(f"unexpected generated shader: {extra}")

    for relative, content in sorted(generated_files.items(), key=lambda item: item[0].as_posix()):
        destination = output_root / relative
        if not destination.exists():
            problems.append(f"missing generated file: {relative.as_posix()}")
        elif destination.read_bytes() != content.encode("utf-8"):
            problems.append(f"stale generated file: {relative.as_posix()}")
    return problems


def find_fxc(explicit: str | None) -> Path | None:
    if explicit:
        candidate = Path(explicit)
        return candidate if candidate.is_file() else None
    found = shutil.which("fxc.exe") or shutil.which("fxc")
    if found:
        return Path(found)
    if os.name == "nt":
        kits = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Windows Kits" / "10" / "bin"
        candidates = sorted(kits.glob("*/x64/fxc.exe"), reverse=True)
        if candidates:
            return candidates[0]
    return None


def validate_with_fxc(
    output_root: Path,
    generated_files: Mapping[Path, str],
    fxc: Path,
    validation_root: Path,
) -> None:
    validation_root.mkdir(parents=True, exist_ok=True)
    shaders = sorted(
        (relative for relative in generated_files if relative.suffix == ".hlsl"),
        key=lambda path: path.as_posix(),
    )
    for index, relative in enumerate(shaders, start=1):
        source = output_root / relative
        object_path = validation_root / relative.with_suffix(".cso")
        object_path.parent.mkdir(parents=True, exist_ok=True)
        command = [
            str(fxc),
            "/nologo",
            "/Ges",
            "/WX",
            "/O3",
            "/T",
            "cs_5_0",
            "/E",
            "main",
            "/Fo",
            str(object_path),
            str(source),
        ]
        completed = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if completed.returncode != 0:
            raise GenerationError(
                f"FXC validation failed for {relative.as_posix()}:\n{completed.stdout.rstrip()}"
            )
        if index % 25 == 0 or index == len(shaders):
            print(f"FXC validated {index}/{len(shaders)} kernels")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_ROOT,
        help=f"generated output root (default: {DEFAULT_OUTPUT_ROOT})",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if checked-in outputs differ; do not rewrite them",
    )
    parser.add_argument(
        "--validate-fxc",
        action="store_true",
        help="compile every generated kernel with Microsoft's FXC",
    )
    parser.add_argument("--fxc", help="explicit path to fxc.exe")
    parser.add_argument(
        "--validation-output",
        type=Path,
        default=DEFAULT_VALIDATION_ROOT,
        help="temporary CSO output root (must not be the generated model tree)",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    output_root = args.output.resolve()
    generated_files, manifest = build_outputs()

    if args.check:
        problems = check_outputs(output_root, generated_files)
        if problems:
            for problem in problems:
                print(problem, file=sys.stderr)
            return 1
    else:
        write_outputs(output_root, generated_files)

    if args.validate_fxc:
        fxc = find_fxc(args.fxc)
        if fxc is None:
            print("fxc.exe was requested but could not be found", file=sys.stderr)
            return 2
        validation_root = args.validation_output.resolve()
        if validation_root == output_root or output_root in validation_root.parents:
            print("FXC validation output must be outside the generated model tree", file=sys.stderr)
            return 2
        validate_with_fxc(output_root, generated_files, fxc, validation_root)

    counts = manifest["counts"]
    action = "verified" if args.check else "generated"
    print(
        f"{action} {counts['compute_passes']} kernels for "
        f"{counts['effect_variants']} model variants plus clamp"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
