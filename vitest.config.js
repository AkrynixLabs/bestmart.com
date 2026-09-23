import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Integration tests patch global fetch; keep each file in its own worker.
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      SUPABASE_URL: 'http://fake-supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-real',
    },
  },
})
