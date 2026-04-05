/**
 * Vitest configuration for Solidity Smart Audit.
 * Runs server-side tests with Node environment.
 * Integration tests that hit Postgres require DATABASE_URL to be set.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Load .env for integration tests — does not override CI env vars
    env: { NODE_ENV: 'test' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
