#!/usr/bin/env python3
"""Generate WebGPU kernels from the pinned ArtCNN and ACNetGLSL mpv shaders."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "shared" / "generated-external-glsl-models.ts"
NATIVE_GENERATOR = ROOT / "native" / "tools" / "generate_anime4k_models.py"

MODEL_SPECS = (
    {
        "className": "ArtCNNX2",
        "id": "artcnn-c4f16-x2",
        "displayName": "ArtCNN C4F16 x2",
        "source": ROOT / "native" / "third_party" / "artcnn" / "glsl" / "ArtCNN_C4F16.glsl",
        "upstream": "https://github.com/Artoriuz/ArtCNN",
    },
    {
        "className": "ACNetX2",
        "id": "acnet-f8b4-x2",
        "displayName": "ACNet F8B4 x2",
        "source": ROOT / "native" / "third_party" / "acnetglsl" / "glsl" / "acnet" / "acnet_f8b4.glsl",
        "upstream": "https://github.com/TianZerL/ACNetGLSL",
    },
    {
        "className": "ARNetX2",
        "id": "arnet-f8b8-x2",
        "displayName": "ARNet F8B8 x2",
        "source": ROOT / "native" / "third_party" / "acnetglsl" / "glsl" / "arnet" / "arnet_f8b8.glsl",
        "upstream": "https://github.com/TianZerL/ACNetGLSL",
    },
)


def load_native_generator():
    spec = importlib.util.spec_from_file_location("anime4k_native_generator", NATIVE_GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {NATIVE_GENERATOR}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def translate_hook(body: str, bindings: tuple[str, ...], description: str) -> str:
    translated = body
    translated, hook_count = re.subn(
        r"\bvec4\s+hook\s*\(\s*\)",
        "fn model(pixel: vec2i) -> vec4f",
        translated,
    )
    if hook_count != 1:
        raise RuntimeError(f"{description}: expected one vec4 hook()")

    for slot, resource in enumerate(bindings):
        translated = re.sub(
            rf"\b{re.escape(resource)}_texOff\s*\(",
            f"load_{slot}(pixel, ",
            translated,
        )

    unresolved = sorted(set(re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*_(?:tex|texOff|pos|pt|size)\b", translated)))
    if unresolved:
        raise RuntimeError(f"{description}: unsupported resource helpers: {', '.join(unresolved)}")

    type_names = {
        "vec2": "vec2f",
        "vec3": "vec3f",
        "vec4": "vec4f",
        "ivec2": "vec2i",
        "float": "f32",
        "int": "i32",
    }
    declaration_pattern = re.compile(
        r"\b(vec2|vec3|vec4|ivec2|float|int)\s+([A-Za-z_][A-Za-z0-9_]*)\s*="
    )
    translated = declaration_pattern.sub(
        lambda match: f"var {match.group(2)}: {type_names[match.group(1)]} =",
        translated,
    )
    translated = re.sub(r"\bmat4\b", "mat4x4f", translated)
    for glsl_type, wgsl_type in type_names.items():
        translated = re.sub(rf"\b{glsl_type}\b", wgsl_type, translated)

    declarations = []
    helpers = []
    for slot in range(len(bindings)):
        declarations.append(f"@group(0) @binding({slot}) var input_{slot}: texture_2d<f32>;")
        helpers.append(
            f"""fn load_{slot}(pixel: vec2i, offset: vec2f) -> vec4f {{
  let maximum = vec2i(textureDimensions(input_{slot})) - vec2i(1);
  return textureLoad(input_{slot}, clamp(pixel + vec2i(offset), vec2i(0), maximum), 0);
}}"""
        )
    output_binding = len(bindings)
    return "\n".join(
        [
            f"// {description}",
            *declarations,
            f"@group(0) @binding({output_binding}) var output_texture: texture_storage_2d<rgba16float, write>;",
            "",
            *helpers,
            "",
            translated.strip(),
            "",
            "@compute",
            "@workgroup_size(8, 8)",
            "fn computeMain(@builtin(global_invocation_id) invocation: vec3u) {",
            "  let dimensions = textureDimensions(output_texture);",
            "  if (invocation.x >= dimensions.x || invocation.y >= dimensions.y) { return; }",
            "  let pixel = vec2i(invocation.xy);",
            "  textureStore(output_texture, invocation.xy, model(pixel));",
            "}",
            "",
        ]
    )


def build_models() -> dict[str, object]:
    generator = load_native_generator()
    models: dict[str, object] = {}
    for raw_spec in MODEL_SPECS:
        source_path = raw_spec["source"]
        source_bytes = source_path.read_bytes()
        source = source_bytes.decode("utf-8")
        relative_source = source_path.relative_to(ROOT).as_posix()
        passes = generator.parse_shader_passes(source, relative_source)
        if len(passes) < 2:
            raise RuntimeError(f"{relative_source}: model needs at least two passes")
        final = passes[-1]
        if len(final.bindings) != 1 or final.save is not None:
            raise RuntimeError(f"{relative_source}: expected a one-texture pixel-shuffle tail")
        if tuple(final.width_rpn[-2:]) != ("2", "*") and tuple(final.width_rpn[-2:]) != ("2.0", "*"):
            raise RuntimeError(f"{relative_source}: final pass is not a 2x pixel shuffle")

        generated_passes = []
        for index, shader_pass in enumerate(passes[:-1]):
            if shader_pass.save is None:
                raise RuntimeError(f"{relative_source}: pass {index} does not save a logical resource")
            generated_passes.append(
                {
                    "description": shader_pass.description,
                    "bindings": list(shader_pass.bindings),
                    "output": shader_pass.save,
                    "wgsl": translate_hook(shader_pass.body, shader_pass.bindings, shader_pass.description),
                }
            )

        class_name = raw_spec["className"]
        models[class_name] = {
            "className": class_name,
            "id": raw_spec["id"],
            "displayName": raw_spec["displayName"],
            "source": relative_source,
            "upstream": raw_spec["upstream"],
            "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
            "scale": 2,
            "passes": generated_passes,
            "pixelShuffleSource": final.bindings[0],
        }
    return models


def render_typescript(models: dict[str, object]) -> str:
    encoded = json.dumps(models, indent=2, ensure_ascii=False)
    return f"""/*
 * Generated by scripts/generate-external-glsl-models.py from pinned MIT mpv GLSL.
 * Do not edit weights by hand.
 */
export interface ExternalGlslPassDefinition {{
  readonly description: string;
  readonly bindings: readonly string[];
  readonly output: string;
  readonly wgsl: string;
}}

export interface ExternalGlslModelDefinition {{
  readonly className: 'ArtCNNX2' | 'ACNetX2' | 'ARNetX2';
  readonly id: string;
  readonly displayName: string;
  readonly source: string;
  readonly upstream: string;
  readonly sourceSha256: string;
  readonly scale: 2;
  readonly passes: readonly ExternalGlslPassDefinition[];
  readonly pixelShuffleSource: string;
}}

export const GENERATED_EXTERNAL_GLSL_MODELS = {encoded} as const satisfies
  Record<ExternalGlslModelDefinition['className'], ExternalGlslModelDefinition>;
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = render_typescript(build_models())
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != content:
            print(f"generated external GLSL models are stale: {OUTPUT}", file=sys.stderr)
            return 1
        print("generated external GLSL models are current")
        return 0
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != content:
        OUTPUT.write_text(content, encoding="utf-8", newline="\n")
    print(f"generated {len(MODEL_SPECS)} external GLSL model graphs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
