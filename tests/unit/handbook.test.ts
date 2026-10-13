// tests/unit/handbook.test.ts
import { expect, test } from "vitest";
import { checkLawBlock, citedPages, findFragment, indexHandbook, lawBlocks, normalize, quoteFragments } from "../../src/lib/handbook";

// Two pages of `pdftotext -layout` output: page 14 ends with an odd-page footer, page 15
// with an even-page one, and a quotation runs across the break and a line-end hyphen.
const TEXT = [
  "  (e) If a public record is in active use or storage and therefore not",
  "available at the time a citizen asks to examine it, the custodian",
  "                Freedom of Information Handbook, 22nd Edition | 14",
  "shall certify this fact in writing to the applicant and set a date and",
  "hour within three (3) working days. Infor-",
  "mation about state-",
  "agency records in the custodian’s files.",
  "15 | Freedom of Information Handbook, 22nd Edition",
].join("\n");

const index = indexHandbook(TEXT);

test("normalize drops quotation marks and entities, folds case and spaces", () => {
  expect(normalize("The custodian’s  “records” &amp; files")).toBe("the custodians records & files");
});

test("pages come from the footers; a quotation can cross a page break", () => {
  expect(findFragment(index, "the custodian shall certify this fact")).toEqual([{ first: 14, last: 15 }]);
  expect(findFragment(index, "set a date and hour within three (3) working days")).toEqual([{ first: 15, last: 15 }]);
});

test("a line-end hyphen is kept for a compound and dropped for a broken word", () => {
  expect(findFragment(index, "state-agency records")).toHaveLength(1);
  expect(findFragment(index, "information about")).toHaveLength(1);
  expect(findFragment(index, "no such words")).toEqual([]);
});

test("law blocks carry their notes; fragments split at ellipses", () => {
  const md = 'Text.\n\n<p class="law">§ 25-19-105(e): “the custodian shall certify … working days”</p>\n<!-- handbook p. 15 -->\n';
  const [block] = lawBlocks(md);
  expect(block).toMatchObject({ line: 3, note: "handbook p. 15" });
  expect(quoteFragments(block.body)).toEqual(["the custodian shall certify", "working days"]);
});

test("notes: one page, a range, an outside source, or nothing usable", () => {
  expect(citedPages("handbook p. 15")).toEqual({ kind: "handbook", from: 15, to: 15 });
  expect(citedPages("handbook pp. 21–22")).toEqual({ kind: "handbook", from: 21, to: 22 });
  expect(citedPages('handbook p. 8 prints "exists"; Act 879 reads "exist"')).toEqual({ kind: "handbook", from: 8, to: 8 });
  expect(citedPages("not in the handbook: Act 7 of 2023")).toEqual({ kind: "external" });
  expect(citedPages(null)).toEqual({ kind: "unknown" });
});

test("checkLawBlock passes a right quotation and flags a changed word, a wrong page and a missing note", () => {
  const block = (body: string, note: string | null) => ({ line: 1, body, note });
  expect(checkLawBlock(index, block("“set a date and hour within three (3) working days”", "handbook p. 15"))).toEqual([]);
  expect(checkLawBlock(index, block("“set a date and hour within five (5) working days”", "handbook p. 15"))[0]).toMatch(/not in the handbook/);
  expect(checkLawBlock(index, block("“set a date and hour within three (3) working days”", "handbook p. 9"))[0]).toMatch(/is on p\. 15, note says p\. 9/);
  expect(checkLawBlock(index, block("“set a date and hour”", null))[0]).toMatch(/needs a note/);
  expect(checkLawBlock(index, block("“anything at all”", "not in the handbook: RCFP"))).toEqual([]);
});
