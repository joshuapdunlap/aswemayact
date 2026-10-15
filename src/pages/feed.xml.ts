// The Atom feed: trails, the essay and the corrections log (src/lib/feed.ts).
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { atomFeed, feedEntries } from "../lib/feed";

export const GET: APIRoute = async ({ site }) => {
  const [trails, essays, corrections] = await Promise.all([
    getCollection("trails"),
    getCollection("essays"),
    getCollection("corrections"),
  ]);
  const entries = feedEntries({
    trails: trails.map((t) => t.data),
    essays: essays.map((e) => e.data),
    corrections: corrections.map((c) => ({ id: c.id, ...c.data })),
  });
  const xml = atomFeed(entries, {
    site: site?.href ?? "https://aswemayact.org",
    title: "As We May Act",
    subtitle: "New trails and corrections from a field manual for the Arkansas Freedom of Information Act.",
  });
  return new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
};
