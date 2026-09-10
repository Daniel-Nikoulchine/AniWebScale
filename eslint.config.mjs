import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Per-target global sets. The broad `sharedGlobals` stays the default so no
// existing file suddenly loses a global; the narrow blocks below scope
// Node-only and browser-only scripts to the globals they actually use.
const browserGlobals = {
  ...globals.browser,
  ...globals.webextensions,
};
const nodeGlobals = {
  ...globals.node,
};
const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
  ...globals.webextensions,
};

export default [
  {
    ignores: [
      '.generated/**',
      '.tmp/**',
      'artifacts/**',
      'dist-*/**',
      'native/**',
      'node_modules/**',
      'public/**',
      'website/.wrangler/**',
      'website/artifacts/**',
      'website/node_modules/**',
      'website/public/**',
      'website/worker-configuration.d.ts',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: sharedGlobals,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Build, generator, test-runner and website tooling scripts run on Node.
    files: ['scripts/**/*.{js,mjs,cjs}', 'tests/**/*.{js,mjs,cjs}', 'bench/**/*.{js,mjs,cjs}', 'website/scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    // website/client runs in the browser; keep the browser + web extension set.
    files: ['website/client/**/*.{js,mjs}'],
    languageOptions: {
      globals: browserGlobals,
    },
  },
  {
    files: ['**/*.cjs', 'webpack.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: sharedGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true, ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/unbound-method': 'error',
    },
  },
  {
    // Bench TS lives outside the main tsconfig (tsconfig.bench.json); type-aware
    // linting needs a project, so parse without project service and rely on
    // `npm run typecheck:bench` for types.
    files: ['tests/bench/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: false,
      },
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['tests/e2e/**/*.ts'],
    rules: {
      // Playwright fixture factories require an object destructuring pattern,
      // including when the factory has no fixture dependencies.
      'no-empty-pattern': 'off',
    },
  },
];
