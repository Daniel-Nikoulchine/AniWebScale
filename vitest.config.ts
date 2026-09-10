import { defineConfig } from 'vitest/config';
import { GENERATED_ALIASES } from './scripts/webpack-aliases.cjs';

export default defineConfig({
  resolve: {
    // Same map webpack.config.js uses (webpack.config.js adds a trailing `$`
    // to each key, which vitest also accepts).
    alias: { ...GENERATED_ALIASES },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: false,
    restoreMocks: true,
  },
  // E2E-gated branches (typeof __ANIME4K_E2E__ guards) stay testable in unit
  // tests. The default run sees the flag as true; `VITEST_E2E=false`
  // (npm run test:prod) exercises the production branch. Production webpack
  // builds keep the real flag from DefinePlugin.
  define: {
    __ANIME4K_E2E__: JSON.stringify(process.env.VITEST_E2E !== 'false'),
  },
});
