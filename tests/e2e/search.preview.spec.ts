// Runs under the "preview" project only: search needs the Pagefind index, which exists
// only in a built dist/ (postbuild), not under astro dev.
import { test, expect } from "@playwright/test";

test("search finds the clock for “working days”", async ({ page }) => {
  await page.goto("/search/");
  await expect(page.locator("#search")).toBeVisible();
  await page.locator("#search input").fill("working days");
  await expect(page.locator('#search a[href^="/manual/the-clock/"]').first()).toBeVisible();
});

test("search results never include the styleguide", async ({ page }) => {
  await page.goto("/search/");
  // "Specimen" appears only on the two styleguide pages.
  await page.locator("#search input").fill("specimen");
  await expect(page.locator("#search .pagefind-ui__message")).toHaveText(/No results/);
  await expect(page.locator('#search a[href*="styleguide"]')).toHaveCount(0);
});

test("the running head links to search", async ({ page }) => {
  await page.goto("/manual/");
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search\/$/);
});
