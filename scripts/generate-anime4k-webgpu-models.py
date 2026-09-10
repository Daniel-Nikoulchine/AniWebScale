#!/usr/bin/env python3
"""Generate tiled WebGPU kernels for the six official Anime4K presets.

The 3x3 convolution passes are translated to shared-memory tiled WGSL using the
same bit-exact tiling as scripts/generate-external-glsl-models.py. The 1x1
output projection is emitted as a non-tiled per-pixel kernel. Depth-to-space is
left to the existing vendor helper (the pipeline builder appends it), because
it is a pure pixel shuffle. ClampHighlights stays on the vendor path.

Output: src/shared/generated-anime4k-webgpu-models.ts
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".tmp" / "anime4k-bench" / "generated-anime4k-webgpu-models.ts"
NATIVE_GENERATOR = ROOT / "native" / "tools" / "generate_anime4k_models.py"
EXTERNAL_GENERATOR = ROOT / "scripts" / "generate-external-glsl-models.py"
VENDOR = ROOT / "native" / "third_party" / "anime4k"

# className -> (model_id, relative GLSL path)
MODEL_SPECS = (
    ("CNNM", "restore-cnn-m", "glsl/Restore/Anime4K_Restore_CNN_M.glsl"),
    ("CNNVL", "restore-cnn-vl", "glsl/Restore/Anime4K_Restore_CNN_VL.glsl"),
    ("CNNUL", "restore-cnn-ul", "glsl/Restore/Anime4K_Restore_CNN_UL.glsl"),
    ("CNNSoftM", "restore-cnn-soft-m", "glsl/Restore/Anime4K_Restore_CNN_Soft_M.glsl"),
    ("CNNSoftVL", "restore-cnn-soft-vl", "glsl/Restore/Anime4K_Restore_CNN_Soft_VL.glsl"),
    ("CNNSoftUL", "restore-cnn-soft-ul", "glsl/Restore/Anime4K_Restore_CNN_Soft_UL.glsl"),
    ("CNNx2M", "upscale-cnn-x2-m", "glsl/Upscale/Anime4K_Upscale_CNN_x2_M.glsl"),
    ("CNNx2VL", "upscale-cnn-x2-vl", "glsl/Upscale/Anime4K_Upscale_CNN_x2_VL.glsl"),
    ("CNNx2UL", "upscale-cnn-x2-ul", "glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl"),
    ("DenoiseCNNx2M", "denoise-cnn-x2-m", "glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_M.glsl"),
    ("DenoiseCNNx2VL", "denoise-cnn-x2-vl", "glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl"),
    ("DenoiseCNNx2UL", "denoise-cnn-x2-ul", "glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_UL.glsl"),
)

TYPE_NAMES = {
    "vec2": "vec2f",
    "vec3": "vec3f",
    "vec4": "vec4f",
    "ivec2": "vec2i",
    "float": "f32",
    "int": "i32",
}


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def expand_macros(body: str) -> str:
    """Expand the object- and function-like #defines used by Anime4K GLSL."""
    object_macros: dict[str, str] = {}
    function_macros: dict[str, tuple[list[str], str]] = {}
    kept: list[str] = []
    for line in body.splitlines():
        match = re.match(r"^\s*#define\s+([A-Za-z_]\w*)(\(([^)]*)\))?\s+(.*)$", line)
        if match:
            name = match.group(1)
            parameters = match.group(3)
            value = re.sub(r"//.*$", "", match.group(4)).strip()
            if parameters is None:
                object_macros[name] = value
            else:
                params = [p.strip() for p in parameters.split(",") if p.strip()]
                function_macros[name] = (params, value)
            continue
        if line.lstrip().startswith("#"):
            continue
        kept.append(line)
    text = "\n".join(kept)

    def function_replacement(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in function_macros:
            return match.group(0)
        params, value = function_macros[name]
        args = [a.strip() for a in match.group(2).split(",")]
        if len(args) != len(params):
            return match.group(0)
        result = value
        for parameter, argument in zip(params, args):
            result = re.sub(rf"\b{re.escape(parameter)}\b", argument, result)
        return f"({result})"

    for _ in range(8):
        expanded = re.sub(r"\b([A-Za-z_]\w*)\s*\(([^()]*)\)", function_replacement, text)
        if expanded == text:
            break
        text = expanded
    for _ in range(8):
        expanded = text
        for name, value in object_macros.items():
            expanded = re.sub(rf"\b{re.escape(name)}\b", f"({value})", expanded)
        if expanded == text:
            break
        text = expanded
    return text


def wgsl_compat(wgsl: str) -> str:
    """GLSL allows max(vecN, scalar); WGSL does not. Anime4K only uses it as a
    ReLU, so route it through a vec4 wrapper."""
    converted = re.sub(r"\bmax\s*\(", "max4(", wgsl)
    return converted + (
        "\nfn max4(vector: vec4f, value: f32) -> vec4f {\n"
        "  return max(vector, vec4f(value));\n"
        "}\n"
    )


def translate_types(source: str) -> str:
    declaration_pattern = re.compile(
        r"\b(vec2|vec3|vec4|ivec2|float|int)\s+([A-Za-z_][A-Za-z0-9_]*)\s*="
    )
    source = declaration_pattern.sub(
        lambda match: f"var {match.group(2)}: {TYPE_NAMES[match.group(1)]} =",
        source,
    )
    source = re.sub(r"\bmat4\b", "mat4x4f", source)
    for glsl_type, wgsl_type in TYPE_NAMES.items():
        source = re.sub(rf"\b{glsl_type}\b", wgsl_type, source)
    return source


def translate_conv_direct(body: str, bindings: tuple[str, ...], description: str, workgroup: int = 8) -> tuple[str, int]:
    """Non-tiled 3x3 convolution: clamped direct reads, matching the vendor
    semantics without the shared-memory halo. Used to isolate the value of the
    fused residual output pass from the value of tiling."""
    slot_of = {name: index for index, name in enumerate(bindings)}
    translated = expand_macros(body)
    for slot, name in enumerate(bindings):
        translated = re.sub(rf"\b{re.escape(name)}_texOff\s*\(", f"load_{slot}(pixel, ", translated)
    if translated.count("vec4 hook()") != 1:
        raise RuntimeError(f"{description}: expected one vec4 hook()")
    translated = re.sub(r"\bvec4\s+hook\s*\(\s*\)", "fn model(pixel: vec2i) -> vec4f", translated)
    unresolved = sorted(set(re.findall(r"\b[A-Za-z_]\w*_(?:tex|texOff|pos|pt|size)\b", translated)))
    if unresolved:
        raise RuntimeError(f"{description}: unsupported resource helpers: {', '.join(unresolved)}")
    translated = translate_types(translated)
    declarations = [f"@group(0) @binding({slot}) var input_{slot}: texture_2d<f32>;" for slot in range(len(bindings))]
    loaders = [
        "\n".join([
            f"fn load_{slot}(pixel: vec2i, offset: vec2f) -> vec4f {{",
            f"  let maximum = vec2i(textureDimensions(input_{slot})) - vec2i(1);",
            "  return textureLoad(input_"
            f"{slot}, clamp(pixel + vec2i(offset), vec2i(0), maximum), 0);",
            "}",
        ])
        for slot in range(len(bindings))
    ]
    return "\n".join([
        f"// {description}",
        *declarations,
        f"@group(0) @binding({len(bindings)}) var output_texture: texture_storage_2d<rgba16float, write>;",
        "",
        *loaders,
        "",
        translated.strip(),
        "",
        "@compute",
        f"@workgroup_size({workgroup}, {workgroup})",
        "fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {",
        "  let dimensions = textureDimensions(output_texture);",
        "  if (pixel.x >= dimensions.x || pixel.y >= dimensions.y) { return; }",
        "  textureStore(output_texture, pixel.xy, model(vec2i(pixel.xy)));",
        "}",
        "",
    ]), workgroup


def translate_pixel_hook(body: str, bindings: tuple[str, ...], description: str) -> str:
    """Non-tiled per-pixel translation for the 1x1 output projection."""
    slot_of = {name: index for index, name in enumerate(bindings)}
    translated = expand_macros(body)
    if translated.count("vec4 hook()") != 1:
        raise RuntimeError(f"{description}: expected one vec4 hook()")
    translated = re.sub(r"\bvec4\s+hook\s*\(\s*\)", "fn model(pixel: vec2i) -> vec4f", translated)

    def direct(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in slot_of:
            raise RuntimeError(f"{description}: unknown resource {name}")
        return f"textureLoad(input_{slot_of[name]}, pixel, 0)"

    translated = re.sub(r"\b([A-Za-z_]\w*)_tex\s*\(\s*\1_pos\s*\)", direct, translated)
    unresolved = sorted(set(re.findall(r"\b[A-Za-z_]\w*_(?:tex|texOff|pos|pt|size)\b", translated)))
    if unresolved:
        raise RuntimeError(f"{description}: unsupported resource helpers: {', '.join(unresolved)}")
    translated = translate_types(translated)
    declarations = [f"@group(0) @binding({slot}) var input_{slot}: texture_2d<f32>;" for slot in range(len(bindings))]
    return "\n".join([
        f"// {description}",
        *declarations,
        f"@group(0) @binding({len(bindings)}) var output_texture: texture_storage_2d<rgba16float, write>;",
        "",
        translated.strip(),
        "",
        "@compute",
        "@workgroup_size(8, 8)",
        "fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {",
        "  let dimensions = textureDimensions(output_texture);",
        "  if (pixel.x >= dimensions.x || pixel.y >= dimensions.y) { return; }",
        "  textureStore(output_texture, pixel.xy, model(vec2i(pixel.xy)));",
        "}",
        "",
    ])


def is_depth_to_space(shader_pass) -> bool:
    return tuple(shader_pass.width_rpn)[-2:] == ("2", "*") and tuple(shader_pass.height_rpn)[-2:] == ("2", "*")


def build_models(ext, translation: str, args_wg: int = 8) -> dict[str, object]:
    gen = load_module(NATIVE_GENERATOR, "anime4k_native_generator")
    models: dict[str, object] = {}
    for class_name, model_id, relative in MODEL_SPECS:
        source_path = VENDOR / relative
        source_bytes = source_path.read_bytes()
        passes = gen.parse_shader_passes(source_bytes.decode("utf-8"), relative)
        generated_passes: list[dict[str, object]] = []
        pixel_shuffle_sources: list[str] | None = None
        for index, shader_pass in enumerate(passes):
            if is_depth_to_space(shader_pass):
                if index != len(passes) - 1:
                    raise RuntimeError(f"{relative}: depth-to-space must be the final pass")
                pixel_shuffle_sources = [name for name in shader_pass.bindings if name != "MAIN"]
                continue
            is_conv = False
            if translation == "direct":
                try:
                    wgsl, workgroup_size = translate_conv_direct(
                        shader_pass.body, shader_pass.bindings, shader_pass.description, workgroup=args_wg,
                    )
                    wgsl = f"// anime4k-direct:v1\n{wgsl_compat(wgsl)}"
                    kind = "conv"
                    is_conv = True
                except Exception:
                    is_conv = False
            if not is_conv:
                expanded = expand_macros(shader_pass.body)
                try:
                    wgsl, workgroup_size = ext.translate_hook(expanded, shader_pass.bindings, shader_pass.description)
                    wgsl = f"// anime4k-tiled:v1\n{wgsl_compat(wgsl)}"
                    kind = "tiled"
                except Exception:
                    wgsl = translate_pixel_hook(shader_pass.body, shader_pass.bindings, shader_pass.description)
                    wgsl = f"// anime4k-pixel:v1\n{wgsl_compat(wgsl)}"
                    workgroup_size = 8
                    kind = "pixel"
            generated_passes.append({
                "description": shader_pass.description,
                "bindings": list(shader_pass.bindings),
                "output": shader_pass.save or "MAIN",
                "wgsl": wgsl,
                "workgroupSize": workgroup_size,
                "kind": kind,
            })
        models[class_name] = {
            "className": class_name,
            "id": model_id,
            "source": relative,
            "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
            "passes": generated_passes,
            "pixelShuffleSources": pixel_shuffle_sources,
        }
    return models


def render_typescript(models: dict[str, object]) -> str:
    encoded = json.dumps(models, indent=2, ensure_ascii=False)
    return f"""/*
 * Generated by scripts/generate-anime4k-webgpu-models.py from the pinned
 * official Anime4K MIT GLSL. Do not edit weights by hand.
 */
export interface Anime4KWebgpuPassDefinition {{
  readonly description: string;
  readonly bindings: readonly string[];
  readonly output: string;
  readonly wgsl: string;
  readonly workgroupSize: number;
  readonly kind: 'tiled' | 'pixel' | 'conv';
}}

export interface Anime4KWebgpuModelDefinition {{
  readonly className: string;
  readonly id: string;
  readonly source: string;
  readonly sourceSha256: string;
  readonly passes: readonly Anime4KWebgpuPassDefinition[];
  readonly pixelShuffleSources: readonly string[] | null;
}}

export const GENERATED_ANIME4K_WEBGPU_MODELS = {encoded} as const satisfies
  Record<string, Anime4KWebgpuModelDefinition>;
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--translation", choices=("tiled", "direct"), default="direct")
    parser.add_argument("--wg", type=int, default=8)
    args = parser.parse_args()
    ext = load_module(EXTERNAL_GENERATOR, "anime4k_external_generator")
    content = render_typescript(build_models(ext, args.translation, args.wg))
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != content:
            print(f"generated Anime4K WebGPU models are stale: {OUTPUT}", file=sys.stderr)
            return 1
        print("generated Anime4K WebGPU models are current")
        return 0
    OUTPUT.write_text(content, encoding="utf-8", newline="\n")
    print(f"generated {len(MODEL_SPECS)} Anime4K WebGPU model graphs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
