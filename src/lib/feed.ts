// The Atom feed (/feed.xml): new trails, essays and corrections, newest first, so a reader
// can follow the site without giving it an address. Pure functions; src/pages/feed.xml.ts
// gathers the collections and writes the result.

export interface FeedEntry {
  /** Site-relative identifier, made absolute against the site URL. */
  id: string;
  title: string;
  /** Site-relative path of the page the entry links to. */
  path: string;
  updated: Date;
  summary: string;
  author?: string;
}

export interface FeedOptions {
  site: string;
  title: string;
  subtitle: string;
  /** Feed date when there are no entries. */
  fallbackUpdated?: Date;
}

const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RFC 3339 to the second, UTC: "2026-10-11T00:00:00Z". */
const rfc3339 = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, "Z");

export function atomFeed(entries: FeedEntry[], opts: FeedOptions): string {
  const site = opts.site.replace(/\/$/, "");
  const sorted = [...entries].sort((a, b) => b.updated.getTime() - a.updated.getTime() || a.id.localeCompare(b.id));
  const updated = sorted[0]?.updated ?? opts.fallbackUpdated ?? new Date(0);
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(opts.title)}</title>`,
    ...(opts.subtitle ? [`  <subtitle>${escapeXml(opts.subtitle)}</subtitle>`] : []),
    `  <id>${site}/</id>`,
    `  <link rel="self" href="${site}/feed.xml"/>`,
    `  <link rel="alternate" href="${site}/"/>`,
    `  <updated>${rfc3339(updated)}</updated>`,
    `  <author><name>${escapeXml(opts.title)}</name></author>`,
  ];
  for (const e of sorted) {
    lines.push(
      "  <entry>",
      `    <title>${escapeXml(e.title)}</title>`,
      `    <id>${site}${escapeXml(e.id)}</id>`,
      `    <link rel="alternate" href="${site}${escapeXml(e.path)}"/>`,
      `    <updated>${rfc3339(e.updated)}</updated>`,
      ...(e.author ? [`    <author><name>${escapeXml(e.author)}</name></author>`] : []),
      `    <summary>${escapeXml(e.summary)}</summary>`,
      "  </entry>",
    );
  }
  lines.push("</feed>", "");
  return lines.join("\n");
}

interface TrailData {
  title: string;
  slug: string;
  dateline: string;
  summary: string;
  author: string;
}

interface EssayData {
  title: string;
  dateline: string;
  summary: string;
  author: string;
}

interface CorrectionData {
  id: string;
  page: string;
  date: Date;
  was: string;
  now: string;
}

/** Trails link to their own pages, the essay to About (where it is printed), corrections to the log. */
export function feedEntries(c: { trails: TrailData[]; essays: EssayData[]; corrections: CorrectionData[] }): FeedEntry[] {
  return [
    ...c.trails.map((t) => ({
      id: `/trails/${t.slug}/`,
      title: t.title,
      path: `/trails/${t.slug}/`,
      updated: new Date(t.dateline),
      summary: t.summary,
      author: t.author,
    })),
    ...c.essays.map((e) => ({
      id: "/about/",
      title: e.title,
      path: "/about/",
      updated: new Date(e.dateline),
      summary: e.summary,
      author: e.author,
    })),
    ...c.corrections.map((x) => ({
      id: `/corrections/#${x.id}`,
      title: `Corrections log: ${x.page}`,
      path: "/corrections/",
      updated: x.date,
      summary: x.now,
    })),
  ];
}
