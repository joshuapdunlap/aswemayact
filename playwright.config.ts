import { defineConfig, devices } from "@playwright/test";

// "dev" runs the functional specs against astro dev (fast, no build). The preview-*
// projects run the *.preview.spec.ts files against the built site (needed for Pagefind
// search, and the quality gates of Task 10 are measured on what ships); they share one
// server, which builds first, so it takes a minute to start.
//   preview-{mobile,desktop}-{light,dark}: a11y and layout gates at 375×812 and 1280×800
//     in each colour scheme; preview-desktop-light also runs the other preview specs.
//   preview-nojs: nojs.preview.spec.ts with JavaScript disabled, desktop, light.
const PREVIEW = "http://127.0.0.1:4322";
const mobile = { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } };
const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } };
const GATES = /(a11y|layout)\.preview\.spec\.ts$/;

export default defineConfig({
  testDir: "tests/e2e",
  projects: [
    {
      name: "dev",
      testIgnore: /\.preview\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4321" },
    },
    { name: "preview-mobile-light", testMatch: GATES, use: { ...mobile, colorScheme: "light", baseURL: PREVIEW } },
    { name: "preview-mobile-dark", testMatch: GATES, use: { ...mobile, colorScheme: "dark", baseURL: PREVIEW } },
    {
      name: "preview-desktop-light",
      testMatch: /\.preview\.spec\.ts$/,
      testIgnore: /nojs\.preview\.spec\.ts$/,
      use: { ...desktop, colorScheme: "light", baseURL: PREVIEW },
    },
    { name: "preview-desktop-dark", testMatch: GATES, use: { ...desktop, colorScheme: "dark", baseURL: PREVIEW } },
    {
      name: "preview-nojs",
      testMatch: /nojs\.preview\.spec\.ts$/,
      use: { ...desktop, colorScheme: "light", javaScriptEnabled: false, baseURL: PREVIEW },
    },
  ],
  webServer: [
    // --ignore-lock keeps astro dev/preview in the foreground and independent of any other
    // running server: Astro 7 otherwise detects a non-interactive shell or an existing lock and
    // backgrounds or skips itself, which Playwright reads as "exited early".
    {
      command: "npx astro dev --host 127.0.0.1 --port 4321 --ignore-lock",
      url: "http://127.0.0.1:4321",
      reuseExistingServer: !process.env.CI,
    },
    // build:test skips the external link probe: the real build already ran it, and probing
    // the same hosts twice in a minute earns 429s from the Wayback Machine.
    {
      command: "npm run build:test && npx astro preview --host 127.0.0.1 --port 4322 --ignore-lock",
      url: PREVIEW,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
