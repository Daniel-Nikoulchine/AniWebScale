#!/usr/bin/env python3
"""Regression test for the real NativeHost -> named pipe -> Renderer round trip."""

from __future__ import annotations

import argparse
import json
import pathlib
import struct
import subprocess
import threading


CALLER = "chrome-extension://dlomjcbmgkfaebhplgoihbjfclaagike/"


def read_exact(stream, size: int) -> bytes:
    chunks: list[bytes] = []
    remaining = size
    while remaining:
        chunk = stream.read(remaining)
        if not chunk:
            raise RuntimeError(f"native host closed with {remaining} byte(s) still expected")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def read_message(stream) -> dict[str, object]:
    (length,) = struct.unpack("<I", read_exact(stream, 4))
    if length <= 0 or length > 1024 * 1024:
        raise RuntimeError(f"invalid native response length: {length}")
    return json.loads(read_exact(stream, length).decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True, type=pathlib.Path)
    arguments = parser.parse_args()
    host = arguments.host.resolve()
    if not host.is_file():
        raise RuntimeError(f"native host does not exist: {host}")
    if not (host.parent / "Anime4K.Renderer.exe").is_file():
        raise RuntimeError("renderer is not beside native host")
    if not (host.parent / "native-host-allowlist.json").is_file():
        raise RuntimeError("caller allowlist is not beside native host")

    process = subprocess.Popen(
        [str(host), CALLER],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None
    assert process.stdout is not None
    request = json.dumps(
        {"type": "hello", "protocolVersion": 3, "requestId": "ctest-handshake"},
        separators=(",", ":"),
    ).encode("utf-8")
    process.stdin.write(struct.pack("<I", len(request)) + request)
    process.stdin.flush()

    result: list[dict[str, object]] = []
    failure: list[BaseException] = []

    def receive() -> None:
        try:
            result.append(read_message(process.stdout))
        except BaseException as exception:  # propagate from worker after timeout handling
            failure.append(exception)

    reader = threading.Thread(target=receive, daemon=True)
    reader.start()
    reader.join(5.0)
    if reader.is_alive():
        process.kill()
        reader.join(2.0)
        raise RuntimeError("native host handshake timed out")
    if failure:
        process.kill()
        raise failure[0]
    expected = {"type": "ready", "protocolVersion": 3, "requestId": "ctest-handshake"}
    if result != [expected]:
        process.kill()
        raise RuntimeError(f"unexpected handshake response: {result!r}")

    process.stdin.close()
    exit_code = process.wait(timeout=5.0)
    if exit_code != 0:
        stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
        raise RuntimeError(f"native host exited with {exit_code}: {stderr}")

    rejected = subprocess.run(
        [str(host), "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/"],
        input=b"",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=5.0,
        check=False,
    )
    if rejected.returncode != 10 or rejected.stdout:
        raise RuntimeError(f"unauthorized caller was not rejected cleanly: exit={rejected.returncode}")
    print("NativeHost/Renderer framed handshake passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
