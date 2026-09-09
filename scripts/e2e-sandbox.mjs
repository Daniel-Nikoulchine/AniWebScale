#!/usr/bin/env node
/**
 * Invisible sandboxed E2E runner — bwrap + optional Xvfb (variant B).
 *
 * Chromium: headless (already) + bwrap (pid/uts/ipc isolation).
 * Firefox: bwrap + headless by default (invisible, passes on Arch/Firefox 151).
 *          Headed via Xvfb only when E2E_USE_XVFB=1 (explicit).
 *          Workspace-3 hijack is disabled via E2E_SANDBOX=1.
 *
 * Usage:
 *   node scripts/e2e-sandbox.mjs --type chromium -- <command> [args...]
 *   node scripts/e2e-sandbox.mjs --type firefox -- <command> [args...]
 *   E2E_NO_BWRAP=1   -> skip bwrap (debugging)
 *   E2E_USE_XVFB=1   -> force Xvfb headed Firefox (otherwise headless)
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function which(bin) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const d of dirs) {
    const p = path.join(d, bin);
    if (existsSync(p)) return p;
  }
  return null;
}

function parseArgs(argv) {
  let type = 'chromium';
  let cmdStart = argv.indexOf('--');
  let extra = [];
  let typeArgIdx = argv.indexOf('--type');
  if (typeArgIdx !== -1 && argv[typeArgIdx + 1]) {
    type = argv[typeArgIdx + 1];
  }
  if (cmdStart !== -1) {
    extra = argv.slice(cmdStart + 1);
  } else {
    // fallback: everything after --type value
    const afterType = typeArgIdx !== -1 ? argv.slice(typeArgIdx + 2) : argv.slice(2);
    // filter leading -- if someone passed --type X command directly without --
    if (afterType[0] === '--') extra = afterType.slice(1);
    else if (afterType.length) extra = afterType;
  }
  if (!extra.length) {
    console.error('e2e-sandbox: no command. Usage: node scripts/e2e-sandbox.mjs --type <chromium|firefox> -- <cmd> [args]');
    process.exit(2);
  }
  return { type, command: extra };
}

const { type, command } = parseArgs(process.argv.slice(2));
const useBwrap = process.env.E2E_NO_BWRAP !== '1' && which('bwrap');
const useXvfb = type === 'firefox' && process.env.E2E_USE_XVFB === '1' && which('xvfb-run') && which('Xvfb');

if (!useBwrap) {
  console.log(`[e2e-sandbox] bwrap disabled or not found — running directly (${type})`);
}
if (type === 'firefox' && process.env.E2E_USE_XVFB === '1' && !useXvfb) {
  console.log('[e2e-sandbox] E2E_USE_XVFB=1 but Xvfb not found — falling back to headless');
}

// Build bwrap args if enabled
function buildBwrapArgs() {
  if (!useBwrap) return null;
  const args = [
    '--die-with-parent',
    '--unshare-pid',
    '--unshare-uts',
    '--unshare-ipc',
    '--share-net',
    '--proc', '/proc',
    '--dev', '/dev',
  ];

  // GPU / shm devices inside the new /dev need to be re-bound.
  // --dev creates a minimal dev tmpfs; we need to expose dri/shm from host.
  const driSrc = '/dev/dri';
  const shmSrc = '/dev/shm';
  const sndSrc = '/dev/snd';

  // System mounts — ro
  args.push('--ro-bind', '/usr', '/usr');
  args.push('--ro-bind', '/etc', '/etc');
  // /opt may not exist on some hosts
  if (existsSync('/opt')) args.push('--ro-bind-try', '/opt', '/opt');
  if (existsSync('/sys')) args.push('--ro-bind', '/sys', '/sys');
  if (existsSync('/var')) args.push('--ro-bind-try', '/var', '/var');
  if (existsSync('/run')) args.push('--ro-bind-try', '/run', '/run');

  // Standard lib symlinks (Arch uses /usr/lib)
  args.push('--symlink', 'usr/lib', '/lib');
  args.push('--symlink', 'usr/lib', '/lib64');
  args.push('--symlink', 'usr/bin', '/bin');
  args.push('--symlink', 'usr/bin', '/sbin');

  // After ro-bind / we need writable project + home.
  // Keep host home writable (Firefox needs cache outside project for some builds)
  // but project itself is the primary writable root.
  args.push('--bind', workspace, workspace);
  // Home must be writable — bind whole home read-write. Isolation is pid/ipc/uts + tmpfs /tmp.
  // This keeps Firefox/Chromium happy without having to fake $HOME to /tmp.
  const home = process.env.HOME;
  if (home && existsSync(home)) {
    args.push('--bind', home, home);
  }

  // tmpfs /tmp — isolates temp files, but we must re-expose X11 socket after tmpfs.
  args.push('--tmpfs', '/tmp');

  // Re-bind X11 unix sockets so Xvfb (running outside bwrap) is visible inside.
  const x11Sock = '/tmp/.X11-unix';
  if (existsSync(x11Sock)) {
    args.push('--bind-try', x11Sock, x11Sock);
    // also expose the lock file path for Xvfb's /tmp/.X11-unix/X99
    // the directory bind above covers it, but ensure it exists before we start.
  }

  // Re-bind dri / shm / snd after --dev /dev. NVIDIA (/dev/nvidia*) and
  // ROCm (/dev/kfd) nodes are bound the same way so E2E on those hosts
  // exercises the real GPU instead of silently falling back to SwiftShader.
  if (existsSync(driSrc)) args.push('--dev-bind-try', driSrc, driSrc);
  if (existsSync(shmSrc)) args.push('--bind-try', shmSrc, shmSrc);
  if (existsSync(sndSrc)) args.push('--dev-bind-try', sndSrc, sndSrc);
  for (const node of ['/dev/nvidia0', '/dev/nvidiactl', '/dev/nvidia-modeset', '/dev/nvidia-uvm', '/dev/kfd']) {
    if (existsSync(node)) args.push('--dev-bind-try', node, node);
  }
  // /dev/shm permissions: ensure writable
  // XDG runtime dir for Wayland fallback (may contain wayland socket)
  const xdgRt = process.env.XDG_RUNTIME_DIR;
  if (xdgRt && existsSync(xdgRt)) {
    args.push('--bind-try', xdgRt, xdgRt);
  }

  // Env: force X11 for Firefox inside Xvfb (Wayland would need weston)
  // Keep original DISPLAY if we go through xvfb-run it will set its own.
  // For chromium headless, DISPLAY is irrelevant but harmless.
  // Ensure sandbox knows it's sandboxed so runners skip hyprctl workspace hijack.
  // Generated bindings via spawn env, not bwrap --setenv, so they inherit correctly.

  args.push('--chdir', workspace);
  args.push('--');
  return args;
}

const bwrapArgs = buildBwrapArgs();

// Build final argv
let finalCommand, finalArgs, finalEnv;

finalEnv = {
  ...process.env,
  E2E_SANDBOX: '1',
  // Sandboxed Firefox defaults to headless (invisible + passes WebGPU checks on this host).
  // Keep Xvfb path for explicit headed runs (E2E_USE_XVFB=1).
  ...(type === 'firefox' && !useXvfb && !process.env.E2E_FIREFOX_HEADLESS ? { E2E_FIREFOX_HEADLESS: '1' } : {}),
  ...(type === 'firefox' && useXvfb ? { GDK_BACKEND: 'x11', MOZ_ENABLE_WAYLAND: '0', MOZ_DISABLE_WAYLAND: '1' } : {}),
};

if (useXvfb) {
  // xvfb-run OUTSIDE bwrap so Xvfb's socket is created on host /tmp/.X11-unix and bound into bwrap.
  // Use a fixed screen; playwright/chromium would also work inside Xvfb but we only need it for firefox.
  const xvfbRun = which('xvfb-run');
  const xvfbArgs = ['-a', '--server-args=-screen 0 1920x1080x24 +extension RANDR'];
  if (useBwrap) {
    finalCommand = xvfbRun;
    finalArgs = [...xvfbArgs, 'bwrap', ...bwrapArgs, ...command];
  } else {
    finalCommand = xvfbRun;
    finalArgs = [...xvfbArgs, ...command];
  }
  console.log(`[e2e-sandbox] Xvfb+bwrap (${type}): ${finalCommand} ${finalArgs.join(' ')}`);
} else if (useBwrap) {
  finalCommand = 'bwrap';
  finalArgs = [...bwrapArgs, ...command];
  console.log(`[e2e-sandbox] bwrap (${type}): bwrap ${finalArgs.join(' ')}`);
} else {
  finalCommand = command[0];
  finalArgs = command.slice(1);
  console.log(`[e2e-sandbox] direct (${type}): ${finalCommand} ${finalArgs.join(' ')}`);
}

const child = spawn(finalCommand, finalArgs, {
  stdio: 'inherit',
  env: finalEnv,
  cwd: workspace,
});

child.on('error', err => {
  console.error(`[e2e-sandbox] failed to spawn ${finalCommand}: ${err.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[e2e-sandbox] killed by signal ${signal}`);
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
