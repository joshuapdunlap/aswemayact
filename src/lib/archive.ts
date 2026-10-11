// Wayback Machine submission list (spec §5, "Automatic behaviors"): the site pages changed
// since the last deploy and the external URLs the built pages cite. Pure functions;
// scripts/archive-links.ts reads dist/, runs git, makes the requests and writes the log.

import { extractUrls } from "./content-rules";
import { contentPath } from "./recent";

export const SITE_ORIGIN = "https://aswemayact.org";

/** Pages never submitted: kept out of search indexes and the sitemap too (404 serves unknown paths). */
export const ARCHIVE_EXCLUDED_PATHS = ["/styleguide/", "/styleguide-essay/", "/search/", "/404/"];

/** Files whose change can alter every page (layout, shared components, styles, config). */
const SITEWIDE = [/^src\/layouts\//, /^src\/components\//, /^src\/styles\//, /^src\/lib\//, /^public\//, /^astro\.config\.mjs$/];

/** Hosts not worth submitting: the archive itself. */
const SKIP_HOSTS = new Set(["web.archive.org", "archive.org"]);

/** The site path a built HTML file serves: `dist/manual/the-clock/index.html` → `/manual/the-clock/`. */
export function pagePathFromDist(file: string): string {
  const rel = file.replace(/\\/g, "/").replace(/^(\.\/)?dist\//, "");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel.replace(/\.html$/, "/")}`;
}

/** The pages a changed source file can alter, given every built page (none for tests, scripts, docs). */
function pagesForFile(file: string, pages: string[]): string[] {
  if (SITEWIDE.some((re) => re.test(file))) return pages;
  if (file === "src/data/recent.json") return ["/"];
  if (file.startsWith("src/content/")) {
    const own = contentPath(file);
    const collection = file.split("/")[2];
    // A content change also changes the index that lists it (summaries, review dates).
    const index = collection === "manual" || collection === "sources" ? "/manual/" : collection === "trails" ? "/trails/" : null;
    return [own, index].filter((p): p is string => p !== null);
  }
  const page = file.match(/^src\/pages\/(.+)\.astro$/);
  if (page) {
    const route = page[1];
    // A dynamic route renders every page under its directory.
    if (/\[[^\]]+\]$/.test(route)) {
      const dir = `/${route.replace(/\[[^\]]+\]$/, "")}`;
      return pages.filter((p) => p.startsWith(dir) && p !== dir);
    }
    if (route === "index") return ["/"];
    return [`/${route.replace(/\/index$/, "")}/`];
  }
  return [];
}

/**
 * The site pages to submit. `changedFiles` is the repo-relative list of files changed since
 * the last `deployed-*` tag, or null when there is no such tag (first deploy: every page).
 * Only pages that exist in the build and are not excluded are returned, in build order.
 */
export function changedPages(changedFiles: string[] | null, pages: string[]): string[] {
  const eligible = pages.filter((p) => !ARCHIVE_EXCLUDED_PATHS.includes(p));
  if (changedFiles === null) return eligible;
  const hit = new Set(changedFiles.flatMap((f) => pagesForFile(f, pages)));
  return eligible.filter((p) => hit.has(p));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Absolute http(s) links (`href` values) in an HTML document that point off `origin`. */
export function externalLinks(html: string, origin = SITE_ORIGIN): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const url of extractUrls(decodeEntities(m[1] ?? m[2]))) {
      let host: string;
      try {
        host = new URL(url).hostname;
      } catch {
        continue;
      }
      if (url.startsWith(origin) || SKIP_HOSTS.has(host)) continue;
      out.push(url);
    }
  }
  return out;
}

/** URLs in first-seen order, each once; a `#fragment` does not make a URL different. */
export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw.replace(/#.*$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export type ArchiveLogEntry = { url: string; status: number; timestamp: string; error?: string };

/** URLs the log records as saved (2xx/3xx). Unparseable lines are ignored. */
export function archivedUrls(logText: string): Set<string> {
  const done = new Set<string>();
  for (const line of logText.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as ArchiveLogEntry;
      if (typeof e.url === "string" && e.status >= 200 && e.status < 400) done.add(e.url);
    } catch {
      // a partial line from an interrupted run
    }
  }
  return done;
}

/**
 * The submission list: changed site pages (always, as absolute URLs) first, then external
 * citations not yet saved according to the log ("newly cited"), deduped, cut to `limit`.
 */
export function archiveList(opts: {
  pages: string[];
  external: string[];
  alreadyArchived?: Set<string>;
  limit?: number;
  origin?: string;
}): string[] {
  const { pages, external, alreadyArchived = new Set(), limit, origin = SITE_ORIGIN } = opts;
  const site = pages.map((p) => `${origin}${p}`);
  const fresh = dedupeUrls(external).filter((u) => !alreadyArchived.has(u));
  const all = dedupeUrls([...site, ...fresh]);
  return limit === undefined ? all : all.slice(0, Math.max(0, limit));
}

export type ArchiveArgs = { dryRun: boolean; limit?: number };

/** `--dry-run` and `--limit N` (or `--limit=N`). Throws on anything else. */
export function parseArchiveArgs(argv: string[]): ArchiveArgs {
  const args: ArchiveArgs = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--limit" || a.startsWith("--limit=")) {
      const v = a === "--limit" ? argv[++i] : a.slice("--limit=".length);
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) throw new Error(`--limit needs a whole number, got ${v}`);
      args.limit = n;
    } else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

/**
 * Why the run must stop now, given the statuses so far in order (0 = network error), or
 * null to carry on. Save Page Now answers 429 when the anonymous limit is hit and 5xx when
 * it is struggling; pressing on only extends the block, so stop at the first 429 or at
 * three 5xx in a row.
 */
export function archiveStopReason(statuses: number[]): string | null {
  const last = statuses.at(-1);
  if (last === 429) return "Save Page Now answered 429 (rate limited)";
  const tail = statuses.slice(-3);
  if (tail.length === 3 && tail.every((s) => s >= 500 && s < 600)) {
    return `Save Page Now gave three 5xx responses in a row (${tail.join(", ")})`;
  }
  return null;
}
