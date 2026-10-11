# aswemayact.org — Release 1 launch checklist

Status on 2026-10-11: the site is built, reviewed and in `C:\Users\Joshu\Desktop\aswemayact` as a clean single-commit `main` authored as `Joshua Dunlap <editor@aswemayact.org>`. Nothing is deployed yet. Full human steps are in the repo at `docs/DEPLOY.md`.

## To do (in order)

1. **Set up `editor@aswemayact.org`** — Cloudflare → aswemayact.org → Email → Email Routing → add the address, route it to your inbox, "Add records and enable" (adds MX, SPF and a DKIM TXT). This is the only public contact on the site and the git author address, so do it first.
2. **Create `.content-rules/excluded.txt`** in the repo (one name per line: every campaign, organization, investigation, vault and site you don't want mentioned). It is gitignored. The build's excluded-names lint warns loudly until it exists; after that it scans every tracked text file.
3. `npm ci`, then `npm test` once on your machine (Playwright will need `npx playwright install chromium` the first time). Expect 87 unit + 250 e2e green.
4. `npx wrangler login`, then `npm run deploy` (builds, then deploys to a `*.workers.dev` URL).
5. **Attach the domain** — Workers & Pages → aswemayact → Settings → Domains & Routes → Add → Custom Domain → `aswemayact.org` (delete any existing apex A/AAAA/CNAME first). Then the `www` → apex Bulk Redirect exactly as `DEPLOY.md` writes it (`https://www.aswemayact.org/*` → `https://aswemayact.org/${1}`, 301).
6. **Run the curl checks** in `DEPLOY.md` step 4: 200 on `/`, 404 on `/no-such-page/`, 307 trailing-slash redirect, `cache-control: immutable` on `/_astro/*` (confirms `public/_headers` took effect), range request on the Pagefind index.
7. **Web Analytics** — Analytics & Logs → Web Analytics → add site with the JS snippet (confirm automatic injection is off); paste the beacon token into the commented placeholder in `src/layouts/Periodical.astro`; redeploy.
8. `npm run archive` once (submits every page and cited URL to the Wayback Machine, 3/min; stops on the first 429), then `git tag deployed-2026-10-DD`.
9. Create the GitHub repo and push `main`. Add a `LICENSE`/`README` first if you want the code licence stated (content licences are already on About and in `llms.txt`).
10. Apply to **Cloudflare Project Galileo** once the site is live.

## Known limits left on purpose

- Fonts are Latin-only subsets; names with ā, ł, ő render in the fallback face.
- The search page fetches ~215 KB of Pagefind index after a query (page load itself is ~106 KB).
- The archive script's 200 from Save Page Now does not prove a capture; check the log after the first run.
- Local builds rewrite `src/data/recent.json` — commit it with content changes.
- `docs/superpowers` (spec, plan, ledger) are no longer in the repo; copies are in this project and in `_to_delete\superpowers-planning-docs` on your machine.

## Release 2 and 3 (from the spec)

- R2: Spanish and Marshallese one-pagers for your-rights and write-a-request; public request/response log opened to submissions, reviewed before posting.
- R3: Act 505 posting audit of the 75 quorum courts and the largest councils and school boards, by county, annual.
- Cadence: one trail a month; manual re-reviewed quarterly; corrections within 48 hours.
