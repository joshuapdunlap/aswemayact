# As We May Act

Public records in Arkansas, and what to do with them.

[aswemayact.org](https://aswemayact.org) is a plain-language guide to the Arkansas Freedom of Information Act for ordinary Arkansans: what the law lets you see, what a copy costs, how fast it has to come, how to write a request an agency can't dodge, and what to do when the answer is no. It has a letter builder that drafts the request with you, citing the subsection each sentence rests on, and a set of short "trails" that run from a passage or a public record to something you can do. The name finishes a sentence Vannevar Bush left open in 1945.

The site is static. Nothing you type into the builder is stored or sent anywhere.

## Running it

Requires Node 22.

```
npm ci
npm run build      # lints content, checks links, builds dist/, indexes search
npm run preview    # serves dist/ locally
npm test           # unit tests, then browser tests against the built site
```

`npm run build` runs a content check first: every passage quotation is capped at 25 words and must carry a locator, every statute citation must be well-formed, every external link must answer, and an optional local list of excluded names (`.content-rules/excluded.txt`, not committed) must match nothing in the tree.

Deployment and operations are in [docs/DEPLOY.md](docs/DEPLOY.md).

## Layout

- `src/content/manual/` — the field manual, one Markdown file per page. Each "What the law says" block quotes the Attorney General's current FOIA handbook, with the page noted in a comment.
- `src/content/sources/` — source cards.
- `src/content/trails/` — trails, with typed stops in frontmatter and narration under `## Stop n` headings.
- `src/content/essays/` — signed essays. Footnotes become sidenotes at build time.
- `src/content/corrections/` — the corrections log.
- `src/lib/letter/` — the letter generator, pure functions with their own tests.
- `src/styles/` — the design tokens and the periodical layout.
- `scripts/` — the content check, the Wayback archiving script, font subsetting, Lighthouse runner.

## Corrections

If something on the site is wrong, write to editor@aswemayact.org. Corrections are posted at [aswemayact.org/corrections](https://aswemayact.org/corrections/) within 48 hours of being confirmed.

## Licences

The code in this repository is released under the MIT License (see [LICENSE](LICENSE)).

The site's content has its own terms, stated on every page: the field manual, source cards and letter-builder text are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); essays and trails are [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/). Quotations from the Arkansas Code and the Attorney General's handbook are public records. Fonts (Newsreader, Libre Franklin, IBM Plex Mono) are under the SIL Open Font License.
