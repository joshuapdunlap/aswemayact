# Act 505 posting audit: method (Release 3)

Status: draft, 2026-10-15, for the editor. Nothing here is published, and no body has been
checked yet.

## The question

Since August 5, 2025, a public body that has a website or a social media page, or whose
public entity has one, must post online:

- the **time, place and date** of each public meeting (§ 25-19-106(b)(3)(A)), and
- its **most current agenda**, at least **three days** before a regular meeting and at least
  **two hours** before an emergency or special one (§ 25-19-106(b)(3)(B)(i)).

The audit asks, body by body: for one regular meeting, was each of those things online, and
how far ahead? The manual's [The clock](../../src/content/manual/the-clock.md) states the
rule; the audit only applies it.

## Scope

Proposed, for the editor to fix before anyone starts:

| Group | Count | Starting list |
| ----- | ----- | ------------- |
| County quorum courts | all 75 | county directory (see [Starting lists](#starting-lists)) |
| City councils / boards of directors | cities above a population line the editor sets (10,000 gives roughly 40) | municipal directory |
| School boards | the largest districts by enrollment (proposed: top 25) | state school-district directory |

One regular meeting per body, inside one audit window (proposed: the regular meetings held
in a single calendar month). The same month for everyone, so the results compare.

## What a volunteer records

One row per body in [audit-template.csv](audit-template.csv). Every "yes" needs evidence a
stranger can open later.

1. **Online presence.** Does the body or its entity have a website? A social media page?
   Record each URL. If it has neither, the online duty does not apply: record that and stop.
2. **The meeting.** Date and start time of the regular meeting audited, and where that came
   from (the body's site, a newspaper notice, a call to the clerk).
3. **Time, place and date online.** Yes/no, the URL, and when it was first seen there.
4. **Agenda online.** Yes/no, the URL, and the **earliest moment you can prove it was up**:
   - best: you saw it yourself and saved it to the Wayback Machine at that moment
     (web.archive.org/save), recording the capture URL;
   - otherwise: an existing Wayback capture's timestamp, or a posted/modified date the site
     itself shows (record which).
5. **Hours ahead.** The meeting start minus the earliest proven posting time, in hours.
   Record the number; do not convert it to pass/fail in the field. Whether "three days"
   means 72 hours, three calendar days or three business days is the editor's call, made
   once for every row. The Act does not define it for agendas.
6. **Agenda changed later?** If a later version of the agenda appeared, note it. Adding
   items after posting is allowed (§ 25-19-106(b)(3)(B)(ii)); this is context, not a fault.
7. **Notes.** Anything a reader would need to understand the row.

### Getting the timing right

The cleanest proof is a check **before** the meeting. For each body, find its regular
meeting schedule first, then look on the day that is three full days ahead, save what you
find to the Wayback Machine, and look again closer to the meeting. A posting seen and
archived 80 hours ahead needs no argument.

A check after the meeting can prove an agenda was up early only through an archive capture
or a date the site shows. If neither exists, record "not proven", not "late".

## Before anything is published

- **The editor reviews every row's evidence.** A row without an openable link for each "yes"
  or timing figure goes back to the volunteer.
- **Right of reply.** Each body whose row shows a missing or late posting is told what the
  audit found, in writing to its clerk, with the evidence and a reply window (proposed: ten
  working days). Replies that bear on the record are published with the results, and a
  confirmed error is fixed before publication, not after.
- **Bodies, not people.** The results report what each body posted and when. They name no
  clerk or official and draw no conclusion about intent, in keeping with the site's rule
  that it publishes no findings of its own about named officials.
- **Corrections** after publication follow the corrections policy.

## Volunteers

A volunteer needs a browser, the template and about 30 minutes per body spread across two or
three visits. Assign by county, so one person learns one area's sites. Two volunteers check
the same body for a sample of rows (proposed: one in ten) to test consistency.

## Starting lists

Checked 2026-10-15. None of them records which bodies have **only** a social media page,
which the Act also covers, so every "no website" row still needs a search for a Facebook
or other page before it can say the duty does not apply.

| Group | List | What it gives |
| ----- | ---- | ------------- |
| Cities (500) | Arkansas Municipal League, *2026 Directory of Arkansas Municipal Officials* (zipped PDF): <https://www.armunileague.org/wp-content/uploads/2026/08/AML_Directory_2026_08_03_WEB.pdf.zip> | Per city: council meeting day, officials, phone, email (about 400), website (about 199), class, population. The searchable version: <https://www.armunileague.org/member-directory/> |
| School districts (238) | Division of Elementary and Secondary Education, district directory export: <https://adedata.arkansas.gov/LEA/Home/ExceliseDistricts?sortDescending=False&sortField=DirectoryName> | District, superintendent and email, phone, website (all rows). No board meeting dates. |
| Counties (75) | Association of Arkansas Counties county pages: <https://www.arcounties.org/counties/> | Officials, justices of the peace by name, a county website link for about 45 of 75. Some links are wrong (one county's points to another's site); check each. |
| Counties (75) | Secretary of State, county clerks: <https://www.sos.arkansas.gov/uploads/elections/ARCountyClerks.pdf> | Every county clerk's address, phone and email. The clerk keeps the quorum court's records. |
| Gaps | CISA's .gov domain list: <https://github.com/cisagov/dotgov-data> (`current-full.csv`) | About 410 Arkansas .gov domains with organization names. Misses bodies not on .gov. |

**School boards have a second rule.** The AG's handbook notes that notice of a regular
school board meeting goes on the district's website ten days ahead, under Ark. Code Ann.
§ 6-13-619(a)(4). Record what was posted and when for school boards as for everyone else;
the editor decides how the results report the two rules. (Not yet checked against the
statute itself; check before relying on it.)

The Act's date: Act 505 of 2025 (SB 227) was approved April 10, 2025, with no emergency
clause, and took effect August 5, 2025 (Op. Att'y Gen. 2025-032, which explains why not
August 4). Choose an audit window well after that date.
