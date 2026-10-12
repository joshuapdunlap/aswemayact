// Rehype plugin: GFM footnotes (remark-gfm + remark-rehype output) become sidenotes.
//
// Emits exactly the markup contract documented at the top of components/Sidenote.astro:
// each reference becomes <sup class="sidenote-ref"><a href="#fn-n" id="fnref-n"
// data-popover-target="fn-n" data-popover-media="…">…</a></sup>, and each note becomes an
// <aside class="sidenote" id="fn-n" role="note"> placed as a direct child of the document
// (the .measure flow) right before the top-level block that first references it, so in the
// margin it floats level with that block's first line rather than the block after. The
// default footnotes <section> is removed. Notes are numbered in the order remark-gfm
// numbers them, so `[^label]` names work as well as `[^1]`.
import type { Root, RootContent, Element, ElementContent, Text } from "hast";

const MEDIA = "(max-width: 899.98px)";
const PREFIX = "user-content-";

type Note = { n: number; content: ElementContent[]; placed: boolean };

function isElement(node: unknown, tag?: string): node is Element {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Element).type === "element" &&
    (tag === undefined || (node as Element).tagName === tag)
  );
}

function isFootnoteSection(node: RootContent): node is Element {
  return isElement(node, "section") && node.properties?.dataFootnotes !== undefined;
}

/** Footnote label from an id or href such as "user-content-fn-b" or "#user-content-fn-b". */
function labelOf(value: unknown, kind: "fn" | "fnref"): string | null {
  if (typeof value !== "string") return null;
  const m = value.replace(/^#/, "").match(new RegExp(`^${PREFIX}${kind}-(.+)$`));
  return m ? m[1] : null;
}

function text(value: string): Text {
  return { type: "text", value };
}

function trimEnd(nodes: ElementContent[]): ElementContent[] {
  const out = [...nodes];
  while (out.length) {
    const last = out[out.length - 1];
    if (last.type !== "text") break;
    const value = last.value.replace(/\s+$/, "");
    if (value) {
      out[out.length - 1] = text(value);
      break;
    }
    out.pop();
  }
  return out;
}

/** A note's body: the <li>'s content without back-links; a lone paragraph is unwrapped. */
function noteContent(li: Element): ElementContent[] {
  const stripBackrefs = (nodes: ElementContent[]): ElementContent[] =>
    nodes
      .filter((c) => !(isElement(c) && c.properties?.dataFootnoteBackref !== undefined))
      .map((c) => (isElement(c) ? { ...c, children: stripBackrefs(c.children) } : c));
  const blocks = stripBackrefs(li.children).filter((c) => !(c.type === "text" && !c.value.trim()));
  if (blocks.length === 1 && isElement(blocks[0], "p")) return trimEnd(blocks[0].children);
  return blocks.map((b) => (isElement(b) ? { ...b, children: trimEnd(b.children) } : b));
}

function refMarkup(n: number, id: string): Element {
  return {
    type: "element",
    tagName: "sup",
    // Two-digit numerals take back less of the 24px target (components.css).
    properties: { className: n >= 10 ? ["sidenote-ref", "sidenote-ref--2"] : ["sidenote-ref"] },
    children: [
      {
        type: "element",
        tagName: "a",
        properties: {
          href: `#fn-${n}`,
          id,
          dataPopoverTarget: `fn-${n}`,
          dataPopoverMedia: MEDIA,
        },
        children: [
          { type: "element", tagName: "span", properties: { className: ["visually-hidden"] }, children: [text("Note ")] },
          text(String(n)),
        ],
      },
    ],
  };
}

function asideMarkup(note: Note): Element {
  return {
    type: "element",
    tagName: "aside",
    properties: { className: ["sidenote"], id: `fn-${note.n}`, role: "note", ariaLabel: `Note ${note.n}` },
    children: [
      {
        type: "element",
        tagName: "a",
        properties: {
          className: ["sidenote__n"],
          href: `#fnref-${note.n}`,
          ariaLabel: `Back to the text of note ${note.n}`,
        },
        children: [text(String(note.n))],
      },
      text(" "),
      ...note.content,
    ],
  };
}

/**
 * The reference, joined to the word before it in a no-wrap span so the number never starts
 * a line of its own. Takes that word out of the preceding text node (mutating it); when
 * there is no word right before the reference, the reference stands alone.
 */
function anchorWithPrecedingWord(prev: ElementContent | RootContent | undefined, ref: Element): Element {
  if (prev?.type !== "text") return ref;
  const m = prev.value.match(/\S+$/);
  if (!m) return ref;
  prev.value = prev.value.slice(0, -m[0].length);
  return {
    type: "element",
    tagName: "span",
    properties: { className: ["sidenote-anchor"] },
    children: [text(m[0]), ref],
  };
}

/**
 * Rewrite footnote references under `node`; return the notes first referenced there, in
 * order. `seen` counts references per note so a repeat gets its own id (fnref-n-2…).
 */
function rewriteRefs(node: Element | Root, notes: Map<string, Note>, seen: Map<number, number>, out: Note[]): void {
  node.children.forEach((child, i) => {
    if (!isElement(child)) return;
    const a = isElement(child, "sup") ? child.children.find((c) => isElement(c, "a")) : undefined;
    if (isElement(a) && a.properties?.dataFootnoteRef !== undefined) {
      const note = notes.get(labelOf(a.properties.href, "fn") ?? "");
      if (note) {
        const count = (seen.get(note.n) ?? 0) + 1;
        seen.set(note.n, count);
        const ref = refMarkup(note.n, count === 1 ? `fnref-${note.n}` : `fnref-${note.n}-${count}`);
        node.children[i] = anchorWithPrecedingWord(node.children[i - 1], ref);
        if (!note.placed) {
          note.placed = true;
          out.push(note);
        }
        return;
      }
    }
    rewriteRefs(child, notes, seen, out);
  });
}

export default function rehypeSidenotes() {
  return (tree: Root): void => {
    const sectionIndex = tree.children.findIndex(isFootnoteSection);
    if (sectionIndex === -1) return;
    const section = tree.children[sectionIndex] as Element;
    tree.children.splice(sectionIndex, 1);
    // Drop the newline text node the section leaves behind.
    const prev = tree.children[sectionIndex - 1];
    if (prev?.type === "text" && !prev.value.trim()) tree.children.splice(sectionIndex - 1, 1);

    const ol = section.children.find((c) => isElement(c, "ol"));
    const notes = new Map<string, Note>();
    if (isElement(ol)) {
      ol.children.filter((c): c is Element => isElement(c, "li")).forEach((li, i) => {
        const label = labelOf(li.properties?.id, "fn");
        if (label !== null) notes.set(label, { n: i + 1, content: noteContent(li), placed: false });
      });
    }

    const seen = new Map<number, number>();
    const children: RootContent[] = [];
    for (const block of tree.children) {
      if (isElement(block)) {
        const first: Note[] = [];
        rewriteRefs(block, notes, seen, first);
        for (const note of first) children.push(asideMarkup(note), text("\n"));
      }
      children.push(block);
    }
    tree.children = children;
  };
}
