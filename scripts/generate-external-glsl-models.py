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


def choose_workgroup_size(input_count: int) -> int:
    """Pick the largest workgroup whose 3x3 tiling halo fits the WebGPU
    maxComputeWorkgroupStorageSize budget (16384 bytes): (WG+2)^2 tiles of
    16 bytes (vec4f f32) per input texture."""
    if input_count <= 3:
        return 16  # 18x18 = 324 entries -> 5184 B/input
    if input_count <= 5:
        return 12  # 14x14 = 196 entries -> 3136 B/input
    if input_count <= 10:
        return 8  # 10x10 = 100 entries -> 1600 B/input
    raise RuntimeError(f"no workgroup size fits {input_count} tiled inputs")


def translate_hook(body: str, bindings: tuple[str, ...], description: str) -> tuple[str, int]:
    """Translate one GLSL pass into a tiled WGSL compute pass.

    Returns (wgsl, workgroup_size). Every 3x3 convolution is turned into a
    shared-memory tiled pass: each workgroup stages its WG+2 halo block once
    into `var<workgroup>` tiles, so the 9 taps per output pixel read from
    shared memory instead of issuing 9 (x N inputs) global texture loads.
    The output matches the non-tiled kernel bit-for-bit: same clamped
    textureLoad values, same accumulation order in model().
    """
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

    input_count = len(bindings)
    workgroup_size = choose_workgroup_size(input_count)
    tile = workgroup_size + 2
    tile_count = tile * tile
    threads = workgroup_size * workgroup_size

    declarations = [f"@group(0) @binding({slot}) var input_{slot}: texture_2d<f32>;" for slot in range(input_count)]
    shared_tiles = [f"var<workgroup> tile_{slot}: array<vec4f, {tile_count}>;" for slot in range(input_count)]
    tile_loader = f"""fn loadTile(tex: texture_2d<f32>, origin: vec2i, maximum: vec2i, linear: i32) -> vec4f {{
  let coord = vec2i(linear % {tile}, linear / {tile});
  return textureLoad(tex, clamp(origin + coord, vec2i(0), maximum), 0);
}}"""
    tap_readers = [
        f"""fn load_{slot}(pixel: vec2i, offset: vec2f) -> vec4f {{
  let local = pixel - origin + vec2i(offset);
  return tile_{slot}[local.y * {tile} + local.x];
}}"""
        for slot in range(input_count)
    ]

    compute_lines = [
        "var<private> origin: vec2i;",
        "@compute",
        f"@workgroup_size({workgroup_size}, {workgroup_size})",
        "fn computeMain(",
        "  @builtin(global_invocation_id) invocation: vec3u,",
        "  @builtin(local_invocation_id) local: vec3u,",
        ") {",
        "  let dimensions = textureDimensions(output_texture);",
        # The halo origin is one texel before the workgroup block; the
        # clamp in loadTile makes the negative edge a clamped border read,
        # identical to the per-tap clamped textureLoad it replaces.
        f"  origin = vec2i(invocation.xy / {workgroup_size}u) * {workgroup_size} - 1;",
        f"  let tid = i32(local.x) + i32(local.y) * {workgroup_size};",
    ]
    for slot in range(input_count):
        # Each textureDimensions is hoisted once per workgroup instead of
        # once per tap per pixel (9 x input-count reads per pixel before).
        compute_lines.append(f"  let maximum_{slot} = vec2i(textureDimensions(input_{slot})) - vec2i(1);")
        compute_lines.append(
            f"  if (tid < {tile_count}) {{ tile_{slot}[tid] = loadTile(input_{slot}, origin, maximum_{slot}, tid); }}"
        )
        compute_lines.append(
            f"  if (tid + {threads} < {tile_count}) {{ tile_{slot}[tid + {threads}] = loadTile(input_{slot}, origin, maximum_{slot}, tid + {threads}); }}"
        )
    compute_lines.extend([
        "  workgroupBarrier();",
        # The bounds check runs after the barrier so every invocation of a
        # partially out-of-bounds workgroup still reaches the barrier.
        "  if (invocation.x >= dimensions.x || invocation.y >= dimensions.y) { return; }",
        "  let pixel = vec2i(invocation.xy);",
        "  textureStore(output_texture, invocation.xy, model(pixel));",
        "}",
    ])

    output_binding = input_count
    wgsl = "\n".join(
        [
            f"// {description}",
            *declarations,
            f"@group(0) @binding({output_binding}) var output_texture: texture_storage_2d<rgba16float, write>;",
            "",
            *shared_tiles,
            "",
            tile_loader,
            "",
            *tap_readers,
            "",
            translated.strip(),
            "",
            *compute_lines,
            "",
        ]
    )
    return wgsl, workgroup_size


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
            pass_wgsl, pass_workgroup_size = translate_hook(
                shader_pass.body, shader_pass.bindings, shader_pass.description
            )
            generated_passes.append(
                {
                    "description": shader_pass.description,
                    "bindings": list(shader_pass.bindings),
                    "output": shader_pass.save,
                    "wgsl": pass_wgsl,
                    "workgroupSize": pass_workgroup_size,
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
interface ExternalGlslPassDefinition {{
  readonly description: string;
  readonly bindings: readonly string[];
  readonly output: string;
  readonly wgsl: string;
  readonly workgroupSize: number;
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
