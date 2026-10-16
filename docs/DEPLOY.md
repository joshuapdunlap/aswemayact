# Deploying aswemayact.org

The site is static: `npm run build` writes `dist/`, and Cloudflare Workers static assets
serves it (`wrangler.jsonc`: no Worker script, `not_found_handling: "404-page"`,
`html_handling: "auto-trailing-slash"`). Deploys are run by hand from a local checkout.
CI (`.github/workflows/check.yml`) only runs the tests, plus a strict check of every
external link at 13:17 UTC on the first of each month.

All dates below are UTC. Commands are given for a POSIX shell, with the PowerShell form
where it differs. In Windows PowerShell use `curl.exe`, not `curl` (an alias for
`Invoke-WebRequest` there).

## Before every deploy

1. Working tree clean and on the branch being released; `npm ci` if dependencies changed.
2. `.content-rules/excluded.txt` exists (one name per line, `#` for comments; gitignored,
   kept out of the repository). Copy it into a fresh checkout before building. Without
   it the content check prints
   `warn: .content-rules/excluded.txt not found — excluded-names rule skipped` and the
   build goes ahead unchecked; with it, every tracked text file and `public/llms.txt`
   are scanned.
3. `npm test` passes (unit, then Playwright against dev and the built preview).
4. Build: `npm run build`. Then `git status`: the build's `prebuild` step
   (`scripts/recent-changes.ts`) rewrites the tracked `src/data/recent.json` from git
   history. If it changed, commit it (`git commit -m "chore: refresh recent list" src/data/recent.json`)
   so the tagged commit is what is live.
5. Optional check of the config without uploading: `npm run deploy:dry`. It validates
   whatever `dist/` currently holds, so build first (step 4). Expected:
   `Read 9x files from the assets directory …/dist`, `No bindings found.`,
   `--dry-run: exiting now.`

### Proxy setting

`NODE_USE_ENV_PROXY=1` is only needed where outbound requests must go through an HTTP
proxy (`HTTPS_PROXY`), so the content check's link probing uses it; not on a direct
connection or in CI.

## First deploy (one time)

### Step 2: log in and deploy

```sh
npx wrangler login          # opens a browser; authorise the Cloudflare account
npm run deploy              # = npm run build && wrangler deploy
```

Expected: wrangler prints the uploaded asset count and a URL of the form
`https://aswemayact.<account-subdomain>.workers.dev`. Open it: the front page loads,
`/no-such-page/` shows "This page is not in the record." with status 404.

### Step 3: attach the domain

The domain's DNS must already be on Cloudflare (zone `aswemayact.org` active).

1. Dashboard → zone **aswemayact.org** → **DNS** → **Records**: delete any existing
   `A`, `AAAA` or `CNAME` record for the apex (`aswemayact.org` / `@`), such as a
   registrar parking record; the custom domain cannot be added while one exists.
2. Dashboard → **Workers & Pages** → **aswemayact** → **Settings** → **Domains & Routes**
   → **Add** → **Custom Domain** → `aswemayact.org` → **Add domain**. Cloudflare creates
   the DNS record and certificate (a few minutes).
3. `www` → apex redirect:
   - **DNS** → **Records** → **Add record**: type `AAAA`, name `www`, IPv6 `100::`,
     proxy status **Proxied**. (A placeholder address; the redirect rule answers first.)
   - **Rules** → **Redirect Rules** → **Create rule** → template
     **Redirect from WWW to root**, then set: request URL `https://www.aswemayact.org/*`,
     target `https://aswemayact.org/${1}`, status **301**, **Preserve query string** on.
     Deploy. (Do not wildcard the TLD: `*` also matches `/`, so
     `https://www.aswemayact.*` would capture `org/manual/` and redirect to `/org/manual/`.)
4. Leave the `workers.dev` route enabled or disable it (Settings → Domains & Routes →
   workers.dev → Disable); the site carries no canonical tags pointing to it, so
   disabling avoids a duplicate copy.

Check:

```sh
curl -sI https://aswemayact.org/
```

Expected (other headers vary):

```
HTTP/2 200
content-type: text/html; charset=utf-8
cache-control: public, max-age=0, must-revalidate
etag: "…"
```

```sh
curl -sI "https://www.aswemayact.org/manual/?x=1"  # 301, location: https://aswemayact.org/manual/?x=1
curl -sI https://aswemayact.org/manual             # 307, location: /manual/   (auto-trailing-slash)
curl -sI https://aswemayact.org/no-such-page/      # 404, content-type: text/html
```

### Step 4: range requests and caching

Pagefind fetches its index files in pieces. File names carry a content hash, so read
the current names from the local build:

```sh
ls dist/pagefind/index/          # e.g. en_4bb5e89.pf_index
ls dist/pagefind/*.pf_meta       # e.g. dist/pagefind/pagefind.en_862a98b3f4.pf_meta
ls dist/_astro/*.woff2           # e.g. newsreader-latin-roman.BgIgoah_.woff2
```

(PowerShell: `Get-ChildItem dist\pagefind\index`, and so on.)

```sh
curl -s -o /dev/null -D - -r 0-99 https://aswemayact.org/pagefind/index/<en_xxxxxxx>.pf_index
```

(PowerShell: `-o NUL` instead of `-o /dev/null`.)

Expected: either `HTTP/2 206` with `content-range: bytes 0-99/<size>` and
`content-length: 100`, or `HTTP/2 200` with the full length. Record which in the deploy
note below; both work with Pagefind (206 only saves bytes).

```sh
curl -sI https://aswemayact.org/_astro/<newsreader-latin-roman.xxxxxxxx>.woff2
```

Expected: `HTTP/2 200`, `content-type: font/woff2` and
`cache-control: public, max-age=31536000, immutable`. That value comes from
`public/_headers` (copied to `dist/_headers`; Workers static assets applies it and does
not serve the file), which gives a year's cache to the hashed files under `/_astro/`,
`/pagefind/fragment/` and `/pagefind/index/`. Every other file keeps the Workers default,
`public, max-age=0, must-revalidate` with an `etag`. Every response, HTML included,
also carries `x-content-type-options: nosniff` and
`referrer-policy: strict-origin-when-cross-origin`:

```sh
curl -sI https://aswemayact.org/ | grep -i -e x-content-type-options -e referrer-policy
```

If the font shows `max-age=0`, `_headers` was not picked up: check `ls dist/_headers`.
Record the value.

### Step 5: Email Routing and Web Analytics

**Email Routing** (`editor@aswemayact.org` → the editor's inbox):

1. Dashboard → zone **aswemayact.org** → **Email** → **Email Routing** → **Get started**.
2. **Destination addresses** → add the inbox; open the verification mail and confirm.
3. **Routing rules** → **Create address**: custom address `editor`, action
   **Send to an email**, destination the verified inbox → Save.
4. When asked, **Add records and enable** (Cloudflare adds its MX records and an SPF
   `TXT`). Remove any older MX records it flags.
5. Test: from an unrelated account, send a message to `editor@aswemayact.org`; it should
   arrive within a minute. Check **Email Routing → Overview** shows it as forwarded.
   Email Routing only receives; replies go out from the destination inbox.

**Web Analytics** (cookieless beacon, spec §8):

1. Dashboard → **Analytics & Logs** → **Web Analytics** → **Add a site** → hostname
   `aswemayact.org` → choose the **manual** JavaScript snippet setup (not automatic
   injection, which would add a second beacon). Copy the token from the snippet.
   Then, on the site's entry in Web Analytics → **Manage site**, confirm **automatic
   setup** (injection into proxied pages) is **off** and the **JS snippet** option is
   the one selected.
2. In `src/layouts/Periodical.astro`, at the end of `<body>`, find the block marked
   `CLOUDFLARE WEB ANALYTICS BEACON — PLACEHOLDER`. Move the `<script …>` line out of the
   `{/* … */}` comment, put the token in place of `REPLACE_WITH_BEACON_TOKEN`, and delete
   the rest of the comment. The result:

   ```astro
   <script is:inline defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "<token>"}'></script>
   ```

3. `npm test` (page-weight and no-JS gates still pass with the beacon), commit
   (`chore: web analytics beacon`), `npm run deploy`. Within a few minutes, visits show
   in the Web Analytics dashboard.

### Step 6: archive and tag

After the deploy is live:

```sh
npm run archive -- --dry-run     # prints the URLs it would submit
npm run archive                  # submits to the Wayback Machine, 20 s apart
git tag deployed-$(date -u +%F)  # e.g. deployed-2026-10-12
git push origin --tags
```

PowerShell tag: `git tag ("deployed-" + (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd"))`.

The first run (no `deployed-*` tag yet) submits every public page and every cited
external URL; later runs submit only pages changed since the last tag. Results are
appended to `.archive-log.jsonl` (gitignored; keep it, it stops re-submissions). If two
deploys happen on one UTC day, tag the second `deployed-YYYY-MM-DD-2`.

`npm run archive -- --external-only` submits the cited external URLs and none of the site's
pages. Use it to save sources before a deploy, when the live pages may still be the old ones.

If Save Page Now answers 429 (rate limited), or three 5xx in a row, the run stops and
exits 1 with `archive: stopped: …`. Wait an hour and run it again before tagging. Cited
sources already saved are skipped; for the site's own pages, pass the deploy time,
`npm run archive -- --since 2026-10-14T13:58Z`, so pages saved since the deploy are skipped
too. Without it every run starts again from the first page.

**Keep one log.** `.archive-log.jsonl` is how a run knows what is already saved, and it is
gitignored, so each checkout and worktree has its own. Run the archive from the checkout you
deploy from; if you must run it elsewhere, copy the log in first and back afterwards. (By
2026-10-15 the log had split across three checkouts, and a run in a fresh worktree tried to
resubmit all 52 sources that were already saved. The copies were merged on 2026-10-15; the
pre-merge copy of the main checkout's log is `.archive-log.jsonl.bak-2026-10-15`.)

Anonymous Save Page Now throttles hard. Between 2026-10-12 and 2026-10-15 the log shows 63 saves
across many short runs and 41 refusals, and from the evening of 2026-10-14 through
2026-10-15 it refused the first request every time, even the save page in a browser on the
same network. The signed-in API is not held to that limit. Get the S3-style keys at
<https://archive.org/account/s3.php> while signed in, then set them for the run only:

```sh
IA_S3_ACCESS_KEY=… IA_S3_SECRET_KEY=… npm run archive
```

(PowerShell: `$env:IA_S3_ACCESS_KEY="…"; $env:IA_S3_SECRET_KEY="…"; npm run archive`, in a
shell you then close.) The run prints `; signed in`. Keys are never written to the log or
the repository. A signed-in 200 means the capture job was accepted; the API skips a URL
already captured in the last thirty days.

**Before the public launch** (the site is served but not announced), run only
`npm run archive -- --external-only`, and do not tag. The first `deployed-*` tag goes on at
launch, after a full `npm run archive`, so the Wayback copy of every page is the page as
launched. Tagging earlier would make that first full run skip unchanged pages.

## Later deploys

Before-every-deploy checklist, then `npm run deploy`, then step 6 (archive and tag).

## Notes

- **Windows and Lighthouse.** `npm run lhci` (`scripts/lhci.mjs`) spawns `npx`, which is
  `npx.cmd` on Windows; the script uses a shell there (`shell: process.platform === "win32"`)
  and quotes the Chrome path. Run it from PowerShell or cmd after `npx playwright install chromium`.
- **Rolling back.** Dashboard → Workers & Pages → aswemayact → **Deployments** → pick
  the previous version → **Rollback**; or check out the previous `deployed-*` tag and
  `npm run deploy`.
- **404s.** Unknown paths are served `dist/404.html` with status 404
  (`not_found_handling: "404-page"`). The page is `noindex`, out of the sitemap and out of
  the Wayback submissions.

## Deploy record

| Date (UTC) | Tag | Pagefind range request (206/200) | Font cache-control | Notes |
| ---------- | --- | -------------------------------- | ------------------ | ----- |
| 2026-10-11 | none (pre-launch) | 200 | `public, max-age=31536000, immutable` | HTML served without `etag` or `; charset=utf-8` (same on workers.dev; pages declare `<meta charset="utf-8">`). Always Use HTTPS turned on. DMARC not yet added. HSTS deliberately left off. First `npm run archive` stopped on a 429 at the first URL; re-run before tagging. |
| 2026-10-11 | none (pre-launch) | — | — | 22:50 UTC: most likely the Web Analytics beacon (`1e36a64`); the dashboard records no commit. |
| 2026-10-14 | none (pre-launch) | 200 | `public, max-age=31536000, immutable` | 13:59 UTC: `main` at `8d08196` (PR #3: legal audit, Public meetings page, law-quote check), version `08efeb0e`. Cited sources archived beforehand with `--external-only` (52 URLs, 2026-10-12 to -13, many 429 stops); 8 of the 19 public pages archived after the deploy before Save Page Now shut the door. Wrangler re-authorized by OAuth during the deploy. |
| 2026-10-15 | none (pre-launch) | 200 | `public, max-age=31536000, immutable` | 22:35 UTC: `main` at `8643e89` (PR #4: the trail *The bill*, the Atom feed, signed-in archiving; PR #5: `--since`, archive record), version `a661acf6`. 35 new or changed assets uploaded. Checked live: `/trails/the-bill/` 200; `/feed.xml` 200 as `application/atom+xml; charset=utf-8` with 6 entries; 404, 307 and `www` 301 as expected; `nosniff` and `referrer-policy` present. The 10 sources new in *The bill* still not archived (Save Page Now 429). |

Not deploys, recorded here so the zone's state is in one place:

- 2026-10-15: DMARC added through Cloudflare DMARC Management,
  `v=DMARC1; p=none; rua=mailto:…@dmarc-reports.cloudflare.net`. Monitor only. Read the
  reports after a few weeks; if nothing but Cloudflare's own forwarding shows up, move to
  `p=quarantine`.
- 2026-10-15: the 10 sources newly cited in *The bill* are not yet archived (Save Page Now
  still answering 429 at 22:36 UTC); run `npm run archive -- --external-only` signed in, or
  after the block lifts.
