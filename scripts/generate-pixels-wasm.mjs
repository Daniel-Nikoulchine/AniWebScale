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
 * Idempotent by content hash: `native/wasm-pixels/source-hash.txt` pins the
 * sha256 of the crate source tree that the committed bytes were built from.
 * `--check` fails when that pinned hash no longer matches the source tree
 * (source drift) instead of comparing mtimes. The wasm artifact itself is a
 * git-ignored build output, so a missing artifact is reported but not fatal in
 * a fresh checkout; cargo-missing handling is unchanged.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const crateDir = join(repoRoot, 'native', 'wasm-pixels');
const outDir = join(repoRoot, 'wasm');
const outFile = join(outDir, 'pixels.wasm');
const hashFile = join(crateDir, 'source-hash.txt');
const builtWasm = join(
  crateDir, 'target', 'wasm32-unknown-unknown', 'release', 'aniwebscale_pixels.wasm',
);

/** All crate source files except the cargo target directory, in stable order. */
function crateSourceFiles(dir = crateDir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'target') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...crateSourceFiles(full));
    else if (entry.isFile() && entry.name !== 'source-hash.txt') files.push(full);
  }
  return files.sort();
}

/** sha256 over "<repo-relative path>\0<contents>\0" for every crate source file. */
function crateSourceHash() {
  const hash = createHash('sha256');
  for (const file of crateSourceFiles()) {
    hash.update(relative(repoRoot, file).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function pinnedHash() {
  try {
    return readFileSync(hashFile, 'utf8').trim();
  } catch {
    return null;
  }
}

function haveCargo() {
  return spawnSync('cargo', ['--version'], { stdio: 'ignore' }).status === 0;
}

/**
 * System toolchains (distro `rust`, no rustup) ship host-only std, so the
 * wasm32 target directory is absent and `cargo build --target …` fails with
 * a raw rustc dump. Treat that like the cargo-missing case: keep a
 * previously built artifact with a loud warning instead of aborting every
 * dev/prod build. `--check` still fails so CI can require a real rebuild.
 */
function haveWasmTarget() {
  const sysroot = spawnSync('rustc', ['--print', 'sysroot'], { encoding: 'utf8' });
  if (sysroot.status !== 0 || !sysroot.stdout) return true;
  const rustlib = join(sysroot.stdout.trim(), 'lib', 'rustlib', 'wasm32-unknown-unknown');
  return existsSync(rustlib);
}

/** Actionable hint for a cargo without the wasm target. */
function missingWasmTargetHint() {
  return haveWasmTarget()
    ? ''
    : ' (missing wasm32-unknown-unknown target in this cargo toolchain — run: rustup target add wasm32-unknown-unknown)';
}

function isFresh() {
  return existsSync(outFile) && pinnedHash() === crateSourceHash();
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
  writeFileSync(hashFile, `${crateSourceHash()}\n`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--check')) {
    const pinned = pinnedHash();
    const current = crateSourceHash();
    if (pinned !== current) {
      console.error(
        'pixels-wasm --check: crate source changed since the pinned hash (run npm run generate:pixels-wasm).\n'
        + `  pinned:  ${pinned ?? '(missing source-hash.txt)'}\n`
        + `  current: ${current}`,
      );
      process.exit(1);
    }
    if (!existsSync(outFile)) {
      console.warn('pixels-wasm --check: source hash matches; wasm/pixels.wasm is a git-ignored build output not present in this checkout.');
    } else {
      console.log('pixels-wasm --check: crate source hash and wasm/pixels.wasm are current.');
    }
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
  if (!haveWasmTarget()) {
    if (existsSync(outFile)) {
      console.warn('pixels-wasm: wasm32-unknown-unknown target missing, keeping stale wasm/pixels.wasm.');
      return;
    }
    throw new Error('pixels-wasm: wasm32-unknown-unknown target missing and no wasm/pixels.wasm present.' + missingWasmTargetHint());
  }
  build();
  console.log('pixels-wasm: built wasm/pixels.wasm.');
}

const invokedAsScript = typeof process.argv[1] === 'string'
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  await main();
}

export { build, isFresh, crateSourceHash };
