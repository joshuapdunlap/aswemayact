// Accessibility gate (Task 10, spec §4.5–4.6, §9): runs against the built site in the four
// preview-{mobile,desktop}-{light,dark} projects, so each route is axe-checked once per
// width and theme. Width and colour scheme come from the project, not from the test.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import { ALL_ROUTES } from "./routes";
import { settle, widthClass } from "./helpers";

for (const route of ALL_ROUTES) {
  test(`axe WCAG 2.2 AA clean: ${route}`, async ({ page }, testInfo) => {
    // Two axe passes over a long page (the printables run all four sheets) can pass 30 s
    // on the mobile projects when the whole suite runs in parallel.
    test.setTimeout(60_000);
    await settle(page, route);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);

    // Best-practice findings are recorded, not enforced: written beside the test's output.
    const bp = await new AxeBuilder({ page }).withTags(["best-practice"]).analyze();
    const findings = bp.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(" ")),
    }));
    writeFileSync(testInfo.outputPath("best-practice.json"), JSON.stringify({ project: testInfo.project.name, route, findings }, null, 2));
  });
}

// WCAG 2.2 SC 2.5.8 Target Size (Minimum). Exempt only a target "in a sentence": an
// inline element whose nearest block ancestor also holds text that is not itself a link
// or button. A list of bare links is not exempt.
for (const route of ["/", "/manual/the-clock/", "/trails/the-lectern/", "/manual/write/"]) {
  test(`targets are at least 24×24 px: ${route}`, async ({ page }) => {
    await settle(page, route);
    const small = await page.locator('a, button, input, [tabindex="0"]').evaluateAll((els) =>
      els.flatMap((el) => {
        const style = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (style.visibility === "hidden" || style.display === "none" || r.width === 0 || r.height === 0) return [];
        if (style.clipPath === "inset(50%)") return []; // visually hidden; present to AT only
        if (r.width >= 24 && r.height >= 24) return [];
        if (style.display === "inline") {
          let block = el.parentElement;
          while (block && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
          if (block) {
            const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
            for (let t = walker.nextNode(); t; t = walker.nextNode()) {
              const owner = t.parentElement?.closest("a, button");
              if ((t.textContent ?? "").trim().length > 0 && !(owner && block.contains(owner))) return [];
            }
          }
        }
        return [`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} “${(el.textContent ?? "").trim().slice(0, 30)}” ${Math.round(r.width)}×${Math.round(r.height)}`];
      }),
    );
    expect(small).toEqual([]);
  });
}

// WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum): no sticky or fixed element covers the
// focused control. The builder's letter pane is sticky at ≥ 900px.
test("focus is never obscured by sticky or fixed elements on the builder", async ({ page }) => {
  test.skip(widthClass(page) !== "desktop", "the sticky letter pane exists at ≥ 900px");
  await page.goto("/manual/write/");
  const obscured: string[] = [];
  let focused = 0;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "";
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1);
      const label = `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} “${(el.textContent ?? "").trim().slice(0, 30)}”`;
      const top = document.elementFromPoint(x, y);
      if (!top) return `${label}: centre off screen`;
      if (el.contains(top) || top.contains(el)) return null;
      for (let n: Element | null = top; n; n = n.parentElement) {
        const pos = getComputedStyle(n).position;
        if ((pos === "sticky" || pos === "fixed") && !n.contains(el)) {
          return `${label}: covered by ${n.tagName.toLowerCase()}.${[...n.classList].join(".")}`;
        }
      }
      return null;
    });
    if (hit !== "") focused++;
    if (hit) obscured.push(hit);
  }
  expect(focused).toBe(40);
  expect(obscured).toEqual([]);
});

// The only animation is the cross-document view transition; reduced motion turns it off.
test("reduced motion disables the view transition", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "preview-desktop-light", "media-query check; one project is enough");
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--motion").trim())).toBe("1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--motion").trim())).toBe("0");
  // And the stylesheet itself: a reduced-motion block holds @view-transition { navigation: none }.
  const navigationOff = await page.evaluate(() => {
    const walk = (rules: CSSRuleList): boolean =>
      [...rules].some((r) => {
        if (r instanceof CSSMediaRule && r.conditionText.includes("prefers-reduced-motion: reduce")) {
          return [...r.cssRules].some((inner) => inner.cssText.replace(/\s+/g, " ").includes("@view-transition { navigation: none; }"));
        }
        return "cssRules" in r && walk((r as CSSGroupingRule).cssRules);
      });
    return [...document.styleSheets].some((s) => walk(s.cssRules));
  });
  expect(navigationOff).toBe(true);
});
