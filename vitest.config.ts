import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'client',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
          setupFiles: ['./src/tests/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          include: [
            'server/tests/**/*.test.ts',
            'server/tests/integration/**/*.test.ts',
          ],
          environment: 'node',
        },
      },
    ],
    coverage: { provider: 'v8' },
  },
  resolve: { alias: { '@shared': path.resolve(__dirname, 'shared') } },
});
