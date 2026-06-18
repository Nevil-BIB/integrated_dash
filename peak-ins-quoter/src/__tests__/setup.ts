/**
 * Vitest setup file
 * Runs before each test file to configure the test environment
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest'

// Mock environment variables for tests
beforeAll(() => {
  // Set up common environment variables used in tests
  process.env.OPENROUTER_API_KEY = 'sk-or-test-key'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks()
})

// Restore all mocks after all tests
afterAll(() => {
  vi.restoreAllMocks()
})

// Add custom matchers if needed
// Example: expect.extend({ ... })
