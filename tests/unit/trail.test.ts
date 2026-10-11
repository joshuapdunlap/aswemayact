// tests/unit/trail.test.ts
import { splitStopsHtml } from "../../src/lib/trail";

test("splitStopsHtml returns each stop's narration without its heading", () => {
  const html =
    `<p>Intro.</p>\n<h2 id="stop-1">Stop 1</h2>\n<p>One.</p>\n` +
    `<h2 id="stop-2">Stop 2</h2>\n<p>Two.</p>\n<p>More.</p>`;
  expect(splitStopsHtml(html)).toEqual({
    intro: "<p>Intro.</p>",
    stops: { 1: "<p>One.</p>", 2: "<p>Two.</p>\n<p>More.</p>" },
  });
});

test("splitStopsHtml ends a stop at the next h2 of any kind", () => {
  const html = `<h2 id="stop-1">Stop 1</h2><p>One.</p><h2 id="notes">Notes</h2><p>Tail.</p>`;
  expect(splitStopsHtml(html).stops).toEqual({ 1: "<p>One.</p>" });
});

test("splitStopsHtml with no stop headings returns the whole body as intro", () => {
  expect(splitStopsHtml("<p>Only.</p>")).toEqual({ intro: "<p>Only.</p>", stops: {} });
});
