#!/usr/bin/env node
/**
 * SRVGG on-device gate: drives the native host over stdin framed-JSON
 * (same protocol as the extension) once per conv mode and compares.
 *
 * - Correctness: PSNR of the full 4x outputs between modes on a
 *   deterministic pattern frame (tiled / naive / ncnn).
 * - Performance: median host-measured timeMs per mode (frame 0 discarded:
 *   weights upload + pipeline warmup), A/B at 853x480.
 *
 * NOTE: the Winograd F4 path was removed 2026-09-06 after sandbox
 * measurement showed 99.7 ms vs 39.7 ms tiled vs 26.3 ms ncnn on
 * 480x270 x4 (RX 6700 XT): 2.5x slower than tiled at equal PSNR gate.
 * Passing --modes=wino now fails fast with that verdict.
 *
 * Usage:
 *   node scripts/srvgg-wino-gate.mjs [--modes=tiled,naive,ncnn]
 *     [--size=480x270] [--frames=6] [--out=artifacts/srvgg-wino-gate]
 *     [--min-psnr=50]
 *
 * Exit non-zero when a PSNR gate fails or any mode errors. The host binary
 * must be built (native/linux-host/build/aniwebscale-ncnn-host).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = join(repoRoot, 'native/linux-host/build/aniwebscale-ncnn-host');

function parseArgs(argv) {
  const out = { modes: ['tiled', 'ncnn'], size: '480x270', frames: 6, out: 'artifacts/srvgg-wino-gate', minPsnr: 50, input: null };
  for (const arg of argv) {
    if (arg.startsWith('--modes=')) out.modes = arg.slice(8).split(',').map(s => s.trim()).filter(Boolean);
    else if (arg.startsWith('--size=')) out.size = arg.slice(7);
    else if (arg.startsWith('--input=')) out.input = arg.slice(8);
    else if (arg.startsWith('--frames=')) out.frames = Number(arg.slice(9));
    else if (arg.startsWith('--out=')) out.out = arg.slice(6);
    else if (arg.startsWith('--min-psnr=')) out.minPsnr = Number(arg.slice(11));
    else throw new Error(`unknown arg ${arg}`);
  }
  const [w, h] = out.size.split('x').map(Number);
  if (!w || !h) throw new Error(`bad --size ${out.size}`);
  out.width = w;
  out.height = h;
  return out;
}

/** Deterministic pattern frame: gradients + checker + edges (RGBA8). */
function patternFrame(width, height) {
  const px = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      px[i] = (x * 255 / Math.max(1, width - 1)) | 0;
      px[i + 1] = (y * 255 / Math.max(1, height - 1)) | 0;
      px[i + 2] = (((x >> 3) + (y >> 3)) & 1) ? 255 : 0;
      px[i + 3] = 255;
    }
  }
  // Diagonal edge + dark corner (PReLU/tail exercise).
  for (let k = 0; k < Math.min(width, height); k += 1) {
    const i = (k * width + k) * 4;
    px[i] = 16; px[i + 1] = 240; px[i + 2] = 128;
  }
  return px;
}

function psnr(a, b) {
  if (a.length !== b.length) throw new Error(`length mismatch ${a.length} vs ${b.length}`);
  let mse = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    mse += d * d;
  }
  mse /= a.length;
  if (mse === 0) return Number.POSITIVE_INFINITY;
  return 10 * Math.log10(255 * 255 / mse);
}

function median(values) {
  const s = [...values].sort((x, y) => x - y);
  return s[s.length >> 1];
}

class FramedHost {
  constructor(env) {
    this.proc = spawn(HOST, [], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    this.buf = Buffer.alloc(0);
    this.pending = [];
    this.queued = [];
    this.stderr = '';
    this.proc.stdout.on('data', chunk => {
      this.buf = Buffer.concat([this.buf, chunk]);
      this.pump();
    });
    this.proc.stderr.on('data', chunk => { this.stderr += chunk.toString(); });
  }

  pump() {
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32LE(0);
      if (this.buf.length < 4 + len) return;
      const msg = JSON.parse(this.buf.subarray(4, 4 + len).toString('utf8'));
      this.buf = this.buf.subarray(4 + len);
      const next = this.pending.shift();
      if (next) next(msg);
      else this.queued.push(msg);
    }
  }

  request(obj) {
    return new Promise((resolve, reject) => {
      const payload = Buffer.from(JSON.stringify(obj), 'utf8');
      const frame = Buffer.alloc(4 + payload.length);
      frame.writeUInt32LE(payload.length, 0);
      payload.copy(frame, 4);
      const timer = setTimeout(() => reject(new Error('host request timeout')), 300_000);
      this.pending.push(msg => { clearTimeout(timer); resolve(msg); });
      this.proc.stdin.write(frame, err => {
        if (err) { clearTimeout(timer); reject(err); }
      });
    });
  }

  async close() {
    this.proc.stdin.end();
    await new Promise(resolve => this.proc.on('exit', resolve));
  }
}

async function runMode(mode, args, frameB64) {
  if (mode === 'wino' || mode === 'winograd') {
    throw new Error(
      "mode 'wino' was removed 2026-09-06: sandbox measured 99.7 ms vs 39.7 ms tiled "
      + "vs 26.3 ms ncnn on 480x270 x4 (RX 6700 XT). Use --modes=tiled,ncnn.",
    );
  }
  const env = {};
  if (mode !== 'ncnn') {
    env.ANIWEBSCALE_SRVGG_ENGINE = 'srvgg';
    env.ANIWEBSCALE_SRVGG_CONV = mode;
  }
  const host = new FramedHost(env);
  const hello = await host.request({ type: 'hello', requestId: 1 });
  if (hello.type !== 'ready') throw new Error(`${mode}: no ready (${JSON.stringify(hello).slice(0, 200)})`);
  const times = [];
  let first = null;
  for (let f = 0; f < args.frames; f += 1) {
    const resp = await host.request({
      type: 'upscale', requestId: 10 + f, width: args.width, height: args.height, data: frameB64,
    });
    if (resp.type !== 'realesrganResult') {
      throw new Error(`${mode}: frame ${f} failed: ${JSON.stringify(resp).slice(0, 300)}\n${host.stderr.slice(-2000)}`);
    }
    if (f === 0) {
      first = { width: resp.width, height: resp.height, data: Buffer.from(resp.data, 'base64') };
    } else {
      times.push(resp.timeMs);
    }
  }
  await host.close();
  // Host stderr carries the backend-ready line (which path served).
  const served = (host.stderr.match(/\[srvgg\] backend ready \([^\n]*\)/) || ['(ncnn: no srvgg line)'])[0];
  return { mode, times, first, served };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const frame = args.input
    ? Buffer.from(readFileSync(args.input))
    : patternFrame(args.width, args.height);
  if (frame.length !== args.width * args.height * 4) throw new Error('input size mismatch');
  const frameB64 = frame.toString('base64');
  const outDir = join(repoRoot, args.out);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `input-${args.width}x${args.height}.rgba`), frame);

  const results = [];
  for (const mode of args.modes) {
    console.log(`[gate] mode=${mode} ${args.width}x${args.height} x${args.frames} ...`);
    const r = await runMode(mode, args, frameB64);
    r.medianMs = median(r.times);
    console.log(`[gate] ${mode}: ${r.served}`);
    console.log(`[gate] ${mode}: median ${r.medianMs.toFixed(1)} ms (frames: ${r.times.map(t => t.toFixed(1)).join(', ')})`);
    writeFileSync(join(outDir, `${mode}-${args.width}x${args.height}.rgba`), r.first.data);
    results.push(r);
  }
  // PSNR gates: every srvgg mode against tiled (sibling fp16 path) when
  // present, else against naive; all against ncnn.
  const byMode = Object.fromEntries(results.map(r => [r.mode, r]));
  let failed = false;
  const check = (a, b, floor) => {
    if (!byMode[a] || !byMode[b]) return;
    if (byMode[a].first.data.length !== byMode[b].first.data.length) {
      console.error(`[gate] FAIL ${a} vs ${b}: output size mismatch`);
      failed = true;
      return;
    }
    const db = psnr(byMode[a].first.data, byMode[b].first.data);
    const label = db === Infinity ? 'inf' : db.toFixed(1);
    const ok = db >= floor;
    console.log(`[gate] PSNR ${a} vs ${b}: ${label} dB (floor ${floor}) ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) failed = true;
  };
  const sibling = byMode.tiled ? 'tiled' : 'naive';
  for (const mode of args.modes) {
    if (mode === 'ncnn' || mode === sibling) continue;
    check(mode, sibling, args.minPsnr);
  }
  for (const mode of args.modes) {
    if (mode === 'ncnn') continue;
    check(mode, 'ncnn', args.minPsnr);
  }
  const summary = {
    size: `${args.width}x${args.height}`,
    frames: args.frames,
    modes: Object.fromEntries(results.map(r => [r.mode, { medianMs: r.medianMs, timesMs: r.times, served: r.served }])),
  };
  writeFileSync(join(outDir, `summary-${args.width}x${args.height}.json`), JSON.stringify(summary, null, 2) + '\n');
  if (failed) {
    console.error('[gate] FAILED');
    process.exit(1);
  }
  console.log('[gate] PASSED');
}

await main();
