import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      provider: playwright(),
    },
    coverage: {
      exclude: ['test/**'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
    },
    globals: true,
    include: ['test/spec/test.ts', 'test/spec/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
