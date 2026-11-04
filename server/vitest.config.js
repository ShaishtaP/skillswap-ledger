import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret' },
    globalSetup: ['./tests/setup/globalSetup.js'],
    setupFiles: ['./tests/setup/db.js'],
    // Test files share one database server, so run them one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
