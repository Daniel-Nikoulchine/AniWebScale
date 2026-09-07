#!/usr/bin/env bash
# Installs the AniWebScale Linux ncnn-Vulkan native host for Firefox-based
# browsers (Zen, Firefox): writes the native-messaging manifest pointing at
# the built host binary and smoke-tests the hello/ready handshake.
#
# Usage: bash native/scripts/install-linux-host.sh [--system]
#   default: per-user (~/.mozilla + ~/.zen); --system: /usr/lib/mozilla (sudo).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST_BIN="$REPO_ROOT/native/linux-host/build/aniwebscale-ncnn-host"
IDENTITIES="$REPO_ROOT/native/extension-identities.json"
HOST_NAME="$(python3 -c "import json; print(json.load(open('$IDENTITIES'))['nativeHostName'])")"
FIREFOX_ID="$(python3 -c "import json; print(json.load(open('$IDENTITIES'))['firefoxExtensionId'])")"

if [[ ! -x "$HOST_BIN" ]]; then
  echo "error: host binary missing or not executable: $HOST_BIN" >&2
  echo "build it first (cmake --build native/linux-host/build)." >&2
  exit 1
fi

write_manifest() {
  local dir="$1"
  mkdir -p "$dir"
  local file="$dir/$HOST_NAME.json"
  python3 - "$file" <<EOF
import json
manifest = {
    "name": "$HOST_NAME",
    "description": "AniWebScale Linux ncnn-Vulkan RealESRGAN",
    "path": "$HOST_BIN",
    "type": "stdio",
    "allowed_extensions": ["$FIREFOX_ID"],
}
with open("$file", "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)
    handle.write("\n")
EOF
  echo "wrote $file"
}

if [[ "${1:-}" == "--system" ]]; then
  write_manifest "/usr/lib/mozilla/native-messaging-hosts"
else
  write_manifest "$HOME/.mozilla/native-messaging-hosts"
  write_manifest "$HOME/.zen/native-messaging-hosts"
fi

echo "smoke test: hello/ready handshake..."
python3 - <<'EOF'
import json
import os
import struct
import subprocess
import sys

repo = os.environ.get("REPO_ROOT", ".")
binary = os.path.join(repo, "native/linux-host/build/aniwebscale-ncnn-host")
message = json.dumps({"type": "hello", "protocolVersion": 3, "requestId": "install-smoke"}).encode()
proc = subprocess.Popen(
    [binary], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
)
try:
    proc.stdin.write(struct.pack("<I", len(message)) + message)
    proc.stdin.flush()
    (ready, _, _) = __import__("select").select([proc.stdout], [], [], 60)
    if not ready:
        print("error: no reply within 60s (cold Vulkan init can take a while on first run)")
        sys.exit(1)
    (length,) = struct.unpack("<I", proc.stdout.read(4))
    reply = json.loads(proc.stdout.read(length).decode())
    assert reply.get("type") == "ready", reply
    assert reply.get("httpPort", 0) > 0 and reply.get("httpToken"), reply
    print(f"host OK: ready on 127.0.0.1:{reply['httpPort']}")
finally:
    proc.terminate()
EOF

echo "done. Load dist-firefox in Zen (or install the .xpi) and check the overlay path."
