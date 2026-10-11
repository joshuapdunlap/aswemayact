// Internal-link gate: every href and src in the built site that points inside it must
// reach a built file, and every #fragment an id on the target page. Pure functions;
// tests/e2e/links.preview.spec.ts walks dist/ with them after the build.

import { fromHtml } from "hast-util-from-html";
import type { Element, Root, RootContent } from "hast";

/**
 * A reference inside the site: the path it asks for, the fragment decoded (null when none),
 * and whether it is fragment-only ("#x"), which always means the same document, even on
 * the 404 page that is served at every unknown path.
 */
export type InternalRef = { path: string; fragment: string | null; samePage: boolean };

const BASE = "https://site.invalid";

/**
 * Where `value` (an href or src on the page served at `pagePath`) points inside the site,
 * or null for external URLs, other schemes (mailto:, tel:, data:, javascript:), a bare
 * "#" and empty values. Query strings are dropped.
 */
export function internalRef(value: string, pagePath: string): InternalRef | null {
  const v = value.trim();
  if (v === "" || v === "#" || v.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  const url = new URL(v, BASE + pagePath);
  const hash = url.hash.slice(1);
  return {
    path: decodeURIComponent(url.pathname),
    fragment: hash ? decodeURIComponent(hash) : null,
    samePage: v.startsWith("#"),
  };
}

/**
 * The built file that serves `path`, following Workers static assets with
 * html_handling "auto-trailing-slash": `/x/` → dist/x/index.html, `/x` → dist/x (a file),
 * dist/x.html or dist/x/index.html. Null when none exists.
 */
export function distFileFor(path: string, exists: (file: string) => boolean, dist = "dist"): string | null {
  const rel = path.replace(/^\/+/, "");
  const candidates = path.endsWith("/")
    ? [`${dist}/${rel}index.html`]
    : [`${dist}/${rel}`, `${dist}/${rel}.html`, `${dist}/${rel}/index.html`];
  return candidates.find((f) => exists(f)) ?? null;
}

/** Every href and src on the page, in document order, and the ids (and a[name]) it defines. */
export function collectRefsAndIds(html: string): { refs: { attr: "href" | "src"; value: string }[]; ids: Set<string> } {
  const refs: { attr: "href" | "src"; value: string }[] = [];
  const ids = new Set<string>();
  const walk = (node: Root | RootContent) => {
    if (node.type === "element") {
      const el = node as Element;
      const p = el.properties ?? {};
      if (typeof p.id === "string") ids.add(p.id);
      if (el.tagName === "a" && typeof p.name === "string") ids.add(p.name);
      if (typeof p.href === "string") refs.push({ attr: "href", value: p.href });
      if (typeof p.src === "string") refs.push({ attr: "src", value: p.src });
      // <template> content lives on .content in hast.
      const content = (el as Element & { content?: Root }).content;
      if (content) walk(content);
    }
    if ("children" in node) for (const child of node.children) walk(child);
  };
  walk(fromHtml(html));
  return { refs, ids };
}
