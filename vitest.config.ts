import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/v2/**/*.{ts,tsx}'],
      exclude: [
        'src/v2/**/__tests__/**',
        'src/v2/**/*.test.{ts,tsx}',
        'src/v2/**/AGENTS.md',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
})
