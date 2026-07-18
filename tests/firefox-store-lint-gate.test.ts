import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAllowlistedWarning, validateLintOutput, verifyPipelineImports, scanReleaseBundles } from '../scripts/firefox-store-lint-gate.mjs';

const execFileAsync = promisify(execFile);

const LINT_SCRIPT = 'scripts/firefox-store-lint-gate.mjs';
const SOURCE_DIR = 'dist-firefox';
const PIPELINE_SOURCE = 'src/core/pipeline-loader.ts';

const EXACT_WARNING = {
  _type: 'warning',
  code: 'UNSAFE_VAR_ASSIGNMENT',
  message: 'Unsafe call to import for argument 0',
  description:
    'Due to both security and performance concerns, this may not be set using dynamic values which have not been adequately sanitized. This can lead to security issues or fairly serious performance degradation.',
  column: 2984,
  file: 'content.js',
  line: 1,
};

describe('firefox-store-lint-gate', () => {
  describe('lint JSON allowlist logic (pure function)', () => {
    it('rejects when errors are present', () => {
      const output = {
        count: 1,
        summary: { errors: 1, notices: 0, warnings: 0 },
        errors: [{ code: 'MANIFEST_PERMISSIONS', message: 'bad', file: 'manifest.json', line: 1 }],
        notices: [],
        warnings: [],
      };
      const failures = validateLintOutput(output);
      expect(failures.some((f: string) => f.includes('error(s)'))).toBe(true);
    });

    it('rejects unknown warning codes', () => {
      const output = {
        count: 1,
        summary: { errors: 0, notices: 0, warnings: 1 },
        errors: [],
        notices: [],
        warnings: [{ code: 'SOME_NEW_WARNING', message: 'oops', file: 'content.js', line: 1 }],
      };
      const failures = validateLintOutput(output);
      expect(failures.some((f: string) => f.includes('unknown warning'))).toBe(true);
    });

    it('rejects allowlisted warning in wrong file', () => {
      const output = {
        count: 1,
        summary: { errors: 0, notices: 0, warnings: 1 },
        errors: [],
        notices: [],
        warnings: [
          {
            code: 'UNSAFE_VAR_ASSIGNMENT',
            message: 'Unsafe call to import for argument 0',
            description: EXACT_WARNING.description,
            file: 'background.js',
            line: 1,
          },
        ],
      };
      const failures = validateLintOutput(output);
      expect(failures.some((f: string) => f.includes('unknown warning'))).toBe(true);
    });

    it('rejects allowlisted warning with wrong message', () => {
      const output = {
        count: 1,
        summary: { errors: 0, notices: 0, warnings: 1 },
        errors: [],
        notices: [],
        warnings: [
          {
            code: 'UNSAFE_VAR_ASSIGNMENT',
            message: 'Different message text',
            description: EXACT_WARNING.description,
            file: 'content.js',
            line: 1,
          },
        ],
      };
      const failures = validateLintOutput(output);
      expect(failures.some((f: string) => f.includes('unknown warning'))).toBe(true);
    });

    it('rejects allowlisted warning with wrong description', () => {
      const output = {
        count: 1,
        summary: { errors: 0, notices: 0, warnings: 1 },
        errors: [],
        notices: [],
        warnings: [
          {
            code: 'UNSAFE_VAR_ASSIGNMENT',
            message: EXACT_WARNING.message,
            description: 'A different description',
            file: 'content.js',
            line: 1,
          },
        ],
      };
      const failures = validateLintOutput(output);
      expect(failures.some((f: string) => f.includes('unknown warning'))).toBe(true);
    });

    it('rejects when notices are present', () => {
      const output = {
        count: 1,
        summary: { errors: 0, notices: 1, warnings: 0 },
        errors: [],
        notices: [{ code: 'NOTICE_THING', message: 'info', file: 'content.js', line: 1 }],
        warnings: [],
      };
      const failures = validateLintOutput(output);
      expect(failures.some((f: string) => f.includes('notice(s)'))).toBe(true);
    });

    it('rejects when warning count is not exactly 1', () => {
      const output = {
        count: 0,
        summary: { errors: 0, notices: 0, warnings: 0 },
        errors: [],
        notices: [],
        warnings: [],
      };
      const failures = validateLintOutput(output);
      expect(failures.some((f: string) => f.includes('expected exactly 1 warning'))).toBe(true);
    });

    it('rejects duplicate allowlisted warnings', () => {
      const output = {
        count: 2,
        summary: { errors: 0, notices: 0, warnings: 2 },
        errors: [],
        notices: [],
        warnings: [
          {
            code: 'UNSAFE_VAR_ASSIGNMENT',
            message: EXACT_WARNING.message,
            description: EXACT_WARNING.description,
            file: 'content.js',
            line: 1,
          },
          {
            code: 'UNSAFE_VAR_ASSIGNMENT',
            message: EXACT_WARNING.message,
            description: EXACT_WARNING.description,
            file: 'content.js',
            line: 50,
          },
        ],
      };
      const failures = validateLintOutput(output);
      expect(failures.some((f: string) => f.includes('duplicate allowlisted'))).toBe(true);
    });

    it('accepts exactly the known allowlisted warning', () => {
      const output = {
        count: 1,
        summary: { errors: 0, notices: 0, warnings: 1 },
        errors: [],
        notices: [],
        warnings: [EXACT_WARNING],
      };
      const failures = validateLintOutput(output);
      expect(failures).toHaveLength(0);
    });

    it('isAllowlistedWarning matches exact fingerprint', () => {
      expect(isAllowlistedWarning(EXACT_WARNING)).toBe(true);
    });

    it('isAllowlistedWarning rejects changed text', () => {
      expect(isAllowlistedWarning({ ...EXACT_WARNING, message: 'changed' })).toBe(false);
      expect(isAllowlistedWarning({ ...EXACT_WARNING, description: 'changed' })).toBe(false);
      expect(isAllowlistedWarning({ ...EXACT_WARNING, file: 'other.js' })).toBe(false);
      expect(isAllowlistedWarning({ ...EXACT_WARNING, code: 'OTHER' })).toBe(false);
    });
  });

  describe('pipeline-loader static import verification (TypeScript AST)', () => {
    it('all dynamic import() specifiers in pipeline-loader.ts are string literals', () => {
      const nonLiteral = verifyPipelineImports(PIPELINE_SOURCE);
      expect(nonLiteral).toEqual([]);
    });

    it('rejects import(variable) in fixture', () => {
      const tmpDir = path.join('.tmp', 'test-import-variable');
      mkdirSync(tmpDir, { recursive: true });
      const fixture = path.join(tmpDir, 'bad.ts');
      writeFileSync(fixture, 'const x = "a"; const m = import(x);\n');
      try {
        const nonLiteral = verifyPipelineImports(fixture);
        expect(nonLiteral).toEqual(['x']);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("rejects import('fixed/'+variable) in fixture", () => {
      const tmpDir = path.join('.tmp', 'test-import-concat');
      mkdirSync(tmpDir, { recursive: true });
      const fixture = path.join(tmpDir, 'bad.ts');
      writeFileSync(fixture, 'const x = "a"; const m = import("fixed/" + x);\n');
      try {
        const nonLiteral = verifyPipelineImports(fixture);
        expect(nonLiteral).toEqual(['"fixed/" + x']);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('release bundle security scan (recursive)', () => {
    it('dist-firefox top-level JS files contain no dangerous patterns', () => {
      const failures = scanReleaseBundles(SOURCE_DIR);
      expect(failures).toEqual([]);
    });

    it('rejects nested dangerous file in temp directory', () => {
      const tmpDir = path.join('.tmp', 'test-bundle-scan');
      const nestedDir = path.join(tmpDir, 'chunks');
      mkdirSync(nestedDir, { recursive: true });
      const safeFile = path.join(tmpDir, 'safe.js');
      const dangerousFile = path.join(nestedDir, 'danger.js');
      writeFileSync(safeFile, 'console.log("safe");\n');
      writeFileSync(dangerousFile, 'eval("bad");\n');
      try {
        const failures = scanReleaseBundles(tmpDir);
        expect(failures).toHaveLength(1);
        expect(failures[0]).toContain('chunks/danger.js');
        expect(failures[0]).toContain('dangerous pattern');
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('lint gate script existence', () => {
    it('lint gate script exists and is executable', () => {
      const { statSync } = require('node:fs');
      expect(() => statSync(LINT_SCRIPT)).not.toThrow();
    });

    it('lint gate script exits 0 on current dist-firefox', async () => {
      const { stdout, stderr } = await execFileAsync('node', [LINT_SCRIPT], {
        timeout: 60_000,
      });
      expect(stdout + stderr).not.toMatch(/FAIL/);
    }, 60_000);
  });
});
