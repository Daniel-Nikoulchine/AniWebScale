import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const modes = ['A', 'B', 'C', 'AA', 'BB', 'CA'];
const repeatedModes = ['AA', 'BB', 'CA'];
const qualities = ['M', 'VL', 'UL'];
const root = path.resolve(import.meta.dirname, '../..');
const bundle = path.join(root, '.tmp/shader-golden/webgpu/webgpu-golden.js');
const outputArgument = process.argv.indexOf('--output-dir');
const inputArgument = process.argv.indexOf('--input');
const onlyArgument = process.argv.indexOf('--only');
if (outputArgument < 0 || !process.argv[outputArgument + 1]
    || inputArgument < 0 || !process.argv[inputArgument + 1]) {
  throw new Error('Usage: node tests/golden/run-webgpu.mjs --input <96x54.rgba8> --output-dir <directory>');
}
const outputDirectory = path.resolve(process.argv[outputArgument + 1]);
const onlyCases = onlyArgument >= 0 && process.argv[onlyArgument + 1]
  ? new Set(process.argv[onlyArgument + 1].split(',').map(value => value.trim()).filter(Boolean))
  : null;
const fixtureBase64 = (await readFile(path.resolve(process.argv[inputArgument + 1]))).toString('base64');
await mkdir(outputDirectory, { recursive: true });
const script = await readFile(bundle);
const server = createServer((request, response) => {
  if (request.url === '/webgpu-golden.js') {
    response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    response.end(script);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  response.end('<!doctype html><title>Anime4K shader golden</title><script src="/webgpu-golden.js"></script>');
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
  ],
});
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
  let adapter = '';
  const runCases = async (selectedModes, scale, suffix) => {
    for (const mode of selectedModes) {
      for (const quality of qualities) {
        const caseName = `${mode}_${quality}${suffix}`;
        if (onlyCases && !onlyCases.has(caseName)) continue;
        const result = await page.evaluate(
          async ([selectedMode, selectedQuality, fixture, selectedScale]) => globalThis.runAnime4KGolden(
            selectedMode, selectedQuality, fixture, selectedScale,
          ),
          [mode, quality, fixtureBase64, scale],
        );
        adapter = result.adapter;
        const expectedWidth = 96 * scale;
        const expectedHeight = 54 * scale;
        if (result.width !== expectedWidth || result.height !== expectedHeight) {
          throw new Error(`${mode}/${quality} returned ${result.width}x${result.height}`);
        }
        const bytes = Buffer.from(result.base64, 'base64');
        if (bytes.length !== expectedWidth * expectedHeight * 8) {
          throw new Error(`${mode}/${quality} returned ${bytes.length} bytes`);
        }
        await writeFile(path.join(outputDirectory, `${caseName}.rgba16f`), bytes);
        process.stdout.write(`WebGPU ${mode}/${quality}${suffix}\n`);
      }
    }
  };
  await runCases(modes, 2, '');
  await runCases(repeatedModes, 4, '_4x');
  await writeFile(path.join(outputDirectory, 'adapter.txt'), `${adapter}\n`, 'utf8');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
