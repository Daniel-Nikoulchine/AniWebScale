#!/usr/bin/env node
/**
 * Build the WASM-SIMD pixel kernels for the RealESRGAN worker (Hebel E5).
 *
 * Runs `cargo build --release --target wasm32-unknown-unknown` in
 * native/wasm-pixels (plain cdylib, no wasm-pack/bindgen: the module owns
 * its memory and talks byte offsets) and copies the artifact to
 * wasm/pixels.wasm, from where webpack ships it verbatim to
 * chunks/pixels.wasm next to the worker.
 *
 * Idempotent via mtime stamps; --check fails CI when stale. When cargo is
 * missing the script keeps a previously built artifact with a loud warning
 * and fails only when no artifact exists at all.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const crateDir = join(repoRoot, 'native', 'wasm-pixels');
const outDir = join(repoRoot, 'wasm');
const outFile = join(outDir, 'pixels.wasm');
const builtWasm = join(
  crateDir, 'target', 'wasm32-unknown-unknown', 'release', 'aniwebscale_pixels.wasm',
);
const sources = [join(crateDir, 'Cargo.toml'), join(crateDir, 'src', 'lib.rs')];

function haveCargo() {
  return spawnSync('cargo', ['--version'], { stdio: 'ignore' }).status === 0;
}

/**
 * The classic fresh-checkout failure is a cargo WITHOUT the wasm target
 * (system toolchains ship host-only std): surface that as an actionable
 * hint instead of a raw rustc dump.
 */
function missingWasmTargetHint() {
  const sysroot = spawnSync('rustc', ['--print', 'sysroot'], { encoding: 'utf8' });
  if (sysroot.status !== 0 || !sysroot.stdout) return '';
  const rustlib = join(sysroot.stdout.trim(), 'lib', 'rustlib', 'wasm32-unknown-unknown');
  return existsSync(rustlib)
    ? ''
    : ' (missing wasm32-unknown-unknown target in this cargo toolchain — run: rustup target add wasm32-unknown-unknown)';
}

function isFresh() {
  if (!existsSync(outFile)) return false;
  const outStat = statSync(outFile);
  return sources.every(source => existsSync(source) && outStat.mtimeMs > statSync(source).mtimeMs);
}

function build() {
  const built = spawnSync(
    'cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown'],
    { cwd: crateDir, stdio: 'inherit' },
  );
  if (built.status !== 0) throw new Error(`cargo build for wasm-pixels failed${missingWasmTargetHint()}`);
  if (!existsSync(builtWasm)) throw new Error(`expected artifact missing: ${builtWasm}`);
  mkdirSync(outDir, { recursive: true });
  copyFileSync(builtWasm, outFile);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--check')) {
    if (!isFresh()) {
      console.error('pixels-wasm --check: wasm/pixels.wasm missing or stale (run npm run generate:pixels-wasm).');
      process.exit(1);
    }
    console.log('pixels-wasm --check: wasm/pixels.wasm fresh.');
    return;
  }
  const force = args.has('--force');
  if (!force && isFresh()) {
    console.log('pixels-wasm: wasm/pixels.wasm fresh, skipped.');
    return;
  }
  if (!haveCargo()) {
    if (existsSync(outFile)) {
      console.warn('pixels-wasm: cargo missing, keeping stale wasm/pixels.wasm.');
      return;
    }
    throw new Error('pixels-wasm: cargo missing and no wasm/pixels.wasm present.');
  }
  build();
  console.log('pixels-wasm: built wasm/pixels.wasm.');
}

const invokedAsScript = typeof process.argv[1] === 'string'
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  await main();
}

export { build, isFresh };
