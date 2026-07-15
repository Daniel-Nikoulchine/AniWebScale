from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import shutil
import sys
import unittest
import uuid


SCRIPT = Path(__file__).resolve().parents[1] / "pack_anime4k_models.py"
SPEC = importlib.util.spec_from_file_location("anime4k_packer", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
packer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = packer
SPEC.loader.exec_module(packer)

REPOSITORY_TMP = Path(__file__).resolve().parents[3] / ".tmp"


def make_pass(pass_id: str, output: str, *, when: list[str] | None = None) -> dict[str, object]:
    return {
        "id": pass_id,
        "bindings": [{"logical_resource": "MAIN", "srv_slot": 0}],
        "output": {
            "logical_resource": output,
            "width_rpn": ["MAIN.w"],
            "height_rpn": ["MAIN.h"],
            "replaces_bound_resource": output == "MAIN",
        },
        "when_rpn": when or [],
    }


def make_manifest() -> dict[str, object]:
    return {
        "schema_version": 1,
        "shared_effects": [
            {
                "id": "clamp",
                "family": "clamp",
                "passes": [make_pass("clamp.pass_000", "HOOKED")],
            }
        ],
        "effect_variants": [
            {
                "id": "upscale_m",
                "family": "upscale",
                "passes": [
                    make_pass(
                        "upscale_m.pass_000",
                        "MAIN",
                        when=["OUTPUT.w", "MAIN.w", "/", "1.200", ">"],
                    )
                ],
            }
        ],
        "presets": [
            {
                "id": "A_M",
                "mode": "A",
                "quality": "M",
                "effects": ["clamp", "upscale_m"],
            }
        ],
    }


class PackerTests(unittest.TestCase):
    def setUp(self) -> None:
        REPOSITORY_TMP.mkdir(parents=True, exist_ok=True)
        self.temporary = REPOSITORY_TMP / f"packer-test-{uuid.uuid4().hex}"
        self.temporary.mkdir()
        self.manifest_path = self.temporary / "manifest.json"
        self.map_path = self.temporary / "cso-map.json"
        self.output_path = self.temporary / "anime4k_model_package.cpp"
        self.manifest_path.write_text(json.dumps(make_manifest()), encoding="utf-8")
        self.bytecode_paths: dict[str, Path] = {}
        for index, pass_id in enumerate(("clamp.pass_000", "upscale_m.pass_000")):
            path = self.temporary / f"shader-{index}.cso"
            path.write_bytes(b"DXBC" + bytes([index]) * 28)
            self.bytecode_paths[pass_id] = path
        self.write_map(self.bytecode_paths)

    def tearDown(self) -> None:
        shutil.rmtree(self.temporary)

    def write_map(self, entries: dict[str, Path]) -> None:
        value = {
            "schema_version": 1,
            "passes": {
                pass_id: path.relative_to(self.temporary).as_posix()
                for pass_id, path in entries.items()
            },
        }
        self.map_path.write_text(json.dumps(value), encoding="utf-8")

    def test_packs_fixed_model_package_abi(self) -> None:
        generated = packer.pack(self.manifest_path, self.map_path, self.output_path)
        self.assertEqual(generated.encode("utf-8"), self.output_path.read_bytes())
        self.assertIn('#include "anime4k/model_package.hpp"', generated)
        self.assertIn("namespace anime4k::models {", generated)
        self.assertIn("constexpr Binding kBindings0000[]", generated)
        self.assertIn('"clamp.pass_000"', generated)
        self.assertIn('"upscale_m.pass_000"', generated)
        self.assertIn("std::span<const Effect> effects() noexcept", generated)
        self.assertIn("std::span<const Preset> presets() noexcept", generated)
        self.assertIn("const Effect* find_effect(std::string_view id) noexcept", generated)
        self.assertIn(
            "const Preset* find_preset(std::string_view mode, std::string_view quality) noexcept",
            generated,
        )
        self.assertIn("0x44, 0x58, 0x42, 0x43", generated)
        self.assertIn("nullptr,\n        0u,", generated)

    def test_output_is_deterministic_and_not_rewritten(self) -> None:
        first = packer.pack(self.manifest_path, self.map_path, self.output_path)
        initial_stat = self.output_path.stat()
        second = packer.pack(self.manifest_path, self.map_path, self.output_path)
        final_stat = self.output_path.stat()
        self.assertEqual(first, second)
        self.assertEqual(initial_stat.st_mtime_ns, final_stat.st_mtime_ns)

    def test_rejects_incomplete_or_extra_cso_map(self) -> None:
        self.write_map({"clamp.pass_000": self.bytecode_paths["clamp.pass_000"]})
        with self.assertRaisesRegex(packer.PackingError, "coverage mismatch"):
            packer.pack(self.manifest_path, self.map_path, self.output_path)

        extra = dict(self.bytecode_paths)
        extra["unknown.pass_000"] = self.bytecode_paths["clamp.pass_000"]
        self.write_map(extra)
        with self.assertRaisesRegex(packer.PackingError, "coverage mismatch"):
            packer.pack(self.manifest_path, self.map_path, self.output_path)

    def test_rejects_non_dxbc_input(self) -> None:
        self.bytecode_paths["clamp.pass_000"].write_bytes(b"not a shader")
        with self.assertRaisesRegex(packer.PackingError, "not a valid DXBC"):
            packer.pack(self.manifest_path, self.map_path, self.output_path)


if __name__ == "__main__":
    unittest.main()
