// Pure content rules shared by the content collections, the check script and components.
// All date math is UTC: frontmatter dates parse as UTC midnight.

export const STOP_TYPES = ["passage", "record", "concept", "finding", "action"] as const;
export type StopType = (typeof STOP_TYPES)[number];

export const PASSAGE_MAX_WORDS = 25;
export const REVIEW_DAYS = 180;

const STATUTE = /^§ 25-19-\d{3}(\([a-zA-Z0-9]+\))*$/;
const DAY_MS = 86_400_000;

/** Words in a passage after stripping quotation marks; split on whitespace. */
export function passageWordCount(text: string): number {
  return text
    .replace(/[“”"]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * The quoted passage inside a stop's narration: the text of the first pair of
 * curly quotes “…”, or of straight quotes if there are no curly ones.
 * Returns null when the narration quotes nothing.
 */
export function extractQuotedPassage(narration: string): string | null {
  const curly = narration.match(/“([^”]*)”/);
  if (curly) return curly[1];
  const straight = narration.match(/"([^"]*)"/);
  return straight ? straight[1] : null;
}

/** True when `s` is an Arkansas FOIA citation such as "§ 25-19-105(b)(3)". */
export function isValidStatute(s: string): boolean {
  return STATUTE.test(s);
}

/** The excluded names that occur in `text`, matched case-insensitively. */
export function findExcludedNames(text: string, names: string[]): string[] {
  const haystack = text.toLowerCase();
  return names.filter((n) => n.trim().length > 0 && haystack.includes(n.trim().toLowerCase()));
}

/** Text-file extensions the excluded-names rule reads (spec §5 rule 3 applies to the whole tree). */
export const SCAN_EXTENSIONS = [".md", ".astro", ".ts", ".mjs", ".json", ".txt", ".css", ".yml", ".jsonc"] as const;
/** Always scanned, tracked or not: the file crawlers read. */
export const ALWAYS_SCAN = ["public/llms.txt"] as const;

/**
 * The files the excluded-names rule scans, from the tracked paths (`git ls-files`):
 * every text file with a SCAN_EXTENSIONS extension except lockfiles, plus ALWAYS_SCAN.
 * Sorted, without duplicates.
 */
export function excludedNameScanFiles(tracked: string[]): string[] {
  const keep = tracked.filter((p) => {
    const base = p.slice(p.lastIndexOf("/") + 1);
    if (base === "package-lock.json") return false;
    const lower = base.toLowerCase();
    return SCAN_EXTENSIONS.some((ext) => lower.endsWith(ext));
  });
  return [...new Set([...keep, ...ALWAYS_SCAN])].sort();
}

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** True when more than `days` whole days separate `reviewed` from `today`. */
export function isUnderReview(reviewed: Date, today: Date, days = REVIEW_DAYS): boolean {
  return (utcMidnight(today) - utcMidnight(reviewed)) / DAY_MS > days;
}

const URL_RE = /https?:\/\/[^\s<>"'`\]]+/g;

/** Trim trailing sentence punctuation and any `)` that has no matching `(` in the URL. */
function trimUrl(url: string): string {
  let u = url;
  for (;;) {
    const before = u;
    u = u.replace(/[.,;:!?*]+$/, "");
    if (u.endsWith(")")) {
      const open = (u.match(/\(/g) ?? []).length;
      const close = (u.match(/\)/g) ?? []).length;
      if (close > open) u = u.slice(0, -1);
    }
    if (u === before) return u;
  }
}

/**
 * Absolute http(s) URLs in Markdown or HTML text. Parentheses inside a URL are kept when
 * balanced (Wikipedia-style paths); a trailing unbalanced `)`, such as a Markdown link closer,
 * and trailing sentence punctuation are dropped.
 */
export function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_RE)].map((m) => trimUrl(m[0]));
}

/**
 * True when a 403 is a Cloudflare bot challenge (`cf-mitigated: challenge`): the page is
 * live for a browser but refuses a link checker, so it is not evidence of a dead link.
 */
export function isBotChallenge(status: number, headers: { get(name: string): string | null }): boolean {
  return status === 403 && headers.get("cf-mitigated")?.toLowerCase() === "challenge";
}
