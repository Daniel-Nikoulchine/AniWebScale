#!/usr/bin/env node
// Compare two ncnn-vulkan benchmark JSONs and report speedup.
// Usage: node scripts/compare-ncnn-bench.mjs baseline.json new.json
import fs from 'node:fs';

if (process.argv.length < 4) {
  console.error('Usage: node scripts/compare-ncnn-bench.mjs <baseline.json> <new.json>');
  process.exit(2);
}
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

function mapCases(j) {
  const m = new Map();
  for (const c of j.cases || []) m.set(`${c.width}x${c.height}`, c);
  return m;
}
const am = mapCases(a);
const bm = mapCases(b);

console.log(`Baseline: ${a.benchmark} @ ${a.generatedAtUtc} (${a.device?.name})`);
console.log(`New:      ${b.benchmark} @ ${b.generatedAtUtc} (${b.device?.name})`);
console.log('');
console.log('case                baseline mean   new mean   delta   speedup');
console.log('----                -------------   --------   -----   -------');
for (const [k, ac] of am) {
  const bc = bm.get(k);
  if (!bc) continue;
  if (!ac.averageMs || !bc.averageMs) {
    console.log(`${k.padEnd(16)}  skipped (missing timing data)`);
    continue;
  }
  const delta = bc.averageMs - ac.averageMs;
  const pct = (delta / ac.averageMs) * 100;
  const speedup = ac.averageMs / bc.averageMs;
  const sign = delta < 0 ? '-' : '+';
  console.log(
    `${k.padEnd(16)}  ${ac.averageMs.toFixed(2).padStart(8)} ms   ${bc.averageMs.toFixed(2).padStart(8)} ms   ${sign}${Math.abs(pct).toFixed(1).padStart(5)}%   ${speedup.toFixed(2)}x`
  );
  if (ac.p50Ms && bc.p50Ms && ac.p95Ms && bc.p95Ms) {
    const p50pct = ((bc.p50Ms - ac.p50Ms) / ac.p50Ms) * 100;
    console.log(`  p50 ${ac.p50Ms.toFixed(2)} -> ${bc.p50Ms.toFixed(2)} (${p50pct >= 0 ? '+' : ''}${p50pct.toFixed(1)}%)  p95 ${ac.p95Ms.toFixed(2)} -> ${bc.p95Ms.toFixed(2)}`);
  }
  if (bc.cpuFallback && ac.cpuFallback) {
    const gpuVsCpu = ((bc.cpuFallback.averageMs - bc.averageMs) / bc.averageMs) * 100;
    console.log(`  gpu vs cpu fallback in new: gpu ${bc.averageMs.toFixed(1)} ms vs cpu ${bc.cpuFallback.averageMs.toFixed(1)} ms (${gpuVsCpu.toFixed(0)}% gpu win)`);
  }
}
console.log('');
// Return non-zero if any regression >5% mean
let regressed = false;
for (const [k, ac] of am) {
  const bc = bm.get(k);
  if (bc && bc.averageMs > ac.averageMs * 1.05) regressed = true;
}
if (regressed) {
  console.log('REGRESSION detected (>5% slower in at least one case)');
  process.exit(1);
} else {
  console.log('No >5% regression');
}
