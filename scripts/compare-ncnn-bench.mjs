#!/usr/bin/env node
// Compare two ncnn-vulkan benchmark JSONs and report speedup.
// Usage: node scripts/compare-ncnn-bench.mjs baseline.json new.json
//
// Uses medians (p50) and p95 instead of the mean: a single noisy sample must
// not move the verdict. A regression is only reported when BOTH the median and
// p95 worsen beyond the noise band (NCNN_BENCH_NOISE_PCT, default 8%).
import fs from 'node:fs';

const NOISE_BAND_PCT = Number(process.env.NCNN_BENCH_NOISE_PCT || 8);
if (!Number.isFinite(NOISE_BAND_PCT) || NOISE_BAND_PCT < 0) {
  console.error('NCNN_BENCH_NOISE_PCT must be a non-negative number.');
  process.exit(2);
}

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

const median = c => c.p50Ms ?? c.averageMs;
const percentile95 = c => c.p95Ms ?? c.averageMs;

console.log(`Baseline: ${a.benchmark} @ ${a.generatedAtUtc} (${a.device?.name})`);
console.log(`New:      ${b.benchmark} @ ${b.generatedAtUtc} (${b.device?.name})`);
console.log(`Noise band: +/-${NOISE_BAND_PCT}% (median and p95 must both regress to flag)`);
console.log('');
console.log('case                baseline p50   new p50   delta   speedup');
console.log('----                ------------   -------   -----   -------');

const results = [];
for (const [k, ac] of am) {
  const bc = bm.get(k);
  if (!bc) continue;
  const aMedian = median(ac);
  const bMedian = median(bc);
  if (!aMedian || !bMedian) {
    console.log(`${k.padEnd(16)}  skipped (missing timing data)`);
    continue;
  }
  const delta = bMedian - aMedian;
  const pct = (delta / aMedian) * 100;
  const speedup = aMedian / bMedian;
  const sign = delta < 0 ? '-' : '+';
  const aP95 = percentile95(ac);
  const bP95 = percentile95(bc);
  const p95pct = aP95 && bP95 ? ((bP95 - aP95) / aP95) * 100 : null;
  console.log(
    `${k.padEnd(16)}  ${aMedian.toFixed(2).padStart(10)} ms   ${bMedian.toFixed(2).padStart(8)} ms   ${sign}${Math.abs(pct).toFixed(1).padStart(5)}%   ${speedup.toFixed(2)}x`
  );
  if (p95pct !== null) {
    console.log(`  p95 ${aP95.toFixed(2)} -> ${bP95.toFixed(2)} (${p95pct >= 0 ? '+' : ''}${p95pct.toFixed(1)}%)`);
  }
  if (bc.cpuFallback && ac.cpuFallback) {
    const gpuVsCpu = ((bc.cpuFallback.averageMs - bMedian) / bMedian) * 100;
    console.log(`  gpu vs cpu fallback in new: gpu ${bMedian.toFixed(1)} ms vs cpu ${bc.cpuFallback.averageMs.toFixed(1)} ms (${gpuVsCpu.toFixed(0)}% gpu win)`);
  }
  const medianRegressed = pct > NOISE_BAND_PCT;
  const p95Regressed = p95pct === null || p95pct > NOISE_BAND_PCT;
  results.push({ k, pct, p95pct, regressed: medianRegressed && p95Regressed });
}
console.log('');
const regressions = results.filter(r => r.regressed);
if (regressions.length > 0) {
  console.log(`REGRESSION detected (median and p95 both >${NOISE_BAND_PCT}% slower): ${regressions.map(r => r.k).join(', ')}`);
  process.exit(1);
} else {
  console.log(`No regression beyond the ${NOISE_BAND_PCT}% noise band.`);
}
