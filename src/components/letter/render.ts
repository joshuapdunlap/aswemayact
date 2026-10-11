// HTML for a generated letter, as a string so the page can render it at build time and the
// client can re-render it on every keystroke with the same markup. Pure; no DOM.
// Every sentence that rests on the law is a focusable <span data-basis title> holding a
// .basis label that the stylesheet shows under the sentence while it has focus. A sentence's
// `opinions` (set by the generator, never inferred from text) is added to its tooltip.

import { PROXY_OPINIONS, type Sentence } from "../../lib/letter/model";
import { layoutLetter, type Block } from "../../lib/letter/layout";

export { PROXY_OPINIONS };

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped text with "§" held to the number after it, so a citation never breaks at the sign. */
const typeset = (s: string) => escapeHtml(s).replace(/§ /g, "§\u00a0");

/** Sentences sharing one basis, as one span; plain escaped text when there is no basis. */
function sentenceSpan(sentences: Sentence[]): string {
  const text = typeset(sentences.map((s) => s.text).join(" "));
  const basis = sentences[0]?.basis;
  if (!basis) return text;
  const opinions = sentences.find((s) => s.opinions)?.opinions;
  const title = `Rests on ${basis}${opinions ? `; ${opinions}` : ""}`;
  const b = escapeHtml(basis);
  return `<span class="sentence" tabindex="0" data-basis="${b}" title="${escapeHtml(title)}">${text}<span class="basis">${b}</span></span>`;
}

const lines = (sentences: Sentence[]) => sentences.map((s) => typeset(s.text)).join("<br>");

function blockHtml(b: Block): string {
  switch (b.type) {
    case "items":
      return `<ol class="letter__items">${b.sentences.map((s) => `<li>${sentenceSpan([s])}</li>`).join("")}</ol>`;
    case "paragraph":
      return `<p class="letter__para">${sentenceSpan(b.sentences)}</p>`;
    case "heading":
      return `<p class="letter__heading">${sentenceSpan(b.sentences)}</p>`;
    default:
      return `<p class="letter__${b.type}">${lines(b.sentences)}</p>`;
  }
}

/** The letter body as HTML (no wrapper element). */
export function letterHtml(sentences: Sentence[]): string {
  return layoutLetter(sentences).map(blockHtml).join("");
}
