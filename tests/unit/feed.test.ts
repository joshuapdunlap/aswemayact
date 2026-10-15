// tests/unit/feed.test.ts
import { atomFeed, feedEntries, type FeedEntry } from "../../src/lib/feed";

const SITE = "https://aswemayact.org";

const ENTRIES: FeedEntry[] = [
  {
    id: "/trails/the-camera/",
    title: "The camera",
    path: "/trails/the-camera/",
    updated: new Date("2026-10-11T00:00:00Z"),
    summary: "License-plate cameras & the records behind them.",
    author: "Joshua Dunlap, editor",
  },
  {
    id: "/corrections/#2026-10-14-clock",
    title: "Correction: /manual/the-clock/",
    path: "/corrections/",
    updated: new Date("2026-10-14T00:00:00Z"),
    summary: "Now: three <working> days.",
  },
];

test("atomFeed writes a valid Atom document, newest entry first", () => {
  const xml = atomFeed(ENTRIES, { site: SITE, title: "As We May Act", subtitle: "Trails and corrections." });
  expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">')).toBe(true);
  expect(xml).toContain(`<id>${SITE}/</id>`);
  expect(xml).toContain(`<link rel="self" href="${SITE}/feed.xml"/>`);
  expect(xml).toContain("<updated>2026-10-14T00:00:00Z</updated>");
  expect(xml.indexOf("Correction: /manual/the-clock/")).toBeLessThan(xml.indexOf("The camera"));
  expect(xml.trimEnd().endsWith("</feed>")).toBe(true);
});

test("atomFeed escapes markup in titles and summaries", () => {
  const xml = atomFeed(ENTRIES, { site: SITE, title: "As We May Act", subtitle: "Trails & corrections." });
  expect(xml).toContain("License-plate cameras &amp; the records behind them.");
  expect(xml).toContain("Now: three &lt;working&gt; days.");
  expect(xml).toContain("<subtitle>Trails &amp; corrections.</subtitle>");
});

test("each entry carries an absolute id and link, and an author when signed", () => {
  const xml = atomFeed(ENTRIES, { site: SITE, title: "As We May Act", subtitle: "" });
  expect(xml).toContain(`<id>${SITE}/trails/the-camera/</id>`);
  expect(xml).toContain(`<link rel="alternate" href="${SITE}/trails/the-camera/"/>`);
  expect(xml).toContain("<author><name>Joshua Dunlap, editor</name></author>");
  expect(xml).toContain(`<id>${SITE}/corrections/#2026-10-14-clock</id>`);
});

test("the feed has a feed-level author so unsigned entries stay valid", () => {
  const xml = atomFeed(ENTRIES, { site: SITE, title: "As We May Act", subtitle: "" });
  const head = xml.slice(0, xml.indexOf("<entry>"));
  expect(head).toContain("<author><name>As We May Act</name></author>");
});

test("feedEntries maps trails, essays and corrections to entries", () => {
  const entries = feedEntries({
    trails: [{ title: "The camera", slug: "the-camera", dateline: "2026-10-11", summary: "S", author: "A" }],
    essays: [{ title: "Why", dateline: "2026-10-11", summary: "E", author: "A" }],
    corrections: [{ id: "2026-10-11-launch", page: "site", date: new Date("2026-10-11T00:00:00Z"), was: "W", now: "N" }],
  });
  expect(entries.map((e) => e.path)).toEqual(["/trails/the-camera/", "/about/", "/corrections/"]);
  expect(entries[2]).toMatchObject({ id: "/corrections/#2026-10-11-launch", title: "Corrections log: site", summary: "N" });
  expect(entries[0].updated.toISOString()).toBe("2026-10-11T00:00:00.000Z");
});

test("an empty feed is dated by the fallback date", () => {
  const xml = atomFeed([], { site: SITE, title: "T", subtitle: "", fallbackUpdated: new Date("2026-10-11T00:00:00Z") });
  expect(xml).toContain("<updated>2026-10-11T00:00:00Z</updated>");
  expect(xml).not.toContain("<entry>");
});
