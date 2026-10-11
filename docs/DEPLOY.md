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

If Save Page Now answers 429 (rate limited), or three 5xx in a row, the run stops and
exits 1 with `archive: stopped: …`. Wait an hour and run `npm run archive` again before
tagging; URLs already saved are skipped.

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
|            |     |                                  |                    |       |
