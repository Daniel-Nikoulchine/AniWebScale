import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const SOURCE_DIR = 'dist-firefox';
const PIPELINE_SOURCE = 'src/core/pipeline-loader.ts';

const ALLOWED_WARNING = {
  code: 'UNSAFE_VAR_ASSIGNMENT',
  file: 'content.js',
  message: 'Unsafe call to import for argument 0',
  description:
    'Due to both security and performance concerns, this may not be set using dynamic values which have not been adequately sanitized. This can lead to security issues or fairly serious performance degradation.',
};

const DANGEROUS_PATTERNS = [
  /(?<!typeof\s)\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
];

export function isAllowlistedWarning(warning) {
  return (
    warning.code === ALLOWED_WARNING.code &&
    warning.file === ALLOWED_WARNING.file &&
    warning.message === ALLOWED_WARNING.message &&
    warning.description === ALLOWED_WARNING.description
  );
}

export function validateLintOutput(lintJson) {
  const failures = [];

  if (lintJson.summary.errors > 0) {
    failures.push(`${lintJson.summary.errors} error(s) found`);
    for (const e of lintJson.errors) {
      failures.push(`  ERROR ${e.code}: ${e.message} (${e.file}:${e.line})`);
    }
  }

  if (lintJson.summary.notices > 0) {
    failures.push(`${lintJson.summary.notices} notice(s) found (not allowed)`);
    for (const n of lintJson.notices) {
      failures.push(`  NOTICE ${n.code}: ${n.message} (${n.file}:${n.line})`);
    }
  }

  const allowlisted = lintJson.warnings.filter((w) => isAllowlistedWarning(w));
  const unknown = lintJson.warnings.filter((w) => !isAllowlistedWarning(w));

  if (unknown.length > 0) {
    failures.push(`${unknown.length} unknown warning(s) found`);
    for (const w of unknown) {
      failures.push(`  WARNING ${w.code}: ${w.message} (${w.file}:${w.line})`);
    }
  }

  if (allowlisted.length > 1) {
    failures.push(`duplicate allowlisted warnings: ${allowlisted.length} found (expected exactly 1)`);
  }

  if (lintJson.summary.warnings !== 1) {
    failures.push(`expected exactly 1 warning, got ${lintJson.summary.warnings}`);
  }

  return failures;
}

export function verifyPipelineImports(sourcePath) {
  const source = readFileSync(sourcePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const nonLiteral = [];

  function walk(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      const arg = node.arguments[0];
      if (!ts.isStringLiteral(arg)) {
        const text = arg.getText(sourceFile);
        nonLiteral.push(text);
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
  return nonLiteral;
}

export function scanReleaseBundles(sourceDir, rootDir) {
  if (rootDir === undefined) rootDir = sourceDir;
  const failures = [];
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      const subFailures = scanReleaseBundles(fullPath, rootDir);
      failures.push(...subFailures);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const content = readFileSync(fullPath, 'utf8');
      const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/');
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
          failures.push(`${relativePath} contains dangerous pattern: ${pattern}`);
        }
      }
    }
  }
  return failures;
}

export function runLint() {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'cmd.exe' : 'npx';
  const args = isWin
    ? ['/c', 'npx.cmd', 'web-ext', 'lint', '--source-dir', SOURCE_DIR, '--output=json']
    : ['web-ext', 'lint', '--source-dir', SOURCE_DIR, '--output=json'];
  const raw = execFileSync(cmd, args, { encoding: 'utf8', timeout: 60_000 });
  return JSON.parse(raw);
}

const __filename = new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  console.log('Firefox store lint gate');
  console.log('======================');

  let exitCode = 0;

  console.log('\n1. Running web-ext lint...');
  try {
    const lintJson = runLint();
    const lintFailures = validateLintOutput(lintJson);
    if (lintFailures.length > 0) {
      exitCode = 1;
      for (const f of lintFailures) console.error(`  FAIL: ${f}`);
    } else {
      console.log('  PASS: lint allowlist check passed');
    }
  } catch (err) {
    exitCode = 1;
    console.error(`  FAIL: web-ext lint crashed: ${err.message}`);
  }

  console.log('\n2. Verifying pipeline import() specifiers...');
  const importFailures = verifyPipelineImports(PIPELINE_SOURCE);
  if (importFailures.length > 0) {
    exitCode = 1;
    for (const f of importFailures) console.error(`  FAIL: Non-literal import() specifier: ${f}`);
  } else {
    console.log('  PASS: all import() specifiers are string literals');
  }

  console.log('\n3. Scanning release bundles for dangerous patterns...');
  const scanFailures = scanReleaseBundles(SOURCE_DIR);
  if (scanFailures.length > 0) {
    exitCode = 1;
    for (const f of scanFailures) console.error(`  FAIL: ${f}`);
  } else {
    console.log('  PASS: no eval/new Function detected');
  }

  console.log('\n' + '='.repeat(40));
  if (exitCode === 0) {
    console.log('RESULT: PASS');
  } else {
    console.log('RESULT: FAIL');
  }
  process.exit(exitCode);
}
