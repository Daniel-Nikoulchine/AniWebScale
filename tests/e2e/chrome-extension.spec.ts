import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect, test as base, type BrowserContext, type Page } from '@playwright/test';

const EXTENSION_ID = 'dlomjcbmgkfaebhplgoihbjfclaagike';
const OVERLAY_SELECTOR = '[data-anime4k-overlay-host]';
const workspace = path.resolve(__dirname, '../..');
const extensionPath = path.join(workspace, 'dist-chrome');

type TestFixtures = {
  extensionPage: Page;
};
type WorkerFixtures = {
  extensionContext: BrowserContext;
};

const test = base.extend<TestFixtures, WorkerFixtures>({
  extensionContext: [async ({}, use) => {
    if (!existsSync(path.join(extensionPath, 'manifest.json'))) {
      throw new Error('dist-chrome is missing. Run npm run build:chrome before the E2E tests.');
    }
    const browserExecutable = process.env.E2E_CHROMIUM_BINARY || chromium.executablePath();
    if (!existsSync(browserExecutable)) {
      throw new Error(
        `Playwright Chromium is missing at ${browserExecutable}. Run npm run test:e2e:install `
        + 'or set E2E_CHROMIUM_BINARY to a Chromium build that permits --load-extension.',
      );
    }
    const profileRoot = path.join(workspace, '.tmp', 'e2e-profiles');
    await mkdir(profileRoot, { recursive: true });
    const profile = await mkdtemp(path.join(profileRoot, 'chromium-'));
    const context = await chromium.launchPersistentContext(profile, {
      executablePath: browserExecutable,
      channel: process.env.E2E_CHROMIUM_BINARY ? undefined : 'chromium',
      headless: process.env.E2E_HEADED !== '1',
      viewport: { width: 1280, height: 900 },
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--autoplay-policy=no-user-gesture-required',
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
      ],
    });
    try {
      await use(context);
    } finally {
      await context.close();
      if (!path.resolve(profile).startsWith(`${profileRoot}${path.sep}`)) {
        throw new Error(`Refusing to remove unexpected E2E profile path: ${profile}`);
      }
      await rm(profile, { recursive: true, force: true });
    }
  }, { scope: 'worker' }],

  extensionPage: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    await use(page);
    await page.close();
  },
});

async function waitForExtension(context: BrowserContext, page: Page): Promise<void> {
  await page.goto('/media.html');
  try {
    await page.waitForSelector(OVERLAY_SELECTOR, { state: 'attached', timeout: 12_000 });
  } catch (error) {
    const workers = context.serviceWorkers().map(worker => worker.url());
    throw new Error(
      `Anime4K content script was not injected. Service workers: ${workers.join(', ') || '(none)'}. `
      + 'Use the Playwright Chromium installed by npm run test:e2e:install; recent branded Chrome builds '
      + 'do not permit command-line extension sideloading.',
      { cause: error },
    );
  }
}

async function setExtensionSettings(
  context: BrowserContext,
  autoFullscreenEnabled = true,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  let worker = context.serviceWorkers().find(item => item.url().startsWith(`chrome-extension://${EXTENSION_ID}/`));
  if (!worker) {
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${EXTENSION_ID}/options.html`);
    worker = context.serviceWorkers().find(item => item.url().startsWith(`chrome-extension://${EXTENSION_ID}/`));
    await extensionPage.close();
  }
  if (!worker) throw new Error(`The expected extension service worker ${EXTENSION_ID} is not running.`);
  await worker.evaluate(async ({ enabled, settingsOverrides }) => {
    await chrome.storage.local.set({
      aniwebscaleVerifiedLicenseV1: {
        token: 'e2e-only',
        userId: '00000000-0000-4000-8000-000000000001',
        plan: 'pro',
        status: 'active',
        features: ['anime4k', 'webgpu', 'native_renderer', 'ai_models', 'frame_generation'],
        expiresAt: Date.now() + 3_600_000,
      },
    });
    await chrome.storage.sync.set({
      extensionEnabled: true, mode: 'A', quality: 'M', output: 'auto', backend: 'webgpu', statsEnabled: true,
      autoFullscreenEnabled: enabled, frameGenerationEnabled: false, ...settingsOverrides,
    });
  }, { enabled: autoFullscreenEnabled, settingsOverrides: overrides });
}

test.beforeEach(async ({ extensionContext, extensionPage }) => {
  await waitForExtension(extensionContext, extensionPage);
});

test('injects into same-origin and CORS videos without mutating their sources', async ({ extensionPage: page }) => {
  await expect(page.locator('video[data-anime4k-video-id]')).toHaveCount(3);
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(3);
  await expect.poll(() => page.locator('#same-video').evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(320);
  await expect.poll(() => page.locator('#cors-video').evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(320);

  const state = await page.evaluate(() => {
    const hostFor = (video: HTMLVideoElement) => document.querySelector<HTMLElement>(
      `[data-anime4k-overlay-host="${CSS.escape(video.dataset.anime4kVideoId || '')}"]`,
    );
    const same = document.querySelector<HTMLVideoElement>('#same-video')!;
    const cors = document.querySelector<HTMLVideoElement>('#cors-video')!;
    const small = document.querySelector<HTMLVideoElement>('#small-video')!;
    return {
      sameAttribute: same.getAttribute('src'),
      corsAttribute: cors.getAttribute('src'),
      corsMode: cors.crossOrigin,
      sameHostDisplay: getComputedStyle(hostFor(same)!).display,
      corsHostDisplay: getComputedStyle(hostFor(cors)!).display,
      smallHostDisplay: getComputedStyle(hostFor(small)!).display,
    };
  });
  expect(state).toEqual({
    sameAttribute: '/fixture.webm',
    corsAttribute: 'http://127.0.0.1:4174/fixture.webm',
    corsMode: 'anonymous',
    sameHostDisplay: 'block',
    corsHostDisplay: 'block',
    smallHostDisplay: 'none',
  });
  await expect(page.locator('.anime4k-button')).toHaveCount(0);
  await expect(page.locator('video[data-anime4k-applied="true"]')).toHaveCount(0);
});

test('injects independently into a cross-origin iframe', async ({ extensionPage: page }) => {
  await page.goto('/iframe-host.html');
  const frame = page.frames().find(item => item.url().includes('127.0.0.1:4174/frame.html'));
  expect(frame, 'cross-origin fixture frame').toBeTruthy();
  await expect(frame!.locator('video[data-anime4k-video-id]')).toHaveCount(1);
  await expect(frame!.locator(OVERLAY_SELECTOR)).toHaveCount(1);
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(0);
});

test('injects into an origin-derived blob player frame', async ({ extensionPage: page }) => {
  await page.goto('/blob-frame-host.html');
  await expect.poll(() => page.frames().some(frame => frame.url().startsWith('blob:'))).toBe(true);
  const frame = page.frames().find(item => item.url().startsWith('blob:'));
  expect(frame, 'blob player fixture frame').toBeTruthy();
  await expect(frame!.locator('video[data-anime4k-video-id]')).toHaveCount(1);
  await expect(frame!.locator(OVERLAY_SELECTOR)).toHaveCount(1);
});

test('validates native fallback from an inherited about:blank player by its effective origin', async ({
  extensionContext,
  extensionPage: page,
}) => {
  await setExtensionSettings(extensionContext, true, { backend: 'native' });
  await page.goto('/about-blank-frame-host.html');
  const frame = page.frames().find(item => item.url() === 'about:blank');
  expect(frame, 'inherited about:blank player frame').toBeTruthy();
  await expect(frame!.locator('#about-blank-video')).toHaveAttribute('data-anime4k-auto-fullscreen', 'true');
  expect(await frame!.evaluate(() => location.origin)).toBe('null');

  let outcome: 'pending' | 'consent' | 'invalid-request' = 'pending';
  page.once('dialog', async dialog => {
    if (dialog.message().startsWith('Allow AniWebScale to capture this browser tab')) outcome = 'consent';
    await dialog.dismiss();
  });
  await frame!.locator('#about-blank-fullscreen').click();

  await expect.poll(async () => {
    if (outcome !== 'pending') return outcome;
    if ((await frame!.locator('body').innerText()).includes('The native fallback request was invalid.')) {
      outcome = 'invalid-request';
    }
    return outcome;
  }).toBe('consent');
});

test('presents enhancement modes with readable names and relevant controls', async ({ extensionContext }) => {
  await setExtensionSettings(extensionContext, true, {
    mode: 'A',
    quality: 'M',
    backend: 'auto',
    frameGenerationEnabled: false,
  });
  const popup = await extensionContext.newPage();
  try {
    await popup.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
    const mode = popup.locator('#mode');
    await expect(mode).toHaveValue('A');
    await expect(mode.locator('option:checked')).toHaveText('Anime4K A - Balanced restore + 2x upscale (Recommended)');
    await expect(mode.locator('option')).toHaveText([
      'Off - No image enhancement',
      'Anime4K A - Balanced restore + 2x upscale (Recommended)',
      'Anime4K B - Soft restore + 2x upscale',
      'Anime4K C - Denoise + 2x upscale',
      'Anime4K A+A - Strong 2-pass restore + up to 4x',
      'Anime4K B+B - Strong soft restore + up to 4x',
      'Anime4K C+A - Denoise, restore + up to 4x',
      'Anime4K CNN 2x - Sharp neural upscale (GPU: medium)',
      'ArtCNN C4F16 2x - Line/detail reconstruction (GPU: real-time)',
      'ACNet F8B4 2x - Fast lightweight upscale (GPU: very light)',
      'ARNet F8B8 2x - Strong detail recovery (GPU: balanced)',
      'AnimeJaNai HD 2x - High-quality restoration (GPU: very high)',
    ]);
    expect(await mode.locator('option').evaluateAll((options) =>
      options.every((option) => (option as HTMLOptionElement).title.length > 60),
    )).toBe(true);
    await expect(popup.locator('#extension-enabled')).toBeChecked();
    await expect(popup.getByText('make every frame sparkle', { exact: true })).toHaveCount(0);
    await expect(popup.locator('.badge')).toHaveCount(0);
    await expect(popup.locator('#mode-profile')).toHaveCount(0);
    await expect(popup.locator('#mode-description')).toHaveText('Restores line detail, then applies Anime4K CNN upscaling. The balanced default for most anime.');
    await expect(popup.locator('#compatibility-hint')).toHaveCount(0);
    await expect(popup.getByText('Output', { exact: true })).toHaveCount(0);
    const popupHeight = await popup.evaluate(() => ({
      client: document.body.clientHeight,
      scroll: document.body.scrollHeight,
    }));
    expect(popupHeight.scroll).toBeLessThanOrEqual(popupHeight.client);

    await expect(mode.locator('option[value="GANX3"]')).toHaveCount(0);
    await expect(mode.locator('option[value="GANX4"]')).toHaveCount(0);
    await mode.selectOption('ARTCNN');
    await expect(mode.locator('option:checked')).toHaveText('ArtCNN C4F16 2x - Line/detail reconstruction (GPU: real-time)');
    await expect(popup.locator('#quality')).toBeDisabled();

    await expect(mode.locator('option[value="REALESRGANX4"]')).toHaveCount(0);

    await mode.selectOption('OFF');
    await expect(mode.locator('option:checked')).toHaveText('Off - No image enhancement');
    await expect(popup.locator('#backend')).toBeDisabled();
  } finally {
    await popup.close();
  }
});

test('shows the official AniWebScale logo in the settings hero', async ({ extensionContext }) => {
  const options = await extensionContext.newPage();
  try {
    await options.goto(`chrome-extension://${EXTENSION_ID}/options.html`);
    const header = options.locator('.site-header');
    await expect(header).toBeVisible();
    await expect(header.locator('.brand img')).toHaveAttribute('src', 'icons/icon128.png');
    await expect(options.locator('.topbar')).toHaveCount(0);
    await expect(options.getByText('your little video workshop', { exact: true })).toHaveCount(0);
    await expect(options.getByText(/^(01 \/ THE GOOD STUFF|02 \/ YOUR SPACE|03 \/ MAKE IT YOURS)$/i)).toHaveCount(0);

    const root = options.locator('html');
    const themeSelect = options.locator('#theme');
    const themeToggle = options.locator('#theme-toggle');
    await expect(themeToggle.locator('svg.lucide-sun')).toHaveCount(1);
    await expect(themeToggle.locator('svg.lucide-moon')).toHaveCount(1);
    await expect(themeToggle).toHaveText('');
    await expect(root).toHaveAttribute('data-theme', /^(light|dark)$/);
    const effectiveTheme = await root.getAttribute('data-theme') as 'light' | 'dark';
    const storedTheme = await themeSelect.inputValue();
    const nextTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
    await themeToggle.click();
    await expect(root).toHaveAttribute('data-theme', nextTheme);
    await expect(root).toHaveClass(new RegExp(`(?:^|\\s)${nextTheme}(?:\\s|$)`));
    await expect(themeSelect).toHaveValue(nextTheme);
    expect(await options.evaluate(async () => (await chrome.storage.sync.get('theme')).theme)).toBe(nextTheme);
    await themeSelect.selectOption(storedTheme);
    await expect(root).toHaveAttribute('data-theme', effectiveTheme);

    const logo = options.locator('.hero-logo');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', 'icons/icon400.png');
    await expect(options.locator('.hero-art .screen')).toHaveCount(0);
    await expect(options.locator('.hero-art .cloud')).toHaveCount(0);
    expect(await logo.evaluate((image: HTMLImageElement) => ({
      complete: image.complete,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }))).toEqual({ complete: true, width: 400, height: 400 });
  } finally {
    await options.close();
  }
});

test('aligns native permission status badges in one column', async ({ extensionContext }) => {
  const options = await extensionContext.newPage();
  try {
    await options.goto(`chrome-extension://${EXTENSION_ID}/options.html`);
    await options.evaluate(async () => {
      await chrome.storage.local.set({
        anime4kNativeConsentByOrigin: {
          'https://aniworld.to': true,
          'https://www.crunchyroll.com': true,
          'https://www.youtube.com': true,
        },
      });
    });
    await options.reload();

    const badges = options.locator('#native-sites .permission.allowed');
    await expect(badges).toHaveCount(3);
    const leftEdges = await badges.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().left),
    );
    expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThan(0.5);
  } finally {
    await options.evaluate(async () => {
      await chrome.storage.local.remove('anime4kNativeConsentByOrigin');
    }).catch(() => undefined);
    await options.close();
  }
});

test('global popup toggle immediately disables and re-enables video management', async ({
  extensionContext,
  extensionPage: page,
}) => {
  await setExtensionSettings(extensionContext, true, { extensionEnabled: true });
  await page.goto('/media.html');
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(3);

  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
  const toggle = popup.locator('#extension-enabled');
  const toggleRow = popup.locator('.extension-switch-card .check-row');
  try {
    await expect(toggle).toBeChecked();
    await toggleRow.click();
    await expect(toggle).not.toBeChecked();
    await expect(popup.locator('#status')).toHaveText('Extension disabled.');
    await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(0);

    await toggleRow.click();
    await expect(toggle).toBeChecked();
    await expect(popup.locator('#status')).toHaveText('Extension enabled.');
    await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(3);
  } finally {
    if (!await toggle.isChecked()) {
      await toggleRow.click();
      await expect(popup.locator('#status')).toHaveText('Extension enabled.');
    }
    await popup.close();
  }
});

test('observes and cleans up videos inside an open Shadow DOM', async ({ extensionPage: page }) => {
  await page.goto('/shadow.html');
  await expect(page.locator('#shadow-host video[data-anime4k-video-id]')).toHaveCount(1);
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);
  await page.evaluate(() => (window as any).removeShadowVideo());
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(0);
  await page.evaluate(() => (window as any).addShadowVideo(1));
  await expect(page.locator('#shadow-host video[data-anime4k-video-id]')).toHaveCount(1);
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);
});

test('cleans up twenty dynamic replacements and supports multiple videos', async ({ extensionPage: page }) => {
  await page.goto('/dynamic.html');
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);
  for (let index = 1; index <= 20; index++) {
    await page.evaluate(cycle => (window as any).replaceDynamicVideo(cycle), index);
    await expect(page.locator('#dynamic-root video[data-anime4k-video-id]')).toHaveCount(1);
    await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);
  }
  await page.evaluate(() => (window as any).addSecondVideo());
  await expect(page.locator('#dynamic-root video[data-anime4k-video-id]')).toHaveCount(2);
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(2);
  await page.evaluate(() => (window as any).removeSecondVideo());
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);
});

test('keeps DOM subtitles and website controls available above the player', async ({ extensionPage: page }) => {
  await page.goto('/layers.html');
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);
  const state = await page.evaluate(() => {
    const subtitle = document.querySelector<HTMLElement>('#subtitle')!;
    const controls = document.querySelector<HTMLElement>('#site-controls')!;
    const subtitleRect = subtitle.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    return {
      subtitleAtPoint: document.elementFromPoint(
        subtitleRect.left + subtitleRect.width / 2,
        subtitleRect.top + subtitleRect.height / 2,
      )?.id,
      controlsAtPoint: document.elementFromPoint(
        controlsRect.left + controlsRect.width / 2,
        controlsRect.top + controlsRect.height / 2,
      )?.id,
      subtitleText: subtitle.textContent,
      controlsText: controls.textContent,
    };
  });
  expect(state).toEqual({
    subtitleAtPoint: 'subtitle',
    controlsAtPoint: 'site-controls',
    subtitleText: 'DOM subtitle remains visible',
    controlsText: 'Website controls',
  });
});

test('starts only in player fullscreen, remains stable, and stops after exit', async ({ extensionContext, extensionPage: page }) => {
  test.setTimeout(90_000);
  const hasWebGPU = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!hasWebGPU, 'WebGPU is unavailable in this browser/GPU configuration.');
  await setExtensionSettings(extensionContext);
  await page.goto('/layers.html');
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);
  const enabled = await page.evaluate(() => document.fullscreenEnabled);
  test.skip(!enabled, 'This Chromium build does not expose the Fullscreen API in the current mode.');
  await page.locator('#enter-fullscreen').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('player');
  await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true', { timeout: 60_000 });
  await expect.poll(() => page.evaluate(
    selector => document.fullscreenElement?.querySelector(selector) !== null,
    OVERLAY_SELECTOR,
  )).toBe(true);
  await expect(page.locator('#player > canvas')).toHaveCSS('visibility', 'visible');
  await page.waitForTimeout(1_500);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('player');
  await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true');
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
  await expect(page.locator('#layer-video').evaluate((video: HTMLVideoElement) => video.style.opacity)).resolves.toBe('');
  await expect.poll(() => page.evaluate(
    selector => document.body.querySelector(selector) !== null,
    OVERLAY_SELECTOR,
  )).toBe(true);
});

for (const mode of ['ARTCNN', 'ACNET', 'ARNET', 'ANIMEJANAI'] as const) {
test(`runs ${mode} with frame generation through WebGPU`, async ({ extensionContext, extensionPage: page }) => {
  test.setTimeout(180_000);
  const hasWebGPU = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!hasWebGPU, 'WebGPU is unavailable in this browser/GPU configuration.');
  await setExtensionSettings(extensionContext, true, {
    mode,
    frameGenerationEnabled: true,
  });
  await page.goto('/layers.html');
  const enabled = await page.evaluate(() => document.fullscreenEnabled);
  test.skip(!enabled, 'This Chromium build does not expose the Fullscreen API in the current mode.');

  await page.locator('#enter-fullscreen').click();
  const startup = await page.waitForFunction(() => {
    if (document.querySelector('#layer-video')?.getAttribute('data-anime4k-applied') === 'true') return 'ready';
    return Array.from(document.body.children)
      .map(element => element.textContent?.trim() || '')
      .find(text => text.startsWith('Anime4K:')) || null;
  }, null, { timeout: 150_000 });
  expect(await startup.jsonValue()).toBe('ready');
  await expect(page.locator('#player > canvas')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('#layer-video').evaluate((video: HTMLVideoElement) => video.style.opacity)).resolves.toBe('0');
  await page.waitForTimeout(750);
  await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true');

  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
  await page.waitForTimeout(500);
  await expect(page.locator('body')).not.toContainText('inference failed');
  await expect(page.locator('body')).not.toContainText('unmapped before mapping was resolved');
});
}

for (const mode of ['A', 'B', 'C', 'AA', 'BB', 'CA', 'CNNX2'] as const) {
  test(`runs ${mode} with frame generation through WebGPU`, async ({ extensionContext, extensionPage: page }) => {
    test.setTimeout(90_000);
    const hasWebGPU = await page.evaluate(() => Boolean(navigator.gpu));
    test.skip(!hasWebGPU, 'WebGPU is unavailable in this browser/GPU configuration.');
    await setExtensionSettings(extensionContext, true, {
      mode,
      quality: 'M',
      frameGenerationEnabled: true,
    });
    await page.goto('/layers.html');
    const enabled = await page.evaluate(() => document.fullscreenEnabled);
    test.skip(!enabled, 'This Chromium build does not expose the Fullscreen API in the current mode.');

    await page.locator('#enter-fullscreen').click();
    await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true', { timeout: 60_000 });
    await expect(page.locator('#player > canvas')).toHaveCSS('visibility', 'visible');
    await expect(page.locator('#layer-video').evaluate((video: HTMLVideoElement) => video.style.opacity)).resolves.toBe('0');
    await page.waitForTimeout(250);
    await expect(page.locator('body')).not.toContainText('Anime4K:');

    await page.evaluate(() => document.exitFullscreen());
    await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
  });
}

test('redirects a direct video fullscreen request before automatic WebGPU startup', async ({ extensionContext, extensionPage: page }) => {
  test.setTimeout(90_000);
  const hasWebGPU = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!hasWebGPU, 'WebGPU is unavailable in this browser/GPU configuration.');
  await setExtensionSettings(extensionContext);
  await page.goto('/layers.html');
  const enabled = await page.evaluate(() => document.fullscreenEnabled);
  test.skip(!enabled, 'This Chromium build does not expose the Fullscreen API in the current mode.');

  await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-auto-fullscreen', 'true');
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
  await page.locator('#enter-video-fullscreen').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('player');
  await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true', { timeout: 60_000 });
  await expect(page.locator('#player > canvas')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('#layer-video').evaluate((video: HTMLVideoElement) => video.style.opacity)).resolves.toBe('0');

  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
});

test('normalizes a broad page fullscreen to the compact player surface', async ({ extensionContext, extensionPage: page }) => {
  test.setTimeout(90_000);
  const hasWebGPU = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!hasWebGPU, 'WebGPU is unavailable in this browser/GPU configuration.');
  await setExtensionSettings(extensionContext);
  await page.goto('/layers.html');
  await page.locator('#enter-page-fullscreen').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('HTML');
  await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true', { timeout: 60_000 });
  await expect(page.locator('#player')).toHaveAttribute('data-anime4k-fullscreen-root', 'true');
  // The rendered canvas hides the source video with opacity: 0. Exercise the
  // delayed resize reconcile that previously mistook that for a page-hidden
  // video and removed the fullscreen layout again.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(250);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('HTML');
  await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true');
  await expect(page.locator('#player')).toHaveAttribute('data-anime4k-fullscreen-root', 'true');
  const geometry = await page.locator('#player').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  expect(geometry).toEqual({ left: 0, top: 0, width: 1280, height: 900 });
  await expect(page.locator('h1')).toHaveCSS('visibility', 'hidden');
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('#player')).not.toHaveAttribute('data-anime4k-fullscreen-root', 'true');
  await expect(page.locator('h1')).toHaveCSS('visibility', 'visible');
});

test('enforces one automatic renderer while fullscreen moves between videos', async ({ extensionContext, extensionPage: page }) => {
  test.setTimeout(90_000);
  const hasWebGPU = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!hasWebGPU, 'WebGPU is unavailable in this browser/GPU configuration.');
  await setExtensionSettings(extensionContext);
  await page.goto('/media.html');
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(3);
  await page.locator('#fullscreen-same').click();
  await expect(page.locator('#same-video')).toHaveAttribute('data-anime4k-applied', 'true', { timeout: 60_000 });
  await expect(page.locator('#same-video').evaluate((video: HTMLVideoElement) => video.style.opacity)).resolves.toBe('0');
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('video[data-anime4k-applied="true"]')).toHaveCount(0);
  await page.locator('#fullscreen-cors').click();
  await expect(page.locator('#cors-video')).toHaveAttribute('data-anime4k-applied', 'true', { timeout: 60_000 });
  await expect(page.locator('#same-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
  await expect(page.locator('video[data-anime4k-applied="true"]')).toHaveCount(1);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('video[data-anime4k-applied="true"]')).toHaveCount(0);
});

test('releases WebGPU and overlay state across twenty real start-stop cycles', async ({ extensionContext, extensionPage: page }) => {
  test.setTimeout(240_000);
  const hasWebGPU = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!hasWebGPU, 'WebGPU is unavailable in this browser/GPU configuration.');
  await setExtensionSettings(extensionContext);
  await page.goto('/layers.html');
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);

  for (let cycle = 0; cycle < 20; cycle++) {
    await page.locator('#enter-fullscreen').click();
    await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true', { timeout: 60_000 });
    await expect(page.locator('video[data-anime4k-applied="true"]')).toHaveCount(1);
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
    await expect(page.locator('video[data-anime4k-applied="true"]')).toHaveCount(0);
    await expect(page.locator('#layer-video').evaluate((video: HTMLVideoElement) => video.style.opacity)).resolves.toBe('');
  }

  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(1);
});

test('does nothing in fullscreen when automatic enhancement is disabled', async ({ extensionContext, extensionPage: page }) => {
  await setExtensionSettings(extensionContext, false);
  await page.goto('/layers.html');
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-auto-fullscreen', 'true');
  await page.locator('#enter-fullscreen').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('player');
  await page.waitForTimeout(500);
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
  await page.evaluate(() => document.exitFullscreen());
});

test('runs frame generation without enhancement effects when mode is Off', async ({ extensionContext, extensionPage: page }) => {
  test.setTimeout(90_000);
  await setExtensionSettings(extensionContext, true, {
    mode: 'OFF',
    frameGenerationEnabled: true,
  });
  await page.goto('/layers.html');
  const enabled = await page.evaluate(() => document.fullscreenEnabled);
  test.skip(!enabled, 'This Chromium build does not expose the Fullscreen API in the current mode.');

  await page.locator('#enter-fullscreen').click();
  await expect(page.locator('#layer-video')).toHaveAttribute('data-anime4k-applied', 'true', { timeout: 60_000 });
  await expect(page.locator('#player > canvas')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('#layer-video').evaluate((video: HTMLVideoElement) => video.style.opacity)).resolves.toBe('0');

  await setExtensionSettings(extensionContext, true, {
    mode: 'OFF',
    frameGenerationEnabled: false,
  });
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-auto-fullscreen', 'true');
  await expect(page.locator('#layer-video').evaluate((video: HTMLVideoElement) => video.style.opacity)).resolves.toBe('');
  await page.waitForTimeout(500);
  await expect(page.locator('#layer-video')).not.toHaveAttribute('data-anime4k-applied', 'true');
  await page.evaluate(() => document.exitFullscreen());
});

test('reinjects after navigation without leaving overlay hosts on an empty page', async ({ extensionPage: page }) => {
  await page.goto('/media.html');
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(3);
  await page.goto('/empty.html');
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(0);
  await page.goBack();
  await expect(page.locator(OVERLAY_SELECTOR)).toHaveCount(3);
});
