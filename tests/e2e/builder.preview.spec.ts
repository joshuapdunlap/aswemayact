// Letter builder against the built site (preview-desktop-light), where no dev server can
// reload the page underneath the test: input typed before the script arrives is kept.
import { test, expect } from "@playwright/test";

test("what is typed before the script runs is kept, and a reload still starts clean", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const scripts = /\/_astro\/[^/]+\.js$/;
  await page.route(scripts, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/manual/write/", { waitUntil: "commit" });
  await page.fill("#agency", "City of Example");
  await expect(page.locator("#preview")).not.toContainText("City of Example"); // the script is held
  release();
  await expect(page.locator("#preview")).toContainText("City of Example");
  const today = await page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  await expect(page.locator("#request-date")).toHaveValue(today);
  await page.unroute(scripts);
  await page.reload();
  await expect(page.locator("#agency")).toHaveValue("");
  await expect(page.locator("#preview")).not.toContainText("City of Example");
});
