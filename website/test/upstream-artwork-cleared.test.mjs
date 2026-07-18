import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

const read = (rel) => readFile(join(PUBLIC, rel), 'utf8');

describe('upstream artwork licensing blocker cleared', () => {
  it('index.html contains no upstream Anime4K demo artwork path', async () => {
    const html = await read('index.html');
    assert.ok(
      !html.includes('/assets/anime4k/main-comparison.png'),
      'index.html must not reference /assets/anime4k/main-comparison.png',
    );
  });

  it('index.html contains no bloc97 result link', async () => {
    const html = await read('index.html');
    assert.ok(
      !html.includes('bloc97/Anime4K/blob/master/results'),
      'index.html must not link to bloc97 upstream results',
    );
  });

  it('index.html contains no paid-launch replacement warning', async () => {
    const html = await read('index.html');
    const warningPatterns = [
      'replace these frames',
      'replace with commercially',
      'must be replaced before',
      'paid launch',
    ];
    for (const pattern of warningPatterns) {
      assert.ok(
        !html.includes(pattern),
        `index.html must not contain paid-launch warning: "${pattern}"`,
      );
    }
  });

  it('styles.css contains no upstream Anime4K demo artwork path', async () => {
    const css = await read('styles.css');
    assert.ok(
      !css.includes('/assets/anime4k/main-comparison.png'),
      'styles.css must not reference /assets/anime4k/main-comparison.png',
    );
  });

  it('owned SVG comparison plate exists under website/public/assets/owned/', async () => {
    let exists = false;
    try {
      const stat = await readFile(
        join(PUBLIC, 'assets', 'owned', 'comparison-plate.svg'),
      );
      exists = stat.length > 0;
    } catch {
      exists = false;
    }
    assert.ok(
      exists,
      'An owned SVG comparison plate must exist at website/public/assets/owned/comparison-plate.svg',
    );
  });
});
