// "Recently added" on the front door: the latest content changes from git history.
// Pure functions; scripts/recent-changes.ts runs git and writes src/data/recent.json.
// Dates are UTC calendar days (YYYY-MM-DD).

export type RecentEntry = { path: string; title: string; date: string };
export type Commit = { date: string; files: string[] };

/**
 * Whether git history is complete enough to rebuild the list. A shallow clone's boundary
 * commit lists every file in the tree, so its "latest changes" would be arbitrary; in that
 * case, or without git at all (`isShallow` null), keep the committed recent.json.
 * `isShallow` is the output of `git rev-parse --is-shallow-repository`.
 */
export function canRebuildFromHistory(isShallow: string | null): boolean {
  return isShallow !== null && isShallow.trim() === "false";
}

/** The pages that make up the launch, used to pad the list while history is short. */
export const LAUNCH_ENTRIES: RecentEntry[] = [
  { path: "/manual/", title: "Field manual", date: "2026-10-11" },
  { path: "/manual/write/", title: "Letter builder", date: "2026-10-11" },
  { path: "/trails/", title: "Trails", date: "2026-10-11" },
  { path: "/about/", title: "Why “As We May Act”", date: "2026-10-11" },
  { path: "/manual/sources/", title: "Source cards", date: "2026-10-11" },
  { path: "/corrections/", title: "Corrections", date: "2026-10-11" },
];

/** Pages whose title is fixed rather than read from the file's frontmatter. */
const FIXED_TITLES: Record<string, string> = {
  "/manual/sources/": "Source cards",
  "/corrections/": "Corrections",
};

function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Parse `git log --format=%x00%cI --name-only` output: each commit starts with a NUL and
 * its committer date, followed by the files it touched. Newest commit first.
 */
export function parseGitLog(log: string): Commit[] {
  return log
    .split("\0")
    .map((chunk) => chunk.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map(([date, ...files]) => ({ date: utcDay(date), files }));
}

/** The site path a content file renders at, or null when it has no page of its own. */
export function contentPath(file: string): string | null {
  const m = file.match(/^src\/content\/([^/]+)\/(.+)\.md$/);
  if (!m) return null;
  const [, collection, id] = m;
  switch (collection) {
    case "manual":
      return id === "sources" ? "/manual/sources/" : `/manual/${id}/`;
    case "sources":
      return "/manual/sources/";
    case "trails":
      return `/trails/${id}/`;
    case "essays":
      return id === "why-as-we-may-act" ? "/about/" : null;
    case "corrections":
      return "/corrections/";
    default:
      return null;
  }
}

/**
 * The `count` most recently changed pages, each listed once at its latest change, padded
 * with launch entries. `titleOf` returns a file's title, or null when the file is gone.
 */
export function recentEntries(
  commits: Commit[],
  titleOf: (file: string) => string | null,
  count = 5,
): RecentEntry[] {
  const out: RecentEntry[] = [];
  const seen = new Set<string>();
  for (const { date, files } of commits) {
    for (const file of files) {
      if (out.length >= count) return out;
      const path = contentPath(file);
      if (!path || seen.has(path)) continue;
      const own = titleOf(file);
      if (!own) continue; // deleted since
      const title = FIXED_TITLES[path] ?? own;
      seen.add(path);
      out.push({ path, title, date });
    }
  }
  for (const entry of LAUNCH_ENTRIES) {
    if (out.length >= count) break;
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    out.push(entry);
  }
  return out;
}
