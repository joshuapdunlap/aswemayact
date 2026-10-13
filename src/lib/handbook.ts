// Checks a manual page's "What the law says" quotations against the Attorney General's
// handbook. Pure functions; scripts/check-content.ts supplies the handbook text, which is
// `pdftotext -layout` output of the PDF (scripts/fetch-handbook.ts writes it).
//
// A law block is `<p class="law">…</p>` followed by an HTML comment naming where the
// quotation is printed: "handbook p. 15", "handbook pp. 21–22", or "not in the handbook: …"
// for a quotation from another source, which is not checked here.

export interface HandbookIndex {
  /** Normalized text, a line-end hyphen kept ("state-agency"). */
  keep: string;
  /** The same text with a line-end hyphen dropped ("infor-mation" → "information"). */
  drop: string;
  /** Page of each character in `keep` and `drop` (the two differ only in length). */
  keepPages: number[];
  dropPages: number[];
}

export interface LawBlock {
  /** 1-based line of the block in the Markdown file. */
  line: number;
  body: string;
  note: string | null;
}

export type CitedPages = { kind: "handbook"; from: number; to: number } | { kind: "external" } | { kind: "unknown" };

const FOOTER_ODD = /Freedom of Information Handbook, 22nd Edition \| (\d+)\s*$/;
const FOOTER_EVEN = /^\s*(\d+) \| Freedom of Information Handbook, 22nd Edition\s*$/;
const ENTITIES: Record<string, string> = { "&amp;": "&", "&nbsp;": " ", "&#39;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">" };

/** Lower case, one space between words, no quotation marks or apostrophes, plain dashes. */
export function normalize(s: string): string {
  return s
    .replace(/&(amp|nbsp|#39|quot|lt|gt);/g, (m) => ENTITIES[m])
    .replace(/[‘’“”'"`]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/�/g, "§")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Index the handbook text by page. Page footers mark the end of each page. */
export function indexHandbook(text: string): HandbookIndex {
  const out = { keep: "", drop: "", keepPages: [] as number[], dropPages: [] as number[] };
  const pending: string[] = [];
  const flush = (page: number) => {
    for (let i = 0; i < pending.length; i++) {
      const line = normalize(pending[i]);
      if (!line) continue;
      const hyphen = line.endsWith("-") && i + 1 < pending.length;
      const keep = hyphen ? line : `${line} `;
      const drop = hyphen ? line.slice(0, -1) : `${line} `;
      out.keep += keep;
      out.drop += drop;
      out.keepPages.push(...Array<number>(keep.length).fill(page));
      out.dropPages.push(...Array<number>(drop.length).fill(page));
    }
    pending.length = 0;
  };
  for (const line of text.split(/\r?\n/)) {
    const m = FOOTER_ODD.exec(line) ?? FOOTER_EVEN.exec(line);
    if (m) flush(Number(m[1]));
    else pending.push(line);
  }
  flush(0); // text after the last footer has no page
  return out;
}

/** Every law block in a Markdown file, with the comment that follows it. */
export function lawBlocks(markdown: string): LawBlock[] {
  const blocks: LawBlock[] = [];
  const re = /<p class="law">([\s\S]*?)<\/p>(?:\s*<!--([\s\S]*?)-->)?/g;
  for (let m = re.exec(markdown); m; m = re.exec(markdown)) {
    blocks.push({
      line: markdown.slice(0, m.index).split("\n").length,
      body: m[1],
      note: m[2] === undefined ? null : m[2].trim(),
    });
  }
  return blocks;
}

/** The quoted words in a block, split at each ellipsis; very short fragments are dropped. */
export function quoteFragments(body: string): string[] {
  const quotes = [...body.matchAll(/“([\s\S]*?)”/g)].map((m) => m[1]);
  return quotes
    .flatMap((q) => q.split(/\s*…\s*/))
    .map((f) => normalize(f).replace(/^[\s.,;:]+|[\s.,;:]+$/g, ""))
    .filter((f) => f.length >= 8);
}

export function citedPages(note: string | null): CitedPages {
  if (note === null) return { kind: "unknown" };
  if (/^not in the handbook\b/i.test(note)) return { kind: "external" };
  const m = /^handbook pp?\.\s*(\d+)(?:\s*[–-]\s*(\d+))?/i.exec(note);
  if (!m) return { kind: "unknown" };
  const from = Number(m[1]);
  return { kind: "handbook", from, to: m[2] ? Number(m[2]) : from };
}

/** Every place a fragment is printed, as first and last page; empty if it is not in the text. */
export function findFragment(index: HandbookIndex, fragment: string): { first: number; last: number }[] {
  const found: { first: number; last: number }[] = [];
  for (const [text, pages] of [
    [index.keep, index.keepPages],
    [index.drop, index.dropPages],
  ] as const) {
    for (let at = text.indexOf(fragment); at !== -1; at = text.indexOf(fragment, at + 1)) {
      found.push({ first: pages[at], last: pages[at + fragment.length - 1] });
    }
    if (found.length) break;
  }
  return found;
}

/** Problems with one block: a missing or unreadable note, an unmatched quotation, a wrong page. */
export function checkLawBlock(index: HandbookIndex, block: LawBlock): string[] {
  const cited = citedPages(block.note);
  if (cited.kind === "external") return [];
  if (cited.kind === "unknown") {
    return [`line ${block.line}: law block needs a note like <!-- handbook p. 15 --> or <!-- not in the handbook: … -->`];
  }
  const problems: string[] = [];
  for (const fragment of quoteFragments(block.body)) {
    const places = findFragment(index, fragment);
    const short = fragment.length > 60 ? `${fragment.slice(0, 57)}…` : fragment;
    if (places.length === 0) {
      problems.push(`line ${block.line}: not in the handbook: "${short}"`);
    } else if (!places.some((p) => p.first >= cited.from && p.last <= cited.to)) {
      const found = places[0];
      const where = found.first === found.last ? `p. ${found.first}` : `pp. ${found.first}–${found.last}`;
      const note = cited.from === cited.to ? `p. ${cited.from}` : `pp. ${cited.from}–${cited.to}`;
      problems.push(`line ${block.line}: "${short}" is on ${where}, note says ${note}`);
    }
  }
  return problems;
}
