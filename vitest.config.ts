import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    include: ['api/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
  },
});
