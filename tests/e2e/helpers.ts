import { expect, type Page } from "@playwright/test";

/** True when the document is no wider than the viewport. */
export async function hasNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

/**
 * Put a route into the state worth checking: the builder with a subject typed and a
 * basis tooltip focused, the search page with results showing. Other routes as loaded.
 */
export async function settle(page: Page, route: string): Promise<void> {
  await page.goto(route);
  if (route === "/manual/write/") {
    await page.fill("#subject", "communications about the drone facility");
    await page.locator('#preview [data-basis="§ 25-19-105(e)"]').focus();
  }
  if (route === "/search/") {
    await page.locator("#search input").fill("working days");
    await expect(page.locator("#search .pagefind-ui__result").first()).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
}

/** "mobile" for the 375px projects, "desktop" otherwise. */
export function widthClass(page: Page): "mobile" | "desktop" {
  return (page.viewportSize()?.width ?? 1280) < 900 ? "mobile" : "desktop";
}
