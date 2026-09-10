#!/usr/bin/env python3
"""Fetch the pinned ncnn + glslang sources for the ncnn-Vulkan spike.

The ncnn source tree is large and is not checked into the repository. This
script downloads the pinned release tarball, verifies both SHA-256 hashes from
third_party/PINS.json, and unpacks ncnn (including its glslang submodule, which
release tarballs ship as an empty directory) into third_party/ncnn.

Usage: python3 native/spike/fetch-sources.py
"""

from __future__ import annotations

import hashlib
import io
import json
import sys
import tarfile
from pathlib import Path
import urllib.request

HERE = Path(__file__).resolve().parent
PINS = json.loads((HERE / "third_party" / "PINS.json").read_text(encoding="utf-8"))


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str) -> bytes:
    print(f"fetch {url}")
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()


def extract_tar_gz(data: bytes, destination: Path, strip: int = 1) -> None:
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for member in archive.getmembers():
            parts = member.name.split("/", 1)
            if len(parts) != 2:
                continue  # top-level directory entry itself
            member.name = parts[1]
            archive.extract(member, destination)


def main() -> int:
    ncnn_dir = HERE / "third_party" / "ncnn"
    pin = PINS["ncnn"]
    if (ncnn_dir / "CMakeLists.txt").exists():
        print(f"ncnn already present at {ncnn_dir}; delete it to re-fetch")
    else:
        ncnn_tar = fetch(pin["source_tarball"])
        if sha256(ncnn_tar) != pin["sha256"]:
            print("ncnn tarball SHA-256 mismatch", file=sys.stderr)
            return 1
        ncnn_dir.mkdir(parents=True, exist_ok=True)
        extract_tar_gz(ncnn_tar, ncnn_dir)

        glslang_tar = fetch(pin["glslang_tarball"])
        if sha256(glslang_tar) != pin["glslang_sha256"]:
            print("glslang tarball SHA-256 mismatch", file=sys.stderr)
            return 1
        glslang_dir = ncnn_dir / "glslang"
        glslang_dir.mkdir(parents=True, exist_ok=True)
        extract_tar_gz(glslang_tar, glslang_dir)
        print(f"ncnn {pin['tag']} unpacked (glslang {pin['glslang_submodule_commit'][:8]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
