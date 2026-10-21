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
      thresholds: {
        statements: 95, branches: 90, functions: 95, lines: 95,
        'src/app/api/**/route.ts': {
          statements: 95, branches: 85, functions: 100, lines: 100,
        },
      },
    },
  },
})
