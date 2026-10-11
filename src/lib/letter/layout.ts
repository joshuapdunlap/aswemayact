// Letter layout from sentence kinds: which lines form the date, the addressee block, the
// salutation, the paragraphs, the numbered items and the signature. Shared by the preview
// (HTML) and the plain-text copy/download so both set the letter the same way. Pure; no DOM.

import type { Sentence } from "./model";

export type BlockType = "date" | "address" | "salutation" | "heading" | "paragraph" | "items" | "lines" | "signature";

export interface Block {
  type: BlockType;
  sentences: Sentence[];
}

/** The letter's date line as the generator writes it: "9 October 2026". */
const DATE_LINE = /^\d{1,2} [A-Z][a-z]+ \d{4}$/;

const kindOf = (s: Sentence) => s.kind ?? "paragraph";

/** Groups sentences into blocks. Leading meta lines are date, addressee and salutation (the
 *  salutation is always the last of them); trailing meta lines are the signature. In the body,
 *  consecutive items form one list and consecutive paragraph sentences resting on the same
 *  basis (and carrying no extra `opinions`) form one paragraph. */
export function layoutLetter(sentences: Sentence[]): Block[] {
  let head = 0;
  while (head < sentences.length && kindOf(sentences[head]) === "meta") head++;
  let tail = sentences.length;
  while (tail > head && kindOf(sentences[tail - 1]) === "meta") tail--;

  const blocks: Block[] = [];
  const lead = sentences.slice(0, head);
  if (lead.length) {
    const salutation = lead.pop() as Sentence;
    if (lead.length && DATE_LINE.test(lead[0].text)) blocks.push({ type: "date", sentences: [lead.shift() as Sentence] });
    if (lead.length) blocks.push({ type: "address", sentences: lead });
    blocks.push({ type: "salutation", sentences: [salutation] });
  }

  for (const s of sentences.slice(head, tail)) {
    const prev = blocks[blocks.length - 1];
    const kind = kindOf(s);
    if (kind === "item") {
      if (prev?.type === "items") prev.sentences.push(s);
      else blocks.push({ type: "items", sentences: [s] });
    } else if (kind === "paragraph") {
      const last = prev?.type === "paragraph" ? prev.sentences[prev.sentences.length - 1] : undefined;
      // A sentence with its own extra authority keeps its own span, so its tooltip covers only it.
      if (last && last.basis === s.basis && !last.opinions && !s.opinions) prev!.sentences.push(s);
      else blocks.push({ type: "paragraph", sentences: [s] });
    } else if (kind === "heading") {
      blocks.push({ type: "heading", sentences: [s] });
    } else {
      if (prev?.type === "lines") prev.sentences.push(s);
      else blocks.push({ type: "lines", sentences: [s] });
    }
  }

  const sign = sentences.slice(tail);
  if (sign.length && tail > head) blocks.push({ type: "signature", sentences: sign });
  return blocks;
}

/** Plain text for copy and download: blank lines between blocks, a paragraph's sentences on
 *  one line, list items and address/signature lines one per line. Ends with a newline. */
export function letterToText(sentences: Sentence[]): string {
  return (
    layoutLetter(sentences)
      .map((b) => b.sentences.map((s) => s.text).join(b.type === "paragraph" ? " " : "\n"))
      .join("\n\n") + "\n"
  );
}
