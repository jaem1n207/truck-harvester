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
      include: ['src/app/**/*.{ts,tsx}', 'src/v2/**/*.{ts,tsx}'],
      exclude: [
        'src/app/**/__tests__/**',
        'src/app/**/*.test.{ts,tsx}',
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
