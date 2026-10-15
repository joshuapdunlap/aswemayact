import {
  archiveList,
  archivedUrls,
  changedPages,
  dedupeUrls,
  externalLinks,
  pagePathFromDist,
  parseArchiveArgs,
  archiveStopReason,
  archiveKeys,
  saveRequest,
  saveApiError,
} from "../../src/lib/archive";

const PAGES = [
  "/",
  "/404/",
  "/about/",
  "/corrections/",
  "/manual/",
  "/manual/the-clock/",
  "/manual/denied/",
  "/manual/sources/",
  "/manual/write/",
  "/search/",
  "/styleguide/",
  "/styleguide-essay/",
  "/trails/",
  "/trails/the-camera/",
  "/trails/the-lectern/",
];

test("pagePathFromDist maps built files to site paths", () => {
  expect(pagePathFromDist("dist/index.html")).toBe("/");
  expect(pagePathFromDist("dist/manual/the-clock/index.html")).toBe("/manual/the-clock/");
  expect(pagePathFromDist("dist/404.html")).toBe("/404/");
});

test("with no deployed tag every page is submitted, except the excluded ones", () => {
  const pages = changedPages(null, PAGES);
  expect(pages).toContain("/");
  expect(pages).toContain("/trails/the-lectern/");
  expect(pages).not.toContain("/styleguide/");
  expect(pages).not.toContain("/styleguide-essay/");
  expect(pages).not.toContain("/search/");
  expect(pages).not.toContain("/404/");
});

test("a content change selects its page and the index that lists it", () => {
  expect(changedPages(["src/content/manual/the-clock.md"], PAGES)).toEqual(["/manual/", "/manual/the-clock/"]);
  expect(changedPages(["src/content/trails/the-camera.md"], PAGES)).toEqual(["/trails/", "/trails/the-camera/"]);
  expect(changedPages(["src/content/sources/legiscan-arkansas.md"], PAGES)).toEqual(["/manual/", "/manual/sources/"]);
  expect(changedPages(["src/content/essays/why-as-we-may-act.md"], PAGES)).toEqual(["/about/"]);
  expect(changedPages(["src/content/corrections/2026-10-12-clock.md"], PAGES)).toEqual(["/corrections/"]);
  expect(changedPages(["src/data/recent.json"], PAGES)).toEqual(["/"]);
});

test("a page file selects its route; a dynamic route selects the pages under it", () => {
  expect(changedPages(["src/pages/about.astro"], PAGES)).toEqual(["/about/"]);
  expect(changedPages(["src/pages/index.astro"], PAGES)).toEqual(["/"]);
  expect(changedPages(["src/pages/manual/index.astro"], PAGES)).toEqual(["/manual/"]);
  expect(changedPages(["src/pages/trails/[slug].astro"], PAGES)).toEqual(["/trails/the-camera/", "/trails/the-lectern/"]);
});

test("layout, style, component, library and public changes select every page", () => {
  for (const f of ["src/layouts/Periodical.astro", "src/styles/tokens.css", "src/components/Folio.astro", "src/lib/dates.ts", "public/robots.txt", "astro.config.mjs"]) {
    expect(changedPages([f], PAGES)).toEqual(changedPages(null, PAGES));
  }
});

test("changes outside the site select nothing; a changed styleguide is still excluded", () => {
  expect(changedPages(["tests/unit/archive.test.ts", "scripts/check-content.ts", "docs/x.md", "package.json"], PAGES)).toEqual([]);
  expect(changedPages(["src/pages/styleguide.astro", "src/pages/search.astro"], PAGES)).toEqual([]);
  expect(changedPages([], PAGES)).toEqual([]);
});

test("pages missing from the build are not submitted", () => {
  expect(changedPages(["src/content/trails/the-gone.md"], PAGES)).toEqual(["/trails/"]);
});

test("externalLinks reads hrefs only, decodes entities and skips the site and the archive", () => {
  const html = `
    <svg xmlns="http://www.w3.org/2000/svg"></svg>
    <a href="https://example.org/a?x=1&amp;y=2">a</a>
    <a href='https://example.org/b'>b</a>
    <a href="/manual/">internal</a>
    <a href="https://aswemayact.org/about/">self</a>
    <a href="https://web.archive.org/web/2024/https://example.org/c">archived</a>
    <a href="mailto:editor@aswemayact.org">mail</a>
    <p>https://example.org/plain-text-is-not-a-citation</p>`;
  expect(externalLinks(html)).toEqual(["https://example.org/a?x=1&y=2", "https://example.org/b"]);
});

test("dedupeUrls keeps first-seen order and ignores fragments", () => {
  expect(
    dedupeUrls(["https://a.org/x", "https://b.org/", "https://a.org/x#p2", "https://a.org/x", "https://a.org/y"]),
  ).toEqual(["https://a.org/x", "https://b.org/", "https://a.org/y"]);
});

test("archivedUrls reads saved URLs from the log, skipping failures and broken lines", () => {
  const log = [
    JSON.stringify({ url: "https://a.org/", status: 200, timestamp: "2026-10-11T00:00:00.000Z" }),
    JSON.stringify({ url: "https://b.org/", status: 429, timestamp: "2026-10-11T00:00:20.000Z" }),
    JSON.stringify({ url: "https://c.org/", status: 0, timestamp: "2026-10-11T00:00:40.000Z", error: "timeout" }),
    '{"url": "https://d.org/", "sta',
    "",
  ].join("\n");
  expect([...archivedUrls(log)]).toEqual(["https://a.org/"]);
});

test("archivedUrls with a since time keeps only saves at or after it", () => {
  const log = [
    JSON.stringify({ url: "https://aswemayact.org/", status: 200, timestamp: "2026-10-14T13:00:00.000Z" }),
    JSON.stringify({ url: "https://aswemayact.org/about/", status: 200, timestamp: "2026-10-14T14:00:00.000Z" }),
  ].join("\n");
  expect([...archivedUrls(log, "2026-10-14T13:58Z")]).toEqual(["https://aswemayact.org/about/"]);
});

test("archiveList skips pages already saved since the deploy", () => {
  const list = archiveList({ pages: ["/", "/about/"], external: [], pagesSaved: new Set(["https://aswemayact.org/"]) });
  expect(list).toEqual(["https://aswemayact.org/about/"]);
});

test("archiveList puts changed pages first, drops saved and duplicate citations, honors the limit", () => {
  const list = archiveList({
    pages: ["/", "/manual/the-clock/"],
    external: ["https://a.org/", "https://b.org/", "https://a.org/#x", "https://c.org/"],
    alreadyArchived: new Set(["https://b.org/"]),
  });
  expect(list).toEqual([
    "https://aswemayact.org/",
    "https://aswemayact.org/manual/the-clock/",
    "https://a.org/",
    "https://c.org/",
  ]);
  expect(archiveList({ pages: ["/"], external: ["https://a.org/"], limit: 1 })).toEqual(["https://aswemayact.org/"]);
  expect(archiveList({ pages: ["/"], external: ["https://a.org/"], limit: 0 })).toEqual([]);
});

test("parseArchiveArgs reads --dry-run, --external-only and --limit", () => {
  expect(parseArchiveArgs([])).toEqual({ dryRun: false });
  expect(parseArchiveArgs(["--dry-run", "--limit", "5"])).toEqual({ dryRun: true, limit: 5 });
  expect(parseArchiveArgs(["--limit=3"])).toEqual({ dryRun: false, limit: 3 });
  expect(parseArchiveArgs(["--external-only", "--dry-run"])).toEqual({ dryRun: true, externalOnly: true });
  expect(parseArchiveArgs(["--since", "2026-10-14T13:58Z"])).toEqual({ dryRun: false, since: "2026-10-14T13:58Z" });
  expect(() => parseArchiveArgs(["--since", "soon"])).toThrow(/--since/);
  expect(() => parseArchiveArgs(["--limit", "x"])).toThrow();
  expect(() => parseArchiveArgs(["--now"])).toThrow();
});

test("archiveStopReason stops at the first 429 or at three 5xx in a row", () => {
  expect(archiveStopReason([])).toBeNull();
  expect(archiveStopReason([200, 302, 200])).toBeNull();
  expect(archiveStopReason([200, 429])).toMatch(/429/);
  expect(archiveStopReason([502, 503])).toBeNull();
  expect(archiveStopReason([200, 502, 503, 520])).toMatch(/three 5xx responses in a row/);
  expect(archiveStopReason([502, 503, 200, 504])).toBeNull(); // the run of 5xx was broken
  expect(archiveStopReason([502, 0, 503, 504])).toBeNull(); // a network error (0) is not a 5xx
});

test("archiveKeys reads both Internet Archive keys or none", () => {
  expect(archiveKeys({})).toBeNull();
  expect(archiveKeys({ IA_S3_ACCESS_KEY: "a" })).toBeNull();
  expect(archiveKeys({ IA_S3_ACCESS_KEY: " a ", IA_S3_SECRET_KEY: "b" })).toEqual({ access: "a", secret: "b" });
});

test("saveRequest posts to /save/<url> anonymously, and to the signed-in API with keys", () => {
  const anon = saveRequest("https://deflock.org/", null);
  expect(anon.endpoint).toBe("https://web.archive.org/save/https://deflock.org/");
  expect(anon.init.method).toBe("POST");
  expect(anon.init.headers).toBeUndefined();

  const signed = saveRequest("https://deflock.org/?a=1&b=2", { access: "AK", secret: "SK" });
  expect(signed.endpoint).toBe("https://web.archive.org/save");
  expect(signed.init.headers).toMatchObject({ Accept: "application/json", Authorization: "LOW AK:SK" });
  const body = new URLSearchParams(String(signed.init.body));
  expect(body.get("url")).toBe("https://deflock.org/?a=1&b=2");
  expect(body.get("if_not_archived_within")).toBe("30d");
});

test("saveApiError reports an error reply and passes an accepted job or HTML", () => {
  expect(saveApiError('{"status":"error","status_ext":"error:too-many-daily-captures"}')).toBe("error:too-many-daily-captures");
  expect(saveApiError('{"url":"https://deflock.org/","job_id":"spn2-abc"}')).toBeNull();
  expect(saveApiError("<html>saved</html>")).toBeNull();
});
