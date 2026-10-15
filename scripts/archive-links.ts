// Submits changed site pages and newly cited external URLs to the Wayback Machine's
// Save Page Now (spec §5). Run after a build and deploy, before tagging the deploy:
//   npm run archive -- --dry-run      print the list, send nothing
//   npm run archive -- --limit 10     submit at most 10 URLs
//   npm run archive -- --external-only  cited sources only, none of this site's pages
//                                       (safe before a deploy: the live pages may be stale)
//   npm run archive -- --since 2026-10-14T13:58Z
//                                       skip site pages already saved since that time (the
//                                       deploy), so a run resumed after a 429 picks up the rest
// "Changed" means changed since the most recent tag matching deployed-* (every page when
// there is none). External URLs already saved according to .archive-log.jsonl are skipped.
// Anonymous Save Page Now allows about 3 requests a minute, so requests are 20 s apart.
// With IA_S3_ACCESS_KEY and IA_S3_SECRET_KEY set (archive.org/account/s3.php), saves go
// through the signed-in API instead, which the anonymous limit does not throttle.
// Each result is appended to .archive-log.jsonl (gitignored) as {url, status, timestamp},
// timestamps in UTC. The run stops, exiting 1, at the first 429 or at three 5xx in a row;
// the log keeps what was saved, so a later run picks up the rest.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import fg from "fast-glob";
import {
  archiveList,
  archivedUrls,
  archiveKeys,
  archiveStopReason,
  changedPages,
  externalLinks,
  pagePathFromDist,
  parseArchiveArgs,
  saveApiError,
  saveRequest,
  type ArchiveLogEntry,
} from "../src/lib/archive";

const DIST = "dist";
const LOG = ".archive-log.jsonl";
const INTERVAL_MS = 20_000;
const TIMEOUT_MS = 120_000;

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** Files changed since the last deployed-* tag (working tree included), or null without a tag. */
function changedSinceDeploy(): { tag: string | null; files: string[] | null } {
  const tag = git(["describe", "--tags", "--abbrev=0", "--match", "deployed-*"]);
  if (!tag) return { tag: null, files: null };
  const diff = git(["diff", "--name-only", tag]);
  if (diff === null) return { tag, files: null };
  return { tag, files: diff.split("\n").filter(Boolean) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const KEYS = archiveKeys(process.env);

async function save(url: string): Promise<ArchiveLogEntry> {
  const timestamp = new Date().toISOString();
  try {
    const { endpoint, init } = saveRequest(url, KEYS);
    const res = await fetch(endpoint, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const error = KEYS && res.ok ? saveApiError(await res.text()) : null;
    if (error) return { url, status: 0, timestamp, error };
    return { url, status: res.status, timestamp };
  } catch (e) {
    return { url, status: 0, timestamp, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const args = parseArchiveArgs(process.argv.slice(2));
  if (!existsSync(DIST)) {
    console.error(`archive: no ${DIST}/; run npm run build first`);
    process.exit(1);
  }
  const files = (await fg(`${DIST}/**/*.html`)).sort();
  const pages = files.map(pagePathFromDist);
  const external = files.flatMap((f) => externalLinks(readFileSync(f, "utf8")));
  const { tag, files: changed } = changedSinceDeploy();
  const logText = existsSync(LOG) ? readFileSync(LOG, "utf8") : "";
  const alreadyArchived = archivedUrls(logText);
  const pagesSaved = args.since ? archivedUrls(logText, args.since) : new Set<string>();
  const sitePages = args.externalOnly ? [] : changedPages(changed, pages);
  const list = archiveList({ pages: sitePages, external, alreadyArchived, pagesSaved, limit: args.limit });

  const scope = args.externalOnly ? "external sources only" : tag ? `changes since ${tag}` : "no deployed-* tag, all pages";
  console.log(`archive: ${scope}; ${list.length} URL(s)${KEYS ? "; signed in" : ""}`);
  if (args.dryRun) {
    for (const url of list) console.log(url);
    return;
  }
  const statuses: number[] = [];
  for (const [i, url] of list.entries()) {
    if (i > 0) await sleep(INTERVAL_MS);
    const entry = await save(url);
    appendFileSync(LOG, JSON.stringify(entry) + "\n");
    console.log(`${entry.status || "error"} ${url}${entry.error ? ` (${entry.error})` : ""}`);
    statuses.push(entry.status);
    const stop = archiveStopReason(statuses);
    if (stop) {
      const left = list.length - i - 1;
      console.error(`archive: stopped: ${stop}. ${left} URL(s) not submitted; run again later (saved URLs are skipped).`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(`archive: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
