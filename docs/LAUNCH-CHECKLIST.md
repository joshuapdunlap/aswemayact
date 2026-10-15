# aswemayact.org: public launch checklist

Status on 2026-10-15: the site is **served but not announced**. It has been on
aswemayact.org since the first deploy on 2026-10-11 (deploys are in the record at the foot
of [DEPLOY.md](DEPLOY.md)). Until launch day, changes are ordinary repository changes: the
corrections log starts at launch, and nothing before it goes in the log.

## Done

- [x] `editor@aswemayact.org` routed through Cloudflare Email Routing (MX, SPF, DKIM).
- [x] `.content-rules/excluded.txt` in place; the build scans every tracked text file.
- [x] Deployed to Workers static assets; custom domain; `www` → apex 301.
- [x] Header checks (DEPLOY.md step 4) recorded on 2026-10-11.
- [x] Web Analytics beacon (cookieless), deployed 2026-10-11.
- [x] GitHub repository, README, MIT licence.
- [x] Legal pass against primary sources (2026-10-12), and the build check of every handbook
      quotation.
- [x] DMARC record, `p=none` with reports to Cloudflare DMARC Management (2026-10-15).
- [x] Atom feed at `/feed.xml`, linked from every page's head and footer (merged, not yet deployed).
- [x] Fourth trail, *The bill*, merged (PR #4, 2026-10-15).

## Before launch

1. **Legal read.** Drafts asking for a one-time accuracy read are in Gmail (not sent): the
   UA Little Rock law school's FOIA scholar, the Arkansas Press Association (to reach its
   counsel), and the SPJ Arkansas chapter's FOI Committee. Send, wait, fix what they find.
   Credit the reviewers on About only with their agreement.
2. **Deploy `main`.** The fourth trail, *The bill*, and the Atom feed are merged (PR #4,
   2026-10-15) but not live yet. Deploy whenever you want to see them in place; it does not
   announce anything.
3. **Source archive.** The 52 sources cited at the first deploy are saved. The 10 new ones in
   *The bill* are not: `npm run archive -- --external-only`, signed in or once Save Page
   Now stops answering 429 (DEPLOY.md, step 6).
4. **Pick the date.** A weekday morning, not in the week of a holiday, so the first days of
   corrections mail get answered inside 48 hours.

## Launch day (in order)

1. Set the launch entry, `src/content/corrections/2026-10-11-launch.md`: rename the file to
   the launch date, set `date:` to it, and make `now:` list exactly what ships.
2. Re-read and re-date the manual pages you have reviewed (`reviewed:` in each file); leave
   a date alone if you did not re-read the page.
3. Set the essay's and each trail's `dateline` only if you want them dated to the launch;
   otherwise leave them as written.
4. Before-every-deploy checklist (DEPLOY.md), `npm run deploy`, the curl checks.
5. `npm run archive` (signed in) for every page and source, then the first tag:
   `git tag deployed-YYYY-MM-DD` and `git push origin --tags`. Add the row to the deploy
   record.
6. Announce. Lead with the printables and the letter builder: something to use, not only a
   link. Partner list: [OUTREACH.md](OUTREACH.md).

## After launch

- **Project Galileo**: apply after launch, not before. The application wants a live public
  site, and a sponsor is the strongest route. Application text below. The form ends in a
  bot check, so the editor submits it.
- **DMARC**: after a few weeks of reports, move to `p=quarantine` if only Cloudflare's own
  forwarding appears.
- **2027 session watch**: see [SESSION-2027.md](SESSION-2027.md).
- **Release 2** (translations): [translation/BRIEF.md](translation/BRIEF.md).
- **Release 3** (Act 505 audit): [act-505-audit/METHOD.md](act-505-audit/METHOD.md).
- Cadence: one trail a month; manual re-read quarterly; corrections within 48 hours.

### Project Galileo application text

Form: <https://www.cloudflare.com/galileo/#galileoapplication>. Fields: first and last
name, organization, website, contact email, country, phone (optional), "Are you currently
under attack?", circumstances of attacks, and why the organization fits. No EIN or
registration documents are asked for. A partner sponsorship (Freedom of the Press
Foundation, EFF, CDT, Access Now, or a press group such as LION Publishers) carries more
weight than a direct application; ask one first if any of them knows the project.

> **Organization:** As We May Act (aswemayact.org)
>
> **Why we fit:** As We May Act is a free, plain-language guide to the Arkansas Freedom of
> Information Act for ordinary Arkansans. It explains what public records and meetings the
> law opens, what copies cost, how fast an agency must answer and what to do after a
> denial, citing the statute behind every rule. It includes a request-letter builder that
> runs entirely in the reader's browser and stores nothing, printable sheets for use at a
> counter or a public meeting, and short signed "trails" from a public record to an action a
> reader can take. It carries no advertising and no tracking beyond cookieless analytics;
> its content is CC BY and its code is MIT-licensed. It is a one-person, unincorporated,
> non-commercial project, edited by Joshua Dunlap. Arkansas has no FOIA ombudsman or
> enforcement office, so a public guide is much of what a first-time requester has. Its
> trails cite reporting on how public bodies handle records, which can draw hostile
> attention, and a one-person project has no security staff to absorb it.
>
> **Attacks:** None so far. (Update honestly at the time of applying.)
