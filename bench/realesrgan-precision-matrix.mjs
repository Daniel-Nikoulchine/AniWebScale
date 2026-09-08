#!/usr/bin/env node
/**
 * RealESRGAN precision x cap benchmark matrix (sandbox E2E, invisible).
 *
 * Runs tests/e2e/run-realesrgan-clip.mjs once per (precision, cap) combo in
 * the Xvfb sandbox and reports median inference per combo from the
 * `[clip-e2e] stats` windows the page forwards. Gate verdicts are recorded
 * but never fail the matrix: a combo that cannot serve (e.g. no WebGPU in
 * the sandbox) reports n/a instead of breaking the remaining combos.
 *
 * Env:
 *   E2E_FIREFOX_BINARY  Zen/Firefox binary (default /usr/bin/zen-browser).
 *   E2E_SANDBOX=1       required (never on the visible workspace).
 *   E2E_USE_XVFB=1      headed under Xvfb so scripted fullscreen works.
 *   MATRIX_SECONDS      collect seconds per combo (default 45).
 *   MATRIX_SINGLE       "precision,cap" to run one combo only (smoke).
 *
 * Usage:
 *   E2E_SANDBOX=1 E2E_USE_XVFB=1 node bench/realesrgan-precision-matrix.mjs
 */
import { execFile } from 'node:child_process';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runner = path.join(workspace, 'tests/e2e/run-realesrgan-clip.mjs');

if (process.env.E2E_SANDBOX !== '1') {
  console.error('MATRIX_REFUSE: set E2E_SANDBOX=1 (invisible sandbox only).');
  process.exit(2);
}

const PRECISIONS = ['int8', 'fp16', 'fp32'];
const CAPS = ['480', '432', '405'];
const collectSeconds = Number(process.env.MATRIX_SECONDS || 45);

let combos = CAPS.flatMap(cap => PRECISIONS.map(precision => ({ precision, cap })));
const single = process.env.MATRIX_SINGLE;
if (single) {
  const [p, c] = single.split(',');
  combos = [{ precision: p, cap: c }];
}

function parseOutput(output) {
  const stats = [...output.matchAll(/\[clip-e2e\] stats infer=([\d.]+)ms readback=([\d.]+)ms compose=([\d.]+)ms fps=([\d.]+)(?: precision=(\S+))? n=(\d+)/g)]
    .map(m => ({ infer: Number(m[1]), readback: Number(m[2]), compose: Number(m[3]), fps: Number(m[4]), precision: m[5] ?? 'n/a' }));
  const median = stats.length
    ? stats.map(s => s.infer).sort((a, b) => a - b)[stats.length >> 1]
    : null;
  const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const sessionModels = [...new Set([...output.matchAll(/session create:[^\n]*?(\S+\.onnx)/g)].map(m => m[1]).filter(f => f !== '%s'))];
  const autoCapSteps = [...output.matchAll(/auto-cap -> (\d+)p/g)].map(m => m[1]);
  const workerPaths = [...new Set([...output.matchAll(/runner composition path: (\S+)/g)].map(m => m[1]))];
  const verdict = (output.match(/^([A-Z]+) {2}.*$/gm) || []).join(' | ');
  const fatalCodes = [...output.matchAll(/\[RealESRGAN:([a-z-]+)\]/g)].map(m => m[1]);
  return {
    windows: stats.length,
    medianInfer: median,
    meanReadback: mean(stats.map(s => s.readback)),
    meanCompose: mean(stats.map(s => s.compose)),
    meanFps: mean(stats.map(s => s.fps)),
    servedPrecision: stats.length
      ? [...new Set(stats.map(s => s.precision))].join(',')
      : 'n/a',
    sessionModels: sessionModels.join(',') || 'none',
    autoCapSteps: autoCapSteps.join('>') || 'none',
    workerPaths: workerPaths.join(',') || 'none',
    fatalCodes: [...new Set(fatalCodes)].join(',') || 'none',
    verdict,
  };
}

const results = [];
for (const { precision, cap } of combos) {
  console.log(`--- combo precision=${precision} cap=${cap} (${collectSeconds}s collect) ---`);
  const started = Date.now();
  let output;
  try {
    output = await new Promise(resolve => {
      const child = execFile('node', [runner], {
        cwd: workspace,
        timeout: (collectSeconds + 120) * 1000,
        maxBuffer: 64 * 1024 * 1024,
        env: {
          ...process.env,
          E2E_FIREFOX_BINARY: process.env.E2E_FIREFOX_BINARY || '/usr/bin/zen-browser',
          E2E_SANDBOX: '1',
          E2E_PRECISION: precision,
          E2E_CAP_HEIGHT: cap,
          E2E_REALESRGAN_SECONDS: String(collectSeconds),
        },
      }, (error, stdout, stderr) => {
        resolve(String(stdout ?? '') + '\n' + String(stderr ?? '')
          + (error ? `\n[matrix] runner exit: ${error.message}` : ''));
      });
      void child;
    });
  } catch (error) {
    output = `[matrix] harness error: ${error.message}`;
  }
  const wall = Math.round((Date.now() - started) / 1000);
  const parsed = parseOutput(output);
  results.push({ precision, cap, wall, ...parsed });
  console.log(`combo precision=${precision} cap=${cap}: windows=${parsed.windows} `
    + `medianInfer=${parsed.medianInfer === null ? 'n/a' : parsed.medianInfer.toFixed(1) + 'ms'} `
    + `served=${parsed.servedPrecision} session=[${parsed.sessionModels}] paths=[${parsed.workerPaths}] `
    + `autocap=${parsed.autoCapSteps} wall=${wall}s`);
}

console.log('\n=== RealESRGAN precision x cap matrix (median infer ms) ===');
console.log('cap \\ precision | int8 | fp16 | fp32');
for (const cap of CAPS) {
  const cells = PRECISIONS.map(p => {
    const r = results.find(r => r.precision === p && r.cap === cap);
    return r && r.medianInfer !== null ? r.medianInfer.toFixed(1) : 'n/a';
  });
  console.log(`${cap}p | ${cells.join(' | ')}`);
}
console.log('\n--- detail ---');
for (const r of results) {
  console.log(`${r.cap}p ${r.precision}: windows=${r.windows} medianInfer=`
    + `${r.medianInfer === null ? 'n/a' : r.medianInfer.toFixed(1) + 'ms'} `
    + `readback=${r.meanReadback === null ? 'n/a' : r.meanReadback.toFixed(1) + 'ms'} `
    + `compose=${r.meanCompose === null ? 'n/a' : r.meanCompose.toFixed(1) + 'ms'} `
    + `fps=${r.meanFps === null ? 'n/a' : r.meanFps.toFixed(1)} served=${r.servedPrecision} `
    + `session=[${r.sessionModels}] paths=[${r.workerPaths}] autocap=${r.autoCapSteps} fatal=[${r.fatalCodes}] wall=${r.wall}s`);
}
