import { defineConfig, devices } from '@playwright/test'

// Checks run against the built site (next start), never the dev server.
// Chromium renders WebGL in software (SwiftShader) so the map really draws headless;
// without it the canvas is blank and a smoke test would pass for the wrong reason.
// A port of Truffle's own, so a dev server of another project on a common port is never tested by mistake.
const PORT = Number(process.env.PORT ?? 3427)
const gl = { launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } }

export default defineConfig({
  testDir: 'e2e',
  // The pull request runner has two cores and draws the map in software: one page at a time there, given longer.
  timeout: process.env.CI ? 150_000 : 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 4,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, ...gl },
  webServer: { command: `npx next start -p ${PORT}`, port: PORT, reuseExistingServer: !process.env.CI, timeout: 120_000 },
  projects: [
    { name: 'qa', testMatch: /qa\.spec\.ts/, use: { ...devices['Desktop Chrome'], ...gl } },
    { name: 'smoke', testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Chrome'], ...gl } },
    { name: 'shots', testMatch: /shots\.spec\.ts/, use: { ...devices['Desktop Chrome'], ...gl } },
  ],
})
