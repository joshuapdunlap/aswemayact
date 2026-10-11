// A trail's Markdown body holds each stop's narration under a `## Stop n` heading
// (spec §5). The trail page renders the body once and hands each stop its own part.

export type TrailSections = { intro: string; stops: Record<number, string> };

const H2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/g;

/**
 * Split rendered trail HTML at its h2 headings. Text under `Stop n` becomes stop n's
 * narration (heading removed); text before the first h2 is the intro; any other h2 ends
 * the stop above it and is dropped with its section.
 */
export function splitStopsHtml(html: string): TrailSections {
  const heads = [...html.matchAll(H2)];
  const intro = html.slice(0, heads[0]?.index ?? html.length).trim();
  const stops: Record<number, string> = {};
  heads.forEach((m, i) => {
    const label = m[1].replace(/<[^>]+>/g, "").trim();
    const n = label.match(/^Stop\s+(\d+)$/i);
    if (!n) return;
    const start = m.index! + m[0].length;
    const end = heads[i + 1]?.index ?? html.length;
    stops[Number(n[1])] = html.slice(start, end).trim();
  });
  return { intro, stops };
}
