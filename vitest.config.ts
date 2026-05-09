import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.ts', 'client/src/tests/**/*.test.ts'],
    coverage: { provider: 'v8' }
  },
  resolve: { alias: { '@shared': path.resolve(__dirname, 'shared') } }
});
