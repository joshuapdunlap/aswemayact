import { test, expect, type Page } from "@playwright/test";

// --- brief tests (verbatim) ---

test("builder updates preview live and never stores", async ({ page }) => {
  await page.goto("/manual/write/");
  await page.fill("#agency", "City of Example");
  await page.check("#type-contract");
  await expect(page.locator("#preview")).toContainText("City of Example");
  await expect(page.locator("#preview")).toContainText("contracts");
  await page.reload();
  await expect(page.locator("#agency")).toHaveValue("");
});
test("vague subject shows the Fayetteville note", async ({ page }) => {
  await page.goto("/manual/write/");
  await page.fill("#subject", "communications about the drone facility");
  await expect(page.locator(".callout--warning")).toContainText("Fayetteville");
});
test("sentence tooltips carry the basis", async ({ page }) => {
  await page.goto("/manual/write/");
  await expect(page.locator('#preview [data-basis="§ 25-19-105(a)(3)"]')).toBeVisible();
});

// --- additional tests ---

const TYPES = [
  "contract", "nda", "invoice", "purchase-order", "calendar",
  "email-text", "recording", "policy", "data-export", "other",
];

/** The browser's own calendar date, computed in the page (the builder's default). */
const localToday = (page: Page) =>
  page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

test("form has five labelled steps and every control has a label", async ({ page }) => {
  await page.goto("/manual/write/");
  const legends = await page.locator("form#builder > fieldset > legend").allTextContents();
  expect(legends.map((l) => l.replace(/\s+/g, " ").trim())).toEqual([
    "1. Who holds it",
    "2. What exactly",
    "3. Dates and format",
    "4. Your standing",
    "5. Fees and response",
  ]);
  for (const t of TYPES) await expect(page.locator(`#type-${t}`)).toHaveAttribute("type", "checkbox");
  const unlabelled = await page.locator("#builder input, #builder textarea, #builder select").evaluateAll((els) =>
    els.filter((e) => !(e as HTMLInputElement).labels?.length).map((e) => e.id || e.outerHTML),
  );
  expect(unlabelled).toEqual([]);
  // WCAG 2.2 SC 1.3.5: the requester's own fields name their purpose. The form never
  // submits, so the browser saves nothing.
  await expect(page.locator("#requester-name")).toHaveAttribute("autocomplete", "name");
  await expect(page.locator("#requester-email")).toHaveAttribute("autocomplete", "email");
  await expect(page.locator("#proxy-for")).toHaveAttribute("autocomplete", "off");
});

test("request date defaults to today (local calendar) and the letter is dated and typeset", async ({ page }) => {
  await page.goto("/manual/write/");
  await expect(page.locator("#request-date")).toHaveValue(await localToday(page));
  const preview = page.locator("#preview");
  await expect(preview).toHaveClass(/mono/);
  await expect(preview.locator(".letter__date")).toHaveCount(1);
  await expect(preview.locator(".letter__salutation")).toHaveText("To the custodian of records,");
  await expect(preview.locator("ol.letter__items > li")).toHaveCount(1);
  await expect(preview.locator(".letter__signature")).toContainText("Sincerely,");
  await expect(preview).toContainText("Nothing you typed was stored or sent.");
  await expect(preview).toContainText(/letter builder, v2026-10\./);
});

test("numbered items render one per document type, with the subject", async ({ page }) => {
  await page.goto("/manual/write/");
  await page.check("#type-contract");
  await page.check("#type-nda");
  await page.fill("#subject", "license-plate reader cameras");
  const items = page.locator("#preview ol.letter__items > li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(1)).toContainText("2. All non-disclosure agreements concerning license-plate reader cameras.");
});

test("placeholder note shows until step 2 says what is wanted", async ({ page }) => {
  await page.goto("/manual/write/");
  const note = page.locator("#placeholder-note");
  await expect(note).toBeVisible();
  await expect(note.locator(".callout--note")).toContainText("placeholder");
  await page.fill("#subject", "the 2025 budget");
  await expect(note).toBeHidden();
  await page.fill("#subject", "");
  await expect(note).toBeVisible();
  await page.check("#type-invoice");
  await expect(note).toBeHidden();
});

test("vague-subject warning hides once a document type is ticked", async ({ page }) => {
  await page.goto("/manual/write/");
  const warning = page.locator("#vague-warning");
  await expect(warning).toBeHidden();
  await page.fill("#subject", "communications about the drone facility");
  await expect(warning).toBeVisible();
  await page.check("#type-nda");
  await expect(warning).toBeHidden();
  await page.uncheck("#type-nda");
  await expect(warning).toBeVisible();
  await page.fill("#subject", "the non-disclosure agreement with the vendor");
  await expect(warning).toBeHidden();
});

test("basis label appears under a sentence on keyboard focus; proxy tooltip cites the opinions", async ({ page }) => {
  await page.goto("/manual/write/");
  const fee = page.locator('#preview [data-basis="§ 25-19-105(d)(3)(A)(iii)"]');
  await expect(fee).toHaveAttribute("tabindex", "0");
  await expect(fee).toHaveAttribute("title", /§ 25-19-105\(d\)\(3\)\(A\)\(iii\)/);
  const label = fee.locator(".basis");
  await expect(label).toBeHidden();
  await fee.focus();
  await expect(label).toBeVisible();
  await expect(label).toHaveText("§ 25-19-105(d)(3)(A)(iii)");

  await page.check("#standing-proxy");
  await page.fill("#proxy-for", "A. Reader");
  const standing = page.locator("#preview [data-basis]", { hasText: "on behalf of A. Reader" });
  await expect(standing).toHaveAttribute("title", /Op\. Att'y Gen\. 2008-191, 97-071, 96-190/);
});

test("electronic-format and original-media options add and remove their sentences", async ({ page }) => {
  await page.goto("/manual/write/");
  const preview = page.locator("#preview");
  await expect(page.locator("#electronic-format")).toBeChecked();
  await expect(preview).toContainText("readily available electronic format");
  await page.uncheck("#electronic-format");
  await expect(preview).not.toContainText("readily available electronic format");
  await expect(preview).not.toContainText("original media file");
  await page.check("#original-media");
  await expect(preview).toContainText("original media file");
});

test("copy puts the plain-text letter on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/manual/write/");
  await page.fill("#agency", "City of Example");
  await page.fill("#requester-name", "Pat Requester");
  await page.click("#copy");
  await expect(page.locator("#builder-status")).toContainText("Copied");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("City of Example\n\nTo the custodian of records,\n\nI am a citizen");
  expect(text).toContain("\n1. All records concerning the subject of this request.\n");
  expect(text).toMatch(/Sincerely,\nPat Requester\n$/);
  expect(text).not.toContain("§ 25-19-105(d)(3)(A)(iii)\n"); // no basis labels in the text
  expect(text).not.toContain("letter builder");
});

test("copy falls back to a hidden textarea without the Clipboard API", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    (window as unknown as { __copied: string[] }).__copied = [];
    const orig = document.execCommand.bind(document);
    document.execCommand = (cmd: string, ...rest: unknown[]) => {
      if (cmd === "copy") {
        const el = document.activeElement as HTMLTextAreaElement | null;
        (window as unknown as { __copied: string[] }).__copied.push(el?.value ?? "");
        return true;
      }
      return orig(cmd, ...(rest as [boolean, string]));
    };
  });
  await page.goto("/manual/write/");
  await page.fill("#agency", "City of Example");
  await page.click("#copy");
  await expect(page.locator("#builder-status")).toContainText("Copied");
  const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  expect(copied.length).toBe(1);
  expect(copied[0]).toContain("City of Example");
  await expect(page.locator("textarea[aria-hidden]")).toHaveCount(0);
});

test("download saves foia-request-{date}.txt with the letter", async ({ page }) => {
  await page.goto("/manual/write/");
  await page.fill("#request-date", "2026-10-09");
  await page.fill("#agency", "City of Example");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#download")]);
  expect(download.suggestedFilename()).toBe("foia-request-2026-10-09.txt");
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(path!, "utf8");
  expect(text.startsWith("9 October 2026\n\nCity of Example\n\nTo the custodian of records,")).toBe(true);
});

test("print calls window.print and the print stylesheet shows only the letter", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed++;
    };
  });
  await page.goto("/manual/write/");
  await page.click("#print");
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#preview")).toBeVisible();
  for (const sel of ["#builder", "#follow-up", "#deadline", ".running-head", ".site-footer", "#copy", "h1", ".letter__footer", "#placeholder-note"]) {
    await expect(page.locator(sel).first(), sel).toBeHidden();
  }
});

test("clear resets the form and the letter to the defaults", async ({ page }) => {
  await page.goto("/manual/write/");
  const initial = await page.locator("#preview").innerText();
  await page.fill("#agency", "City of Example");
  await page.check("#type-contract");
  await page.uncheck("#electronic-format");
  await page.check("#standing-proxy");
  await page.fill("#request-date", "2026-01-05");
  await page.click("#clear");
  await expect(page.locator("#agency")).toHaveValue("");
  await expect(page.locator("#type-contract")).not.toBeChecked();
  await expect(page.locator("#electronic-format")).toBeChecked();
  await expect(page.locator("#standing-citizen")).toBeChecked();
  await expect(page.locator("#request-date")).toHaveValue(await localToday(page));
  expect(await page.locator("#preview").innerText()).toBe(initial);
});

test.describe("an Arkansas evening", () => {
  test.use({ timezoneId: "America/Chicago" });

  test("the default date is the local day, not tomorrow's UTC date", async ({ page }) => {
    // 9:30 pm CDT on Sun 11 Oct 2026 is already 02:30 on 12 Oct in UTC.
    await page.clock.setFixedTime(new Date("2026-10-12T02:30:00Z"));
    await page.goto("/manual/write/");
    await expect(page.locator("#request-date")).toHaveValue("2026-10-11");
    await expect(page.locator("[data-deadline=request]")).toHaveText("Sun 11 Oct 2026");
  });
});

test("follow-up tabs switch between the silent and equivocal letters", async ({ page }) => {
  await page.goto("/manual/write/");
  const section = page.locator("#follow-up");
  const silent = section.getByRole("tab", { name: "If they stay silent" });
  const equivocal = section.getByRole("tab", { name: "If the answer is equivocal" });
  await expect(silent).toHaveAttribute("aria-selected", "true");
  await expect(section.getByRole("tabpanel")).toContainText("I have received neither the records nor such a certification");
  await equivocal.click();
  await expect(equivocal).toHaveAttribute("aria-selected", "true");
  await expect(section.getByRole("tabpanel")).toContainText("a clear statement that each record exists, is exempt, or does not exist");
  // Arrow keys move between tabs.
  await equivocal.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(silent).toBeFocused();
  await expect(silent).toHaveAttribute("aria-selected", "true");
  // The follow-ups follow the form.
  await page.fill("#agency", "City of Example");
  await expect(section.getByRole("tabpanel")).toContainText("City of Example");
});

test("deadline card counts three working days and says holidays are not skipped", async ({ page }) => {
  await page.goto("/manual/write/");
  await page.fill("#request-date", "2026-10-09");
  const card = page.locator("#deadline");
  await expect(card).toContainText("Fri 9 Oct 2026");
  await expect(card).toContainText("Wed 14 Oct 2026");
  await expect(card).toContainText("Send the follow-up for a silent response");
  await expect(card).toContainText(/weekends are skipped/i);
  await expect(card).toContainText(/holidays are not/i);
  await expect(card.locator('a[href="/manual/denied/"]')).toHaveCount(1);
});

test("nothing is stored and nothing is sent", async ({ page }) => {
  const requests: string[] = [];
  await page.goto("/manual/write/");
  await page.waitForLoadState("networkidle");
  page.on("request", (r) => requests.push(r.url()));
  await page.fill("#agency", "City of Example");
  await page.fill("#requester-name", "Pat Requester");
  await page.fill("#requester-email", "pat@example.org");
  await page.check("#type-contract");
  await page.click("#follow-up [role=tab] >> nth=1");
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  const stored = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    cookie: document.cookie,
  }));
  expect(stored).toEqual({ local: 0, session: 0, cookie: "" });
});

test("without JavaScript a notice points to the printables", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/manual/write/");
  const notice = page.locator(".nojs-notice");
  await expect(notice).toBeVisible();
  await expect(notice.locator('a[href="/manual/printables/"]')).toHaveCount(1);
  await expect(notice.locator('a[href="/manual/write-a-request/"]')).toHaveCount(1);
  await context.close();
});

test("two panes at 1280px: form on columns 1–6, letter on 7–12", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/manual/write/");
  const form = (await page.locator("#builder").boundingBox())!;
  const preview = (await page.locator("#preview").boundingBox())!;
  expect(preview.x).toBeGreaterThan(form.x + form.width);
  expect(Math.abs(form.width - preview.width)).toBeLessThan(80);
});
