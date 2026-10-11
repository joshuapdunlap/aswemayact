// No-JavaScript gate (Task 10): runs only in the preview-nojs project (javaScriptEnabled:
// false, 1280px, light). Everything but the builder, popovers, search and the theme toggle
// must work as plain HTML, and those four must say so or step aside.
import { test, expect } from "@playwright/test";
import { ROUTES } from "./routes";

test("the essay renders and its footnote references are working anchors", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.locator("main p").first()).toBeVisible();
  const ref = page.locator('a[href^="#fn-"]').first();
  await expect(ref).toBeVisible();
  const target = (await ref.getAttribute("href"))!;
  await ref.click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.locator(`aside.sidenote${target}`)).toBeVisible();
  await expect(page.locator(`aside.sidenote${target}`)).toBeInViewport();
});

test("every footnote reference on the essay points at a visible note", async ({ page }) => {
  await page.goto("/about/");
  for (const ref of await page.locator('a[href^="#fn-"]').all()) {
    await expect(ref).toBeVisible();
    await expect(page.locator(`aside.sidenote${await ref.getAttribute("href")}`)).toBeVisible();
  }
});

test("the builder shows its no-JavaScript notice", async ({ page }) => {
  await page.goto("/manual/write/");
  await expect(page.locator(".nojs-notice")).toBeVisible();
  await expect(page.locator(".nojs-notice a[href='/manual/printables/']")).toBeVisible();
});

test("the theme toggle is absent without JavaScript", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-theme-toggle]")).toBeHidden();
});

test("the search page shows its no-JavaScript line", async ({ page }) => {
  await page.goto("/search/");
  // A CSS locator: Playwright's text engine skips <noscript> content.
  const line = page.locator("main noscript p");
  await expect(line).toBeVisible();
  await expect(line).toContainText("Search needs JavaScript.");
  await expect(page.locator("main a[href='/manual/']")).toBeVisible();
});

for (const route of ROUTES) {
  test(`content is visible without JavaScript: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await page.evaluate(() => (document.querySelector("main")?.textContent ?? "").trim().length)).toBeGreaterThan(40);
  });
}
