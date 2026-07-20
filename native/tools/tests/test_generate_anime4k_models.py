from __future__ import annotations

import importlib.util
import dataclasses
import hashlib
import json
from pathlib import Path
import sys
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "generate_anime4k_models.py"
SPEC = importlib.util.spec_from_file_location("anime4k_generator", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
generator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = generator
SPEC.loader.exec_module(generator)


class GeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.files, cls.manifest = generator.build_outputs()

    def test_all_official_effect_variants_are_present(self) -> None:
        variants = self.manifest["effect_variants"]
        self.assertEqual(15, len(variants))
        self.assertEqual(
            {
                (family, quality)
                for family in ("restore", "restore_soft", "upscale", "denoise_upscale")
                for quality in ("M", "VL", "UL")
            }
            | {
                ("artcnn", "realtime"),
                ("acnet", "realtime"),
                ("arnet", "realtime"),
            },
            {(variant["family"], variant["quality"]) for variant in variants},
        )
        self.assertEqual(286, self.manifest["counts"]["compute_passes"])

    def test_all_30_presets_reference_real_effects(self) -> None:
        available = {effect["id"] for effect in self.manifest["effect_variants"]}
        available.update(effect["id"] for effect in self.manifest["shared_effects"])
        presets = self.manifest["presets"]
        self.assertEqual(30, len(presets))
        self.assertEqual(30, len({preset["id"] for preset in presets}))
        for preset in presets:
            self.assertTrue(set(preset["effects"]).issubset(available))

    def test_ai_upscale_presets_use_the_exact_native_models(self) -> None:
        presets = {
            (preset["mode"], preset["quality"]): preset
            for preset in self.manifest["presets"]
        }
        for quality in ("M", "VL", "UL"):
            self.assertEqual(
                [f"upscale_{quality.lower()}"],
                presets[("CNNX2", quality)]["effects"],
            )
            self.assertEqual(["artcnn_c4f16"], presets[("ARTCNN", quality)]["effects"])
            self.assertEqual(["acnet_f8b4"], presets[("ACNET", quality)]["effects"])
            self.assertEqual(["arnet_f8b8"], presets[("ARNET", quality)]["effects"])

    def test_presets_are_generated_from_the_canonical_cross_backend_graph(self) -> None:
        encoded = generator.PRESET_GRAPH_PATH.read_bytes()
        graph = json.loads(encoded.decode("utf-8"))
        self.assertEqual(
            hashlib.sha256(encoded).hexdigest(),
            self.manifest["preset_graph"]["sha256"],
        )
        self.assertEqual("preset-graph.json", self.manifest["preset_graph"]["path"])
        expected = {
            f"{mode}_{quality}": steps
            for mode, steps in graph["modes"].items()
            for quality in graph["qualities"]
        }
        step_to_family = {
            "ClampHighlights": "clamp",
            "Restore": "restore",
            "RestoreSoft": "restore_soft",
            "Upscale": "upscale",
            "DenoiseUpscale": "denoise_upscale",
        }
        actual = {}
        canonical_modes = set(graph["modes"])
        for preset in self.manifest["presets"]:
            if preset["mode"] not in canonical_modes:
                continue
            quality = preset["quality"].lower()
            actual[preset["id"]] = [
                "clamp" if effect == "clamp" else effect.removesuffix(f"_{quality}")
                for effect in preset["effects"]
            ]
        self.assertEqual(
            {
                preset_id: [step_to_family[step] for step in steps]
                for preset_id, steps in expected.items()
            },
            actual,
        )

    def test_generated_shaders_have_complete_sm5_bindings(self) -> None:
        hlsl_files = {
            path.as_posix(): content
            for path, content in self.files.items()
            if path.suffix == ".hlsl"
        }
        self.assertEqual(286, len(hlsl_files))
        for effect in self.manifest["shared_effects"] + self.manifest["effect_variants"]:
            for shader_pass in effect["passes"]:
                source = hlsl_files[shader_pass["shader"]]
                self.assertIn("RWTexture2D<float4> Anime4KOutput : register(u0);", source)
                self.assertIn("uint3 dispatchThreadId : SV_DispatchThreadID", source)
                self.assertNotRegex(source, r"\b(?:mat4|vec[234]|ivec2|fract)\b")
                for binding in shader_pass["bindings"]:
                    slot = binding["srv_slot"]
                    self.assertIn(
                        f"Texture2D<float4> Anime4KInput{slot} : register(t{slot});",
                        source,
                    )

    def test_glsl_matrix_order_is_explicitly_translated(self) -> None:
        source = self.files[Path("hlsl/restore_m/pass_000.hlsl")]
        self.assertIn("mul(go_0(-1.0, -1.0), float4x4(", source)
        self.assertNotIn("mat4(", source)

    def test_cnn_keeps_f32_math_and_uses_integer_texoff_loads(self) -> None:
        source = self.files[Path("hlsl/restore_ul/pass_006.hlsl")]
        self.assertNotIn("min16float", source)
        self.assertIn("float4x4(", source)
        self.assertIn("Anime4KInput0.Load(int3(source_position, 0))", source)
        self.assertIn("Anime4KLoadOffset0(anime4k_output_pixel, offset)", source)

    def test_same_size_current_texel_uses_load_but_depth_to_space_does_not(self) -> None:
        one_by_one = self.files[Path("hlsl/restore_ul/pass_024.hlsl")]
        self.assertIn("_texCurrent", one_by_one)
        self.assertIn("Anime4KLoadCurrent", one_by_one)

        depth_to_space = self.files[Path("hlsl/upscale_ul/pass_024.hlsl")]
        self.assertIn("MAIN_tex(MAIN_pos)", depth_to_space)
        self.assertEqual(1, depth_to_space.count("MAIN_texCurrent"))
        self.assertIn("Anime4KSample0", depth_to_space)

    def test_texoff_uses_normalized_sampling_when_dimensions_differ(self) -> None:
        source = (generator.VENDORED_ROOT / generator.MODEL_SPECS[0].source).read_text(
            encoding="utf-8"
        )
        shader_passes = generator.parse_shader_passes(
            source, generator.MODEL_SPECS[0].source
        )
        self.assertIn("_texOff", shader_passes[0].body)
        invalid = dataclasses.replace(
            shader_passes[0],
            width_rpn=(shader_passes[0].width_rpn[0], "2", "*"),
        )
        plans = generator.build_sampling_plans(
            generator.MODEL_SPECS[0], [invalid, *shader_passes[1:]]
        )
        self.assertNotIn("MAIN", plans[0].texoff_integer_loads)
        hlsl, _ = generator.generate_hlsl(
            generator.MODEL_SPECS[0], 0, invalid, plans[0]
        )
        self.assertIn(
            "#define MAIN_texOff(offset) Anime4KSampleOffset0(anime4k_pos, offset)",
            hlsl,
        )

    def test_texoff_dimension_proof_follows_saved_resources_across_passes(self) -> None:
        source = (generator.VENDORED_ROOT / generator.CLAMP_SPEC.source).read_text(
            encoding="utf-8"
        )
        shader_passes = generator.parse_shader_passes(
            source, generator.CLAMP_SPEC.source
        )
        # Clamp pass 1 outputs at HOOKED dimensions but samples STATSMAX,
        # whose equal dimensions were established by the preceding SAVE.
        self.assertIn("STATSMAX_texOff", shader_passes[1].body)
        generator.validate_model_texoff_load_dimensions(
            generator.CLAMP_SPEC, shader_passes
        )

    def test_clamp_main_alias_reuses_hooked_slot(self) -> None:
        first_pass = self.manifest["shared_effects"][0]["passes"][0]
        self.assertEqual([{"logical_resource": "HOOKED", "srv_slot": 0}], first_pass["bindings"])
        self.assertEqual({"MAIN": 0}, first_pass["aliases"])

    def test_source_hashes_ignore_platform_line_endings(self) -> None:
        lf = "//!DESC Example\n//!HOOK MAIN\n"
        crlf = lf.replace("\n", "\r\n")
        legacy_cr = lf.replace("\n", "\r")
        self.assertEqual(lf, generator.normalize_source_newlines(crlf))
        self.assertEqual(lf, generator.normalize_source_newlines(legacy_cr))
        self.assertEqual(
            generator.sha256_text(lf),
            generator.sha256_text(generator.normalize_source_newlines(crlf)),
        )

    def test_generation_is_deterministic_and_manifest_hashes_match(self) -> None:
        second_files, second_manifest = generator.build_outputs()
        self.assertEqual(self.files, second_files)
        self.assertEqual(self.manifest, second_manifest)
        parsed = json.loads(self.files[Path("manifest.json")])
        self.assertEqual(self.manifest, parsed)
        for effect in parsed["shared_effects"] + parsed["effect_variants"]:
            for shader_pass in effect["passes"]:
                content = self.files[Path(shader_pass["shader"])]
                self.assertEqual(generator.sha256_text(content), shader_pass["hlsl_sha256"])

    def test_generated_package_carries_upstream_license(self) -> None:
        license_text = self.files[Path("ANIME4K_LICENSE.txt")]
        self.assertIn("MIT License", license_text)
        self.assertIn("Copyright (c) 2019 bloc97", license_text)
        self.assertEqual("ANIME4K_LICENSE.txt", self.manifest["anime4k_license_file"])


if __name__ == "__main__":
    unittest.main()
