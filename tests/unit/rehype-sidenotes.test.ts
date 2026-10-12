// tests/unit/rehype-sidenotes.test.ts
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSidenotes from "../../src/lib/rehype-sidenotes";

const MEDIA = "(max-width: 899.98px)";

/** Run the plugin over an HTML fragment, as Astro would after remark-rehype. */
function transform(html: string): string {
  const tree = fromHtml(html, { fragment: true });
  rehypeSidenotes()(tree);
  return toHtml(tree);
}

/** Drop the whitespace between block tags so fixtures can be written readably. */
const squash = (html: string) => html.replace(/>\s+</g, "><").trim();

const ref = (n: number, label = n) =>
  `<sup class="sidenote-ref"><a href="#fn-${n}" id="fnref-${n}" data-popover-target="fn-${n}" ` +
  `data-popover-media="${MEDIA}"><span class="visually-hidden">Note </span>${label}</a></sup>`;

/** A reference joined to the word before it. */
const anchored = (word: string, n: number) => `<span class="sidenote-anchor">${word}${ref(n)}</span>`;

const note = (n: number, body: string) =>
  `<aside class="sidenote" id="fn-${n}" role="note" aria-label="Note ${n}">` +
  `<a class="sidenote__n" href="#fnref-${n}" aria-label="Back to the text of note ${n}">${n}</a> ${body}</aside>`;

// remark-gfm + remark-rehype output for two footnotes, the second with a named label.
const INPUT = `
<p>First.<sup><a href="#user-content-fn-1" id="user-content-fnref-1" data-footnote-ref aria-describedby="footnote-label">1</a></sup> Second.<sup><a href="#user-content-fn-b" id="user-content-fnref-b" data-footnote-ref aria-describedby="footnote-label">2</a></sup></p>
<p>Plain.</p>
<section data-footnotes class="footnotes"><h2 class="sr-only" id="footnote-label">Footnotes</h2>
<ol>
<li id="user-content-fn-1">
<p>Bush, <em>Atlantic</em>, p. 108. <a href="#user-content-fnref-1" data-footnote-backref="" aria-label="Back to reference 1" class="data-footnote-backref">↩</a></p>
</li>
<li id="user-content-fn-b">
<p>See <a href="https://example.org/">the source</a>. <a href="#user-content-fnref-b" data-footnote-backref="" aria-label="Back to reference 2" class="data-footnote-backref">↩</a></p>
</li>
</ol>
</section>`;

const EXPECTED =
  note(1, "Bush, <em>Atlantic</em>, p. 108.") +
  note(2, `See <a href="https://example.org/">the source</a>.`) +
  `<p>${anchored("First.", 1)} ${anchored("Second.", 2)}</p>` +
  `<p>Plain.</p>`;

test("turns GFM footnotes into the SidenoteRef/Sidenote markup contract", () => {
  expect(squash(transform(INPUT))).toBe(squash(EXPECTED));
});

test("removes the footnotes section entirely", () => {
  const out = transform(INPUT);
  expect(out).not.toContain("data-footnotes");
  expect(out).not.toContain("footnote-label");
  expect(out).not.toContain("user-content-");
  expect(out).not.toContain("↩");
});

test("places each note before the top-level block that first references it", () => {
  const html = squash(
    transform(`
<p>One.<sup><a href="#user-content-fn-1" id="user-content-fnref-1" data-footnote-ref>1</a></sup></p>
<blockquote><p>Quoted.<sup><a href="#user-content-fn-2" id="user-content-fnref-2" data-footnote-ref>2</a></sup></p></blockquote>
<section data-footnotes class="footnotes"><ol>
<li id="user-content-fn-1"><p>A. <a href="#user-content-fnref-1" data-footnote-backref>↩</a></p></li>
<li id="user-content-fn-2"><p>B. <a href="#user-content-fnref-2" data-footnote-backref>↩</a></p></li>
</ol></section>`),
  );
  expect(html).toBe(
    squash(`${note(1, "A.")}<p>${anchored("One.", 1)}</p>${note(2, "B.")}<blockquote><p>${anchored("Quoted.", 2)}</p></blockquote>`),
  );
});

test("a repeated reference links to the same note without duplicating it or its id", () => {
  const html = squash(
    transform(`
<p>One.<sup><a href="#user-content-fn-1" id="user-content-fnref-1" data-footnote-ref>1</a></sup></p>
<p>Again.<sup><a href="#user-content-fn-1" id="user-content-fnref-1-2" data-footnote-ref>1</a></sup></p>
<section data-footnotes class="footnotes"><ol>
<li id="user-content-fn-1"><p>A. <a href="#user-content-fnref-1" data-footnote-backref>↩</a> <a href="#user-content-fnref-1-2" data-footnote-backref>↩<sup>2</sup></a></p></li>
</ol></section>`),
  );
  expect(html.match(/<aside/g)).toHaveLength(1);
  expect(html).toContain(`id="fnref-1-2"`);
  expect(html).toContain(`<p><span class="sidenote-anchor">Again.<sup class="sidenote-ref"><a href="#fn-1" id="fnref-1-2"`);
});

test("notes from 10 up carry the two-digit class", () => {
  const items = Array.from({ length: 10 }, (_, i) => i + 1);
  const html = transform(
    `<p>${items.map((n) => `x<sup><a href="#user-content-fn-${n}" id="user-content-fnref-${n}" data-footnote-ref>${n}</a></sup>`).join(" ")}</p>` +
      `<section data-footnotes class="footnotes"><ol>${items.map((n) => `<li id="user-content-fn-${n}"><p>N${n}.</p></li>`).join("")}</ol></section>`,
  );
  expect(html).toContain(`<sup class="sidenote-ref sidenote-ref--2"><a href="#fn-10"`);
  expect(html).toContain(`<sup class="sidenote-ref"><a href="#fn-9"`);
});

test("leaves a document without footnotes untouched", () => {
  const html = "<p>No notes here.</p>";
  expect(transform(html)).toBe(html);
});

test("works on the real remark-gfm pipeline output", async () => {
  const md = "Bush closed on the record.[^close]\n\nNext paragraph.\n\n[^close]: *The Atlantic*, July 1945, p. 108.\n";
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);
  const tree = await processor.run(processor.parse(md));
  rehypeSidenotes()(tree);
  expect(squash(toHtml(tree))).toBe(
    squash(`${note(1, "<em>The Atlantic</em>, July 1945, p. 108.")}<p>Bush closed on the ${anchored("record.", 1)}</p><p>Next paragraph.</p>`),
  );
});
