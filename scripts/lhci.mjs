// Runs Lighthouse CI with both configs (desktop, then mobile) on a Chrome found at run
// time: $CHROME_PATH if set, otherwise the Chromium that Playwright installed. Both configs
// always run, so a desktop failure cannot hide the mobile results; the exit code is
// non-zero if either failed.
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const chromePath = process.env.CHROME_PATH || chromium.executablePath();
// On Windows npx is npx.cmd, which only runs through a shell; the shell then needs the
// path quoted in case it has spaces (a user profile such as C:\Users\First Last).
const win = process.platform === "win32";
const failed = [];
for (const config of ["lighthouserc.json", "lighthouserc.mobile.json"]) {
  const run = spawnSync("npx", ["lhci", "autorun", `--config=${config}`, `--collect.chromePath=${win ? `"${chromePath}"` : chromePath}`], {
    shell: win,
    stdio: "inherit",
    env: { ...process.env, CHROME_PATH: chromePath }, // lhci's healthcheck looks here
  });
  if (run.status !== 0) failed.push(`${config} (exit ${run.status ?? run.signal})`);
}
if (failed.length) {
  console.error(`Lighthouse CI failed: ${failed.join(", ")}`);
  process.exit(1);
}
