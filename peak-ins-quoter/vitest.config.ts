import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Enable globals for cleaner test syntax
    globals: true,
    // Use happy-dom for DOM testing if needed
    environment: 'happy-dom',
    // Include files matching these patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Exclude node_modules and build outputs
    exclude: ['node_modules', '.next', 'dist'],
    // Setup files to run before each test file
    setupFiles: ['./src/__tests__/setup.ts'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/__tests__/**',
        'src/types/**',
        'node_modules/**',
      ],
      // Coverage thresholds (start with reasonable defaults, increase over time)
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
