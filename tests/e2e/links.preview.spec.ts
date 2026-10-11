// Internal-link gate: runs in preview-desktop-light after the preview server has built
// dist/. Reads the built HTML from disk; every internal href/src must reach a built file,
// and every #fragment an id on the target page.
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import fg from "fast-glob";
import { pagePathFromDist } from "../../src/lib/archive";
import { collectRefsAndIds, distFileFor, internalRef } from "../../src/lib/internal-links";

test("every internal link and asset in dist/ resolves, fragments included", async () => {
  const files = (await fg("dist/**/*.html")).sort();
  expect(files.length).toBeGreaterThan(15);

  const pages = new Map(files.map((f) => [f, collectRefsAndIds(readFileSync(f, "utf8"))]));
  const idsOf = (file: string) => pages.get(file)?.ids ?? collectRefsAndIds(readFileSync(file, "utf8")).ids;

  const broken: string[] = [];
  let checked = 0;
  for (const [file, { refs }] of pages) {
    const pagePath = pagePathFromDist(file);
    for (const { attr, value } of refs) {
      const ref = internalRef(value, pagePath);
      if (!ref) continue;
      checked++;
      // "#x" is the same document wherever it is served (the 404 page answers every unknown path).
      const target = ref.samePage ? file : distFileFor(ref.path, existsSync);
      if (!target) {
        broken.push(`${file}: ${attr}="${value}": no built file for ${ref.path}`);
        continue;
      }
      if (ref.fragment && target.endsWith(".html") && !idsOf(target).has(ref.fragment)) {
        broken.push(`${file}: ${attr}="${value}": no id "${ref.fragment}" in ${target}`);
      }
    }
  }
  expect(checked).toBeGreaterThan(100);
  expect(broken).toEqual([]);
});
