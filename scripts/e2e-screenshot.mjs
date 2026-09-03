#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startFixtureServers, PRIMARY_ORIGIN } from '../tests/e2e/server.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.join(workspace, 'dist-chrome');
const outDir = path.join(workspace, '.tmp', 'e2e-proof');
const browserExecutable = process.env.E2E_CHROMIUM_BINARY || chromium.executablePath();

if (!existsSync(path.join(extensionPath, 'manifest.json'))) {
  console.error('dist-chrome missing. Run npm run build:chrome');
  process.exit(1);
}
if (!existsSync(browserExecutable)) {
  console.error('Chromium missing at', browserExecutable);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
console.log(`[e2e-screenshot] starting fixtures + Chromium ${browserExecutable}`);
console.log(`[e2e-screenshot] extension: ${extensionPath}`);
console.log(`[e2e-screenshot] outDir: ${outDir}`);

const servers = await startFixtureServers();
console.log(`[e2e-screenshot] fixtures at ${PRIMARY_ORIGIN}`);

const profileRoot = path.join(workspace, '.tmp', 'e2e-profiles');
await mkdir(profileRoot, { recursive: true });
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
const profile = await mkdtemp(path.join(os.tmpdir(), 'e2e-shot-'));

let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: browserExecutable,
    channel: process.env.E2E_CHROMIUM_BINARY ? undefined : 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--lang=en-US',
      '--autoplay-policy=no-user-gesture-required',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
    ],
  });

  const page = await context.newPage();
  await page.goto(`${PRIMARY_ORIGIN}/media.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-anime4k-overlay-host]', { state: 'attached', timeout: 12000 });
  // small wait for video decode
  await page.waitForTimeout(500);
  const count = await page.locator('[data-anime4k-overlay-host]').count();
  const videoCount = await page.locator('video[data-anime4k-video-id]').count();
  console.log(`[e2e-screenshot] overlays=${count} videos=${videoCount}`);

  const mediaShot = path.join(outDir, 'media.png');
  await page.screenshot({ path: mediaShot, fullPage: true });
  console.log(`[e2e-screenshot] saved ${mediaShot}`);

  // popup
  const EXT_ID = 'dlomjcbmgkfaebhplgoihbjfclaagike';
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${EXT_ID}/popup.html`, { waitUntil: 'domcontentloaded' });
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForTimeout(300);
  const popupShot = path.join(outDir, 'popup.png');
  await popup.screenshot({ path: popupShot, fullPage: true });
  console.log(`[e2e-screenshot] saved ${popupShot}`);
  await popup.close();

  // options
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${EXT_ID}/options.html`, { waitUntil: 'domcontentloaded' });
  await opts.waitForLoadState('domcontentloaded');
  await opts.waitForTimeout(300);
  const optsShot = path.join(outDir, 'options.png');
  await opts.screenshot({ path: optsShot, fullPage: true });
  console.log(`[e2e-screenshot] saved ${optsShot}`);
  await opts.close();

  await page.close();

  console.log(`[e2e-screenshot] done — ${outDir}/media.png, popup.png, options.png`);
} finally {
  await context?.close().catch(()=>{});
  await rm(profile, { recursive: true, force: true }).catch(()=>{});
  await servers.close();
}
