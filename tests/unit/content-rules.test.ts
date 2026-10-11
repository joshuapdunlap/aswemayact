// tests/unit/content-rules.test.ts
import {
  passageWordCount,
  isValidStatute,
  findExcludedNames,
  isUnderReview,
  extractQuotedPassage,
  extractUrls,
  isBotChallenge,
  isTransientStatus,
  excludedNameScanFiles,
} from "../../src/lib/content-rules";

test("passage word count strips quotes and splits on whitespace", () => {
  expect(passageWordCount("“The process of tying two items together is the important thing.”")).toBe(11);
});
test("25 words passes, 26 fails", () => {
  const w = (n: number) => Array(n).fill("word").join(" ");
  expect(passageWordCount(w(25))).toBe(25);
  expect(passageWordCount(w(26))).toBe(26);
});
test("statute format", () => {
  expect(isValidStatute("§ 25-19-105(d)(3)(A)(iii)")).toBe(true);
  expect(isValidStatute("§ 25-19-105")).toBe(true);
  expect(isValidStatute("25-19-105")).toBe(false);
  expect(isValidStatute("§ 25-19-10")).toBe(false);
});
test("excluded names are found case-insensitively", () => {
  expect(findExcludedNames("See Example Org today", ["example org"])).toEqual(["example org"]);
  expect(findExcludedNames("nothing here", ["example org"])).toEqual([]);
});
test("under review at 181 days, not at 180", () => {
  const t = new Date(Date.UTC(2026, 9, 11));
  expect(isUnderReview(new Date(Date.UTC(2026, 3, 14)), t)).toBe(false); // 180 days
  expect(isUnderReview(new Date(Date.UTC(2026, 3, 13)), t)).toBe(true); // 181 days
});
test("quoted passage is the first curly-quoted span, else straight quotes", () => {
  expect(extractQuotedPassage("The Act says “public records shall be open” and more “later”.")).toBe("public records shall be open");
  expect(extractQuotedPassage('It reads "open to inspection" there.')).toBe("open to inspection");
  expect(extractQuotedPassage("No quote here.")).toBeNull();
});
test("extractUrls keeps balanced parentheses inside a URL", () => {
  expect(extractUrls("See https://en.wikipedia.org/wiki/Freedom_of_information_(Arkansas) today.")).toEqual([
    "https://en.wikipedia.org/wiki/Freedom_of_information_(Arkansas)",
  ]);
});
test("extractUrls drops a trailing unbalanced paren and Markdown link closers", () => {
  expect(extractUrls("(see https://example.org/a)")).toEqual(["https://example.org/a"]);
  expect(extractUrls("[report](https://example.org/b), and [x](https://example.org/c_(d)).")).toEqual([
    "https://example.org/b",
    "https://example.org/c_(d)",
  ]);
});
test("extractUrls strips trailing punctuation and stops at quotes and angle brackets", () => {
  expect(extractUrls('Go to https://example.org/x. Or <a href="https://example.org/y">y</a>')).toEqual([
    "https://example.org/x",
    "https://example.org/y",
  ]);
});
test("a Cloudflare challenge is a bot wall, not a dead link", () => {
  const h = (v: string | null) => ({ get: (n: string) => (n.toLowerCase() === "cf-mitigated" ? v : null) });
  expect(isBotChallenge(403, h("challenge"))).toBe(true);
  expect(isBotChallenge(403, h(null))).toBe(false);
  expect(isBotChallenge(404, h("challenge"))).toBe(false);
});
test("a rate limit or service hiccup is unverified, not a dead link", () => {
  expect(isTransientStatus(429)).toBe(true);
  expect(isTransientStatus(503)).toBe(true);
  expect(isTransientStatus(404)).toBe(false);
  expect(isTransientStatus(500)).toBe(false);
});

test("excluded-name scan covers every tracked text file plus public/llms.txt", () => {
  const tracked = [
    "README.md",
    "astro.config.mjs",
    "src/pages/index.astro",
    "src/lib/dates.ts",
    "src/data/recent.json",
    "public/robots.txt",
    "src/styles/base.css",
    ".github/workflows/check.yml",
    "wrangler.jsonc",
    "package-lock.json",
    "src/fonts/newsreader-latin-roman.woff2",
    "public/favicon.svg",
    "scripts/build-fonts.py",
    ".content-rules/.gitkeep",
  ];
  expect(excludedNameScanFiles(tracked)).toEqual([
    ".github/workflows/check.yml",
    "README.md",
    "astro.config.mjs",
    "public/llms.txt",
    "public/robots.txt",
    "src/data/recent.json",
    "src/lib/dates.ts",
    "src/pages/index.astro",
    "src/styles/base.css",
    "wrangler.jsonc",
  ]);
  // llms.txt is listed once even when tracked; nested lockfiles are skipped too.
  expect(excludedNameScanFiles(["public/llms.txt", "sub/package-lock.json", "a.MD"])).toEqual(["a.MD", "public/llms.txt"]);
});
