// Build-time content check (spec §5 rules). Runs before `astro build`.
// Usage: npx tsx scripts/check-content.ts [--skip-links] [--strict-network]
// Prints each violation as `path: rule: detail` and exits 1 if there are any.
// The excluded-names rule reads every tracked text file (not only src/content) plus
// public/llms.txt; without .content-rules/excluded.txt it is skipped with a warning.
// The law-quote rule checks every "What the law says" quotation in the field manual, and
// its page note, against the AG's handbook text in .content-rules/handbook-22.txt (written
// by `npm run handbook`); without that file it is skipped with a warning.
// --skip-links      skip the external URL check (offline builds)
// --strict-network  treat unverifiable links (network errors, bot challenges) as violations, not warnings
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import fg from "fast-glob";
import matter from "gray-matter";
import {
  STOP_TYPES,
  PASSAGE_MAX_WORDS,
  passageWordCount,
  extractQuotedPassage,
  isValidStatute,
  findExcludedNames,
  extractUrls,
  isBotChallenge,
  isTransientStatus,
  excludedNameScanFiles,
} from "../src/lib/content-rules";
import { checkLawBlock, indexHandbook, lawBlocks, type HandbookIndex } from "../src/lib/handbook";

const CONTENT_DIR = "src/content";
const EXCLUDED_FILE = ".content-rules/excluded.txt";
const HANDBOOK_FILE = ".content-rules/handbook-22.txt";
const LINK_TIMEOUT_MS = 10_000;
const LINK_CONCURRENCY = 6;
const USER_AGENT = "aswemayact-link-check/1.0 (+https://aswemayact.org)";

const args = new Set(process.argv.slice(2));
const skipLinks = args.has("--skip-links");
const strictNetwork = args.has("--strict-network");

type Violation = { path: string; rule: string; detail: string };
const violations: Violation[] = [];
const report = (path: string, rule: string, detail: string) => violations.push({ path, rule, detail });

/** Narration under `## Stop n`: everything up to the next h1/h2 heading. */
function stopNarration(body: string, n: number): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^##\\s+Stop\\s+${n}\\b`, "i").test(l.trim()));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

function checkStops(path: string, stops: unknown, body: string) {
  if (!Array.isArray(stops)) return;
  stops.forEach((raw, i) => {
    const n = i + 1;
    const stop = (raw ?? {}) as Record<string, unknown>;
    if (!STOP_TYPES.includes(stop.type as never)) {
      report(path, "stop-type", `stop ${n} type "${String(stop.type)}" is not one of ${STOP_TYPES.join(", ")}`);
      return;
    }
    if (stop.type !== "passage") return;
    if (typeof stop.locator !== "string" || !stop.locator.trim()) {
      report(path, "passage-locator", `stop ${n} is a passage without a locator`);
    }
    const narration = stopNarration(body, n);
    const quote = narration === null ? null : extractQuotedPassage(narration);
    if (quote === null) {
      report(path, "passage-quote", `stop ${n} has no quoted passage under "## Stop ${n}"`);
      return;
    }
    const words = passageWordCount(quote);
    if (words > PASSAGE_MAX_WORDS) {
      report(path, "passage-words", `stop ${n} passage is ${words} words (max ${PASSAGE_MAX_WORDS})`);
    }
  });
}

function checkStatutes(path: string, statutes: unknown) {
  if (!Array.isArray(statutes)) return;
  for (const s of statutes) {
    if (typeof s !== "string" || !isValidStatute(s)) {
      report(path, "statute", `"${String(s)}" does not match § 25-19-ddd(x)…`);
    }
  }
}

async function loadExcludedNames(): Promise<string[] | null> {
  if (!existsSync(EXCLUDED_FILE)) return null;
  return (await readFile(EXCLUDED_FILE, "utf8"))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

/** Spec §5 rule 3 over the whole tree: every tracked text file, plus public/llms.txt. */
async function checkExcludedNames(excluded: string[]): Promise<number> {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const files = excludedNameScanFiles(tracked).filter((p) => existsSync(p));
  for (const path of files) {
    const text = await readFile(path, "utf8");
    if (text.includes("\0")) continue; // binary
    // Name the list entry by line, never the name itself, so build logs don't publish the list.
    for (const name of findExcludedNames(text, excluded)) {
      report(path, "excluded-name", `matches entry ${excluded.indexOf(name) + 1} of ${EXCLUDED_FILE}`);
    }
  }
  return files.length;
}

type LinkResult = { status: number } | { error: string };

async function probe(url: string, method: "HEAD" | "GET"): Promise<LinkResult> {
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
    });
    await res.body?.cancel();
    // A bot challenge says nothing about whether the page exists; report it like a network error.
    if (isBotChallenge(res.status, res.headers)) return { error: "bot challenge" };
    if (isTransientStatus(res.status)) return { error: `HTTP ${res.status}, try again later` };
    return { status: res.status };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    return { error: err.cause?.code ?? err.name ?? err.message };
  }
}

async function checkUrl(url: string): Promise<LinkResult> {
  const head = await probe(url, "HEAD");
  if ("status" in head && head.status < 400) return head;
  return probe(url, "GET");
}

async function checkLinks(urlFiles: Map<string, Set<string>>) {
  const queue = [...urlFiles.keys()];
  const worker = async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      const result = await checkUrl(url);
      for (const path of urlFiles.get(url)!) {
        if ("status" in result) {
          if (result.status >= 400) report(path, "link", `${result.status} ${url}`);
        } else if (strictNetwork) {
          report(path, "link", `unverified (${result.error}) ${url}`);
        } else {
          console.warn(`warn: ${path}: link: unverified (${result.error}) ${url}`);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: LINK_CONCURRENCY }, worker));
}

async function main() {
  const files = (await fg(`${CONTENT_DIR}/**/*.md`)).sort();
  const excluded = await loadExcludedNames();
  const handbook: HandbookIndex | null = existsSync(HANDBOOK_FILE) ? indexHandbook(await readFile(HANDBOOK_FILE, "utf8")) : null;
  let lawChecked = 0;
  const urlFiles = new Map<string, Set<string>>();

  for (const path of files) {
    const raw = await readFile(path, "utf8");
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch (e) {
      report(path, "frontmatter", (e as Error).message.split("\n")[0]);
      continue;
    }
    const { data, content } = parsed;

    checkStops(path, data.stops, content);
    checkStatutes(path, data.statutes);
    if (handbook && path.startsWith(`${CONTENT_DIR}/manual/`)) {
      for (const block of lawBlocks(raw)) {
        lawChecked++;
        for (const problem of checkLawBlock(handbook, block)) report(path, "law-quote", problem);
      }
    }
    for (const url of extractUrls(raw)) {
      if (!urlFiles.has(url)) urlFiles.set(url, new Set());
      urlFiles.get(url)!.add(path);
    }
  }

  if (handbook === null) {
    console.warn(`warn: ${HANDBOOK_FILE} not found — law-quote rule skipped (run npm run handbook)`);
  } else {
    console.log(`check-content: law-quote rule checked ${lawChecked} law blocks against the handbook`);
  }

  if (excluded === null) {
    console.warn(`warn: ${EXCLUDED_FILE} not found — excluded-names rule skipped`);
  } else {
    const scanned = await checkExcludedNames(excluded);
    console.log(`check-content: excluded-names rule read ${scanned} tracked text files`);
  }

  if (!skipLinks && files.length > 0) await checkLinks(urlFiles);

  violations.sort((a, b) => a.path.localeCompare(b.path));
  for (const v of violations) console.error(`${v.path}: ${v.rule}: ${v.detail}`);
  console.log(`check-content: ${files.length} files, ${violations.length} violations`);
  process.exit(violations.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
