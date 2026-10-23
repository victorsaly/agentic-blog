// Why: one test runner for scripts, agents and site logic; tests sit next to the code they test.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'agents/**/*.test.ts', 'site/src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
