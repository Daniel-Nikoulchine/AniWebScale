#!/usr/bin/env node
/*
 * Anime4K preset benchmark runner.
 *
 * Builds nothing: run `npx webpack --config tests/bench/webpack.config.cjs` first
 * (see package.json `bench:anime4k`). Serves the bundle on 127.0.0.1, launches
 * Chromium with the real GPU (Vulkan) and prints GPU/wall times per preset.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const bundlePath = path.join(root, '.tmp/anime4k-bench/bench.js');
const modes = ['A', 'B', 'C', 'AA', 'BB', 'CA'];
const qualities = ['M', 'VL', 'UL'];

const args = process.argv.slice(2);
const value = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const profile = value('--profile') ?? '720p-1080p';
const only = value('--only') ? new Set(value('--only').split(',').map(s => s.trim())) : null;
const iterations = Number(value('--iterations') ?? 20);
const warmup = Number(value('--warmup') ?? 3);
const variants = (value('--variants') ?? 'vendor,generated').split(',').map(s => s.trim()).filter(Boolean);
const chainArg = value('--chain');
const reportPath = value('--report') ? path.resolve(value('--report')) : null;

const profiles = {
  '720p-1080p': { sourceWidth: 1280, sourceHeight: 720, targetWidth: 1920, targetHeight: 1080 },
  '720p-4k': { sourceWidth: 1280, sourceHeight: 720, targetWidth: 3840, targetHeight: 2160 },
  '1080p-4k': { sourceWidth: 1920, sourceHeight: 1080, targetWidth: 3840, targetHeight: 2160 },
};
const dimensions = profiles[profile];
if (!dimensions) throw new Error(`unknown profile ${profile}`);

const bundle = await readFile(bundlePath).catch(() => {
  throw new Error(`benchmark bundle missing: ${bundlePath}. Run: npx webpack --config tests/bench/webpack.config.cjs`);
});
const server = createServer((request, response) => {
  if (request.url === '/bench.js') {
    response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    response.end(bundle);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  response.end('<!doctype html><title>Anime4K bench</title><script src="/bench.js"></script>');
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: [
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist',
    '--enable-features=Vulkan',
    '--use-angle=vulkan',
    '--use-vulkan=native',
  ],
});

const rows = [];
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
  const results = [];
  const cases = chainArg
    ? [[chainArg, chainArg.split(',').map(className => ({
        className: className.trim(),
        upscaleFactor: /x2/.test(className) ? 2 : 1,
      }))]]
    : modes.flatMap(mode => qualities.map(quality => [`${mode}_${quality}`, undefined, mode, quality]));
  for (const [caseName, chain, mode, quality] of cases) {
    if (only && !only.has(caseName)) continue;
    {
      const perVariant = {};
      for (const variant of variants) {
        const spec = { mode, quality, ...dimensions, warmup, iterations, variant, chain };
        const result = await page.evaluate(specJson => globalThis.runAnime4KBench(specJson), spec);
        perVariant[variant] = result;
        results.push({ case: caseName, variant, ...result });
      }
      const vendor = perVariant.vendor;
      const generated = perVariant.generated;
      const speedup = vendor && generated && Number.isFinite(generated.gpuMsMedian) && generated.gpuMsMedian > 0
        ? ` speedup=${(vendor.gpuMsMedian / generated.gpuMsMedian).toFixed(2)}x`
        : '';
      const detail = Object.entries(perVariant)
        .map(([name, r]) => `${name}=${r.gpuMsMedian.toFixed(2)}ms`)
        .join(' ');
      const errorDetail = Object.entries(perVariant)
        .flatMap(([name, r]) => (r.errors ?? []).map(message => `\n      [${name}] ${message}`))
        .join('');
      rows.push(`${caseName.padEnd(20)} out=${vendor?.outputWidth ?? '?'}x${vendor?.outputHeight ?? '?'} ${detail}${speedup}${errorDetail}`);
    }
  }
  console.log(`profile=${profile} source=${dimensions.sourceWidth}x${dimensions.sourceHeight} target=${dimensions.targetWidth}x${dimensions.targetHeight}`);
  console.log(`adapter=${results[0]?.adapter ?? 'unknown'} iterations=${iterations} warmup=${warmup}`);
  console.log('-----------------------------------------------');
  rows.forEach(row => console.log(row));
  if (reportPath) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify({ profile, dimensions, iterations, warmup, results }, null, 2)}\n`, 'utf8');
    console.log(`report: ${reportPath}`);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
