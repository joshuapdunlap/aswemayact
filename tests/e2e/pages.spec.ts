import { test, expect } from "@playwright/test";
import { ALL_ROUTES } from "./routes";

test("styleguide renders every component with marks and law blocks", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.locator(".trail-stop--action .mark")).toHaveText("■");
  await expect(page.locator(".step-list .law").first()).toContainText("§ 25-19-105");
  await expect(page.locator(".callout--warning")).toBeVisible();
});

test("styleguide is kept out of search indexes", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});

test("trail stop marks follow the five types", async ({ page }) => {
  await page.goto("/styleguide");
  const marks = { passage: "❝", record: "▭", concept: "○", finding: "→", action: "■" };
  for (const [type, mark] of Object.entries(marks)) {
    await expect(page.locator(`.trail-stop--${type} .mark`)).toHaveText(mark);
  }
});

test("sidenotes sit in the margin at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/styleguide");
  const note = page.locator("#fn-1");
  await expect(note).toBeVisible();
  const noteBox = (await note.boundingBox())!;
  const measureBox = (await page.locator(".measure").boundingBox())!;
  expect(noteBox.x).toBeGreaterThan(measureBox.x + measureBox.width);
  // Clicking the reference is a plain anchor jump; no popover above 900px.
  await expect(page.locator("#fnref-1")).not.toHaveAttribute("aria-expanded");
});

test("sidenotes are popovers at 375px: open on click, close on Esc", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/styleguide");
  const ref = page.locator("#fnref-1");
  const note = page.locator("#fn-1");
  await expect(ref).toHaveAttribute("aria-expanded", "false");
  await expect(note).toBeHidden();

  const box = (await ref.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);

  await ref.click();
  await expect(note).toBeVisible();
  await expect(ref).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(note).toBeHidden();
  await expect(ref).toHaveAttribute("aria-expanded", "false");
  await expect(ref).toBeFocused();

  // Keyboard: Enter on the focused reference opens it again.
  await page.keyboard.press("Enter");
  await expect(note).toBeVisible();
});

test("sidenote reference falls back to an in-page anchor without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  await page.goto("/styleguide");
  await expect(page.locator("#fnref-1")).toHaveAttribute("href", "#fn-1");
  await expect(page.locator("aside.sidenote#fn-1")).toBeVisible();
  await context.close();
});

test("every sidenote reference has a matching note and vice versa", async ({ page }) => {
  for (const path of ["/styleguide", "/styleguide-essay"]) {
    await page.goto(path);
    const refs = await page.locator('a[id^="fnref-"]').evaluateAll((els) => els.map((e) => e.id.slice(6)));
    const notes = await page.locator('aside.sidenote[id^="fn-"]').evaluateAll((els) => els.map((e) => e.id.slice(3)));
    expect(refs.length).toBeGreaterThan(0);
    expect([...refs].sort()).toEqual([...notes].sort());
    for (const n of refs) {
      await expect(page.locator(`#fnref-${n}`)).toHaveAttribute("href", `#fn-${n}`);
    }
  }
});

test("essay variant: sidenotes in the margin, no horizontal scroll at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/styleguide-essay");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "tests/e2e/__screenshots__/styleguide-essay-1280-light.png", fullPage: true });
  const measureBox = (await page.locator(".measure").boundingBox())!;
  const mainBox = (await page.locator("main").boundingBox())!;
  expect(measureBox.x).toBeGreaterThan(mainBox.x + 100); // columns 3–9, not 1–7
  for (const note of await page.locator("aside.sidenote").all()) {
    const box = (await note.boundingBox())!;
    expect(box.x).toBeGreaterThan(measureBox.x + measureBox.width);
    expect(box.x + box.width).toBeLessThanOrEqual(mainBox.x + mainBox.width + 0.5);
  }
});

for (const width of [375, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`styleguide screenshot ${width} ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/styleguide");
      await page.evaluate(() => document.fonts.ready);
      // No horizontal scroll at any width.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({
        path: `tests/e2e/__screenshots__/styleguide-${width}-${colorScheme}.png`,
        fullPage: true,
      });
    });
  }
}

test("manual index lists ten pages with reviewed dates", async ({ page }) => {
  await page.goto("/manual/");
  await expect(page.locator(".manual-index li")).toHaveCount(10);
  await expect(page.locator(".folio")).toContainText("Last reviewed");
});

test("the-clock states immediate access and the $25 rule appears on what-it-costs", async ({ page }) => {
  await page.goto("/manual/the-clock/");
  await expect(page.locator("main")).toContainText("three (3) working days");
  await page.goto("/manual/what-it-costs/");
  await expect(page.locator("main")).toContainText("$25");
  await expect(page.locator(".law").first()).toContainText("§ 25-19-105(d)(3)(A)");
});

test("manual pages carry a folio, law blocks and a sources list", async ({ page }) => {
  const reviewed: Record<string, string> = { "write-a-request": "11 Oct 2026" };
  for (const slug of ["your-rights", "who-may-request", "what-it-costs", "the-clock", "exemptions", "write-a-request", "denied", "meetings"]) {
    await page.goto(`/manual/${slug}/`);
    await expect(page.locator(".folio")).toContainText(`Last reviewed ${reviewed[slug] ?? "12 Oct 2026"}`);
    expect(await page.locator(".law").count()).toBeGreaterThan(0);
    expect(await page.locator(".manual-sources a").count()).toBeGreaterThan(0);
  }
});

test("printables lists the three printable pages with print buttons", async ({ page }) => {
  await page.goto("/manual/printables/");
  await expect(page.locator(".printable-sheet")).toHaveCount(3);
  await expect(page.locator(".printables-list li")).toHaveCount(3);
  await expect(page.locator("button.print-button").first()).toBeVisible();
  await expect(page.locator("main")).toContainText("Without JavaScript");
});

test("sources page renders twelve source cards", async ({ page }) => {
  await page.goto("/manual/sources/");
  await expect(page.locator(".source-card")).toHaveCount(12);
});

test("source cards sit in two columns at 1280px and one at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/manual/sources/");
  const cards = page.locator(".source-card");
  let [a, b] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!];
  expect(b.y).toBeCloseTo(a.y, 0);
  expect(b.x).toBeGreaterThan(a.x + a.width);

  await page.setViewportSize({ width: 375, height: 800 });
  [a, b] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!];
  expect(b.y).toBeGreaterThan(a.y + a.height - 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// ---- Task 8: front door, about, corrections, trails ----

test("front door has three entries in order and the epigraph", async ({ page }) => {
  await page.goto("/");
  const entries = page.locator(".entry h2");
  await expect(entries).toHaveText(["Get a record", "Follow a trail", "Why “As We May Act”"]);
  await expect(page.locator(".epigraph")).toContainText("trail blazers");
  await expect(page.locator(".recent li")).toHaveCount(5);
});

test("each trail has 5–8 typed stops and an action stop last", async ({ page }) => {
  for (const slug of ["the-lectern", "the-meeting", "the-camera"]) {
    await page.goto(`/trails/${slug}/`);
    const stops = page.locator(".trail-stop");
    const n = await stops.count();
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(8);
    await expect(stops.last()).toHaveClass(/trail-stop--action/);
  }
});

test("about names the editor and the licenses", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.locator("main")).toContainText("Joshua Dunlap");
  await expect(page.locator("main")).toContainText("CC BY 4.0");
  await expect(page.locator("main")).toContainText("CC BY-ND 4.0");
});

test("front door links each entry and shows the manual's last-reviewed date", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator(".entry h2 a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs).toEqual(["/manual/", "/trails/", "/about/"]);
  await expect(page.locator(".entry").first().locator('a[href="/manual/write/"]')).toHaveText("Draft a request letter →");
  await expect(page.locator(".epigraph")).toContainText("Vannevar Bush, 1945, p. 108");
  await expect(page.locator("main")).toContainText("Last reviewed 12 Oct 2026");
});

test("the essay's footnotes become sidenotes with no footnotes section left", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.locator("section.footnotes, [data-footnotes]")).toHaveCount(0);
  const refs = await page.locator('a[id^="fnref-"]').evaluateAll((els) => els.map((e) => e.id.slice(6)));
  const notes = await page.locator('aside.sidenote[id^="fn-"]').evaluateAll((els) => els.map((e) => e.id.slice(3)));
  expect(refs.length).toBeGreaterThan(5);
  expect([...refs].sort()).toEqual([...notes].sort());
  // Every note is a direct child of the measure, so it can float into the margin.
  const misplaced = await page.locator("aside.sidenote").evaluateAll((els) =>
    els.filter((e) => !e.parentElement?.classList.contains("measure")).length,
  );
  expect(misplaced).toBe(0);
});

test("about sidenotes sit in the margin at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/about/");
  const measureBox = (await page.locator(".measure").boundingBox())!;
  for (const note of await page.locator("aside.sidenote").all()) {
    const box = (await note.boundingBox())!;
    expect(box.x).toBeGreaterThan(measureBox.x + measureBox.width);
  }
});

test("trails index lists the three launch trails", async ({ page }) => {
  await page.goto("/trails/");
  const links = await page.locator(".trail-index a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect([...links].sort()).toEqual(["/trails/the-camera/", "/trails/the-lectern/", "/trails/the-meeting/"]);
});

test("a trail carries a kicker, a signature and the action links somewhere to act", async ({ page }) => {
  await page.goto("/trails/the-lectern/");
  await expect(page.locator(".kicker")).toHaveText("LITTLE ROCK · OCTOBER 2026");
  await expect(page.locator("main")).toContainText("Joshua Dunlap, editor");
  await expect(page.locator(".trail-stop--action a[href='/manual/write/']")).toHaveCount(1);
});

test("corrections lists the launch entry and the right of reply", async ({ page }) => {
  await page.goto("/corrections/");
  await expect(page.locator(".correction-entry", { hasText: "Launched with the front door" })).toHaveCount(1);
  await expect(page.locator("main")).toContainText("48 hours");
  await expect(page.locator("main a[href='mailto:editor@aswemayact.org']")).toHaveCount(1);
});

for (const width of [375, 1280]) {
  test(`task 8 screenshots at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [["front", "/"], ["about", "/about/"], ["trail-lectern", "/trails/the-lectern/"], ["corrections", "/corrections/"], ["trails", "/trails/"]]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `tests/e2e/__screenshots__/${name}-${width}-light.png`, fullPage: true });
    }
  });
}

// ---- Navigation ----

test("front door's running head names the site and does not link to itself", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".running-head .section-label")).toHaveText("As We May Act");
  await expect(page.locator('.running-head a[href="/"]')).toHaveCount(0);
});

test("every public route links home from the running head and carries the footer links", async ({ page }) => {
  for (const route of [...ALL_ROUTES, "/404/"]) {
    await page.goto(route);
    if (route !== "/") {
      await expect(page.locator('.running-head a[href="/"]'), route).toHaveText("As We May Act");
    }
    const footer = await page.locator(".site-footer nav a").evaluateAll((els) =>
      els.map((e) => [e.textContent, e.getAttribute("href")]),
    );
    expect(footer, route).toEqual([["About", "/about/"], ["Corrections", "/corrections/"], ["Search", "/search/"]]);
    await expect(page.locator('.site-footer a[href="mailto:editor@aswemayact.org"]'), route).toHaveCount(1);
    await expect(page.locator(".site-footer"), route).toContainText("CC BY 4.0");
  }
});

test("manual index points to the letter builder before the list", async ({ page }) => {
  await page.goto("/manual/");
  const lead = page.locator(".manual-lead");
  await expect(lead).toContainText("Ready to write?");
  await expect(lead.locator('a[href="/manual/write/"]')).toHaveCount(1);
  const leadBox = (await lead.boundingBox())!;
  const listBox = (await page.locator(".manual-index").boundingBox())!;
  expect(leadBox.y).toBeLessThan(listBox.y);
});

test("every page carries a folio: a review date, or the date of the issue", async ({ page }) => {
  const folios: Record<string, RegExp> = {
    "/": /^Last reviewed \d{1,2} \w{3} \d{4}$/,
    "/trails/": /^\w{3} \d{4}$/,
    "/trails/the-lectern/": /^\w{3} \d{4}$/,
    "/corrections/": /^\d{1,2} \w{3} \d{4}$/,
  };
  for (const [route, re] of Object.entries(folios)) {
    await page.goto(route);
    await expect(page.locator(".running-head .folio")).toHaveText(re);
  }
});

test("manual pages and trails index their sections in the margin at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/manual/your-rights/");
  const links = page.locator(".in-section a");
  expect(await links.count()).toBeGreaterThan(1);
  for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
    await expect(page.locator(href!)).toHaveCount(1);
  }
  await page.goto("/trails/the-lectern/");
  await expect(page.locator(".in-section li")).toHaveCount(await page.locator(".trail-stop").count());
  await expect(page.locator(".in-section .mark--action")).toHaveCount(1);
});
