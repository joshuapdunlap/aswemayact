// @ts-check
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import rehypeSidenotes from "./src/lib/rehype-sidenotes.ts";

// https://astro.build/config
export default defineConfig({
  site: "https://aswemayact.org",
  output: "static",
  // The styleguide pages are internal and /search/ has nothing of its own to index.
  integrations: [sitemap({ filter: (page) => !/\/(styleguide|styleguide-essay|search)\/$/.test(page) })],
  // The dev toolbar floats over pages in dev and e2e screenshots; the site has no use for it.
  devToolbar: { enabled: false },
  markdown: {
    // The remark/rehype pipeline, so essay footnotes ([^n]) can become margin sidenotes
    // (src/lib/rehype-sidenotes.ts emits the Sidenote.astro markup contract).
    processor: unified({ rehypePlugins: [rehypeSidenotes] }),
  },
});
