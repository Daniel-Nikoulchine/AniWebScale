/**
 * Worker .d.ts drift guard.
 *
 * The worker is plain JS with no runtime types; the `.d.ts` mirror is the
 * only thing tests and tooling see. This parses the worker's module-scope
 * exports and the mirror's declarations and fails when they diverge — a new
 * worker export without a declaration (or a stale declaration) is caught here
 * instead of as an implicit `any` in a test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const workerJs = readFileSync(join(here, '../src/worker/realesrgan-inference-worker.js'), 'utf8');
const workerDts = readFileSync(join(here, '../src/worker/realesrgan-inference-worker.d.ts'), 'utf8');

function workerExportNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/^export\s+const\s+([A-Za-z0-9_$]+)/gm)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

function declarationNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/^export\s+declare\s+(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/gm)) {
    names.add(match[1]);
  }
  return names;
}

describe('worker .d.ts drift', () => {
  const exported = workerExportNames(workerJs);
  const declared = declarationNames(workerDts);

  it('every worker export is declared', () => {
    const missing = [...exported].filter(name => !declared.has(name)).sort();
    expect(missing).toEqual([]);
  });

  it('every declaration names a real worker export', () => {
    const stale = [...declared].filter(name => !exported.has(name)).sort();
    expect(stale).toEqual([]);
  });
});
