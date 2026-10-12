// Typesetting ties, so a citation never breaks where a reader would lose it:
//  - the space after a short citation abbreviation ("p. 108", "sec. 8", "no. 1") and after
//    "§" becomes a no-break space;
//  - in Markdown, a whole statute number ("§ 25-19-105(d)(3)(A)(iii)") is also wrapped in a
//    no-wrap span, so it never breaks at a hyphen either. The characters stay as written, so
//    a copied citation is the same text.
import type { Root, Element, ElementContent, RootContent, Text } from "hast";

const TIE = /(§§?|\bpp?\.|\bsec\.|\b[Nn]o\.|\bvol\.) (?=\d)/g;
const STATUTE = /§§?[\s ]?\d+(?:-\d+)+(?:\([A-Za-z0-9]+\))*/g;

export function tieShortWords(s: string): string {
  return s.replace(TIE, "$1 ");
}

/** Text split into plain runs and no-wrap statute spans. */
export function splitStatutes(s: string): ElementContent[] {
  const out: ElementContent[] = [];
  let last = 0;
  for (const m of s.matchAll(STATUTE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ type: "text", value: s.slice(last, at) });
    out.push({ type: "element", tagName: "span", properties: { className: ["nobr"] }, children: [{ type: "text", value: m[0] }] });
    last = at + m[0].length;
  }
  if (last < s.length) out.push({ type: "text", value: s.slice(last) });
  return out;
}

const WEB_ADDRESS = /https?:\/\/[^\s<>"“”]+/g;

const escapeHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * HTML for a plain-text field in which every web address may wrap at its joints: a <wbr>
 * after each "/", "?", "&", "=" and encoded slash ("%2F") past the scheme, so a long
 * address breaks where a reader copying it by hand would expect, not mid-word. The
 * characters are unchanged (a <wbr> adds none) and everything else is escaped.
 */
export function breakUrls(s: string): string {
  let out = "";
  let last = 0;
  for (const m of s.matchAll(WEB_ADDRESS)) {
    const at = m.index ?? 0;
    const url = m[0];
    const scheme = url.indexOf("://") + 3;
    const joints = url.slice(scheme).split(/(?<=[/?&=]|%2F)/i);
    out += escapeHtml(s.slice(last, at)) + escapeHtml(url.slice(0, scheme)) + joints.map(escapeHtml).join("<wbr>");
    last = at + url.length;
  }
  return out + escapeHtml(s.slice(last));
}

const SKIP = new Set(["code", "pre", "script", "style"]);

function walk(node: Root | Element): void {
  const next: (RootContent | ElementContent)[] = [];
  for (const child of node.children as (RootContent | ElementContent)[]) {
    if (child.type === "text") {
      next.push(...splitStatutes(tieShortWords((child as Text).value)));
    } else {
      if (child.type === "element" && !SKIP.has(child.tagName)) walk(child);
      next.push(child);
    }
  }
  node.children = next as typeof node.children;
}

/** Rehype plugin: ties and statute spans over every text node outside code. */
export default function rehypeTypography() {
  return (tree: Root): void => walk(tree);
}
