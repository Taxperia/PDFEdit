import { defineConfig } from 'vitest/config'

export default defineConfig({
  // A non-root base catches regressions in font URLs on GitHub Pages.
  base: '/pdfedit-test/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
