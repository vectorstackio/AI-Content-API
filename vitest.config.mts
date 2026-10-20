import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: ['**/*.d.ts', 'src/types/**', 'src/scripts/**', 'src/tests/**'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      // Full-source migration baseline; raise as route/orchestration tests are added.
      thresholds: { statements: 48, branches: 37, functions: 60, lines: 48 },
    },
  },
})
