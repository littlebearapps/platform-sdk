import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/**'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 65,
      },
    },
  },
  resolve: {
    alias: {
      '@littlebearapps/platform-sdk/middleware': resolve(__dirname, 'src/middleware.ts'),
      '@littlebearapps/platform-sdk/patterns': resolve(__dirname, 'src/patterns.ts'),
      '@littlebearapps/platform-sdk/dynamic-patterns': resolve(__dirname, 'src/dynamic-patterns.ts'),
      '@littlebearapps/platform-sdk': resolve(__dirname, 'src/index.ts'),
    },
  },
});
