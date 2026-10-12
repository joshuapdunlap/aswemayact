// Responsive gate (Task 10, spec §4.3): runs against the built site in the four
// preview-{mobile,desktop}-{light,dark} projects; width and theme come from the project.
import { test, expect } from "@playwright/test";
import { ALL_ROUTES } from "./routes";
import { hasNoHorizontalScroll, settle, widthClass } from "./helpers";

for (const route of ALL_ROUTES) {
  test(`no horizontal scroll: ${route}`, async ({ page }) => {
    await settle(page, route);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });
}

test("mobile: builder preview below form, no horizontal scroll, no sidenote column", async ({ page }) => {
  test.skip(widthClass(page) !== "mobile", "375px layout");
  await page.goto("/manual/write/");
  await page.fill("#subject", "communications about the drone facility");
  const form = (await page.locator("#builder").boundingBox())!;
  const prev = (await page.locator("#preview").boundingBox())!;
  expect(prev.y).toBeGreaterThan(form.y + form.height - 1);
  expect(await hasNoHorizontalScroll(page)).toBe(true);
  const small = await page
    .locator("#builder input, #builder button, #copy, #download, #print, #clear, #follow-up [role=tab]")
    .evaluateAll((els) =>
      els
        .map((e) => ({ id: e.id || e.textContent, r: e.getBoundingClientRect() }))
        // A control that is not rendered (the proxy name until "for someone else" is
        // chosen) is not a target; every rendered one must be at least 24×24.
        .filter(({ r }) => r.width + r.height > 0 && (r.width < 24 || r.height < 24))
        .map(({ id }) => id),
    );
  expect(small).toEqual([]);

  await page.goto("/about/");
  await expect(page.locator("aside.sidenote").first()).toBeHidden();
  expect(await hasNoHorizontalScroll(page)).toBe(true);
});
