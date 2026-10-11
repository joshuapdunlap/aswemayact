// Writes src/data/recent.json, the front door's "Recently added" list: the five most
// recently changed content pages from git history, padded with launch entries.
// Runs as `prebuild`, so every local build rewrites the tracked src/data/recent.json;
// commit it with content changes so a clean checkout builds the same list. Without git
// (a tarball checkout) or on a shallow clone it keeps the committed file unchanged.
// Usage: npx tsx scripts/recent-changes.ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import matter from "gray-matter";
import { canRebuildFromHistory, parseGitLog, recentEntries } from "../src/lib/recent";

const OUT = "src/data/recent.json";

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function titleOf(file: string): string | null {
  if (!existsSync(file)) return null;
  try {
    const { data } = matter(readFileSync(file, "utf8"));
    const title = data.title ?? data.name;
    // Files without a title (corrections) still exist; recentEntries names their page.
    return typeof title === "string" ? title : file;
  } catch {
    return null;
  }
}

const shallow = git(["rev-parse", "--is-shallow-repository"]);
const log = canRebuildFromHistory(shallow) ? git(["log", "--format=%x00%cI", "--name-only", "--", "src/content"]) : null;
if (log === null) {
  console.warn(`recent-changes: git history unavailable or shallow; keeping ${OUT}`);
  process.exit(0);
}
const entries = recentEntries(parseGitLog(log), titleOf, 5);
writeFileSync(OUT, JSON.stringify(entries, null, 2) + "\n");
console.log(`recent-changes: wrote ${entries.length} entries to ${OUT}`);
