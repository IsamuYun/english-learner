import { defineConfig, devices } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.E2E_PORT ?? 5173)
const API_PORT = Number(process.env.E2E_API_PORT ?? 3001)
const E2E_DB = resolve(__dirname, 'server/data/e2e.db')

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    // Always start a fresh server so the DB inode it opens matches the one
    // globalSetup just (re-)created. A stale reused server would still hold
    // an FD pointing at the deleted inode after globalSetup wipes the file.
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      DB_PATH: E2E_DB,
      PORT: String(API_PORT),
      HOST: '127.0.0.1',
    },
  },
})
