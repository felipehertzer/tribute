import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: ['test/spec/**/*.ts'],
  coverageConfig: {
    include: ['src/**/*.ts'],
    reportDir: 'coverage',
    reporters: ['text', 'lcov'],
    threshold: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  plugins: [esbuildPlugin({ ts: true })],
};
