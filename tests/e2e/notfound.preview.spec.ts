// Runs under the preview projects: astro preview serves dist/404.html with status 404 for
// unknown routes, as Workers static assets does with not_found_handling "404-page".
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("an unknown path returns 404 with the not-found page", async ({ page }) => {
  const response = await page.goto("/no-such-page/");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("This page is not in the record.")).toBeVisible();
  await expect(page.locator('main a[href="/manual/"]')).toBeVisible();
  await expect(page.locator('main a[href="/trails/"]')).toBeVisible();
  await expect(page.locator('main a[href="/search/"]')).toBeVisible();
});

test("the not-found page is axe WCAG 2.2 AA clean", async ({ page }) => {
  await page.goto("/no-such-page/");
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
