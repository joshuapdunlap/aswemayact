// WCAG 2.x contrast check for the color tokens in src/styles/tokens.css.
// Usage: npx tsx scripts/contrast.ts
// Gate: every text token on --paper must reach 4.5:1 (exit 1 otherwise).
// Text on --paper-2 (insets) and --rule on --paper are printed for information only.
import { readFileSync } from "node:fs";

const TEXT_TOKENS = ["ink", "ink-light", "stamp", "rubric"] as const;
const MIN_TEXT = 4.5;
const MIN_UI = 3;

type Tokens = Record<string, string>;

function readBlock(css: string, selector: string): Tokens {
  const start = css.indexOf(selector + " {");
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const tokens: Tokens = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2];
  return tokens;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const themes: Record<string, Tokens> = {
  light: readBlock(css, ":root"),
  dark: readBlock(css, ':root[data-theme="dark"]'),
};

function line(ok: boolean, fg: string, bg: string, t: Tokens, ratio: number, label = ok ? "pass" : "FAIL"): string {
  return `  ${label.padEnd(4)}  ${fg.padEnd(9)} ${t[fg]} on ${bg.padEnd(7)} ${t[bg]}  ${ratio.toFixed(2)}:1`;
}

let failed = false;
for (const [theme, t] of Object.entries(themes)) {
  console.log(`\n${theme}: text on paper (gated, >= ${MIN_TEXT}:1)`);
  for (const fg of TEXT_TOKENS) {
    const ratio = contrast(t[fg], t.paper);
    if (ratio < MIN_TEXT) failed = true;
    console.log(line(ratio >= MIN_TEXT, fg, "paper", t, ratio));
  }
  console.log(`${theme}: informational`);
  for (const fg of TEXT_TOKENS) {
    const ratio = contrast(t[fg], t["paper-2"]);
    console.log(line(ratio >= MIN_TEXT, fg, "paper-2", t, ratio, ratio >= MIN_TEXT ? "ok" : "low"));
  }
  const rule = contrast(t.rule, t.paper);
  console.log(line(rule >= MIN_UI, "rule", "paper", t, rule, rule >= MIN_UI ? "ok" : "low") + `  (UI target ${MIN_UI}:1)`);
}

console.log(failed ? `\nFAIL: a text pair on paper is below ${MIN_TEXT}:1` : `\nAll text pairs on paper are at least ${MIN_TEXT}:1`);
process.exit(failed ? 1 : 0);
