# The 2027 session: watching for FOIA bills

The manual describes the act as it stands. The 96th General Assembly can change it, and in
2023 a bill to narrow it was heard two days after it was filed (see the trail
[The bill](../src/content/trails/the-bill.md)). This is the routine for the session.

## Dates

From the Bureau of Legislative Research's *2027 Regular Session Important Dates*
(<https://arkleg.state.ar.us/Home/FTPDocument?path=%2Fassembly%2F2027%2FDocuments%2FSession_Important_Dates_2027.pdf>):

- **Prefiling opens Monday, November 16, 2026** (§ 10-2-112(a) sets November 15, a Sunday this year).
- **The session convenes Monday, January 11, 2027, at noon** (§ 10-2-101(a); Ark. Const. art. 5, § 5).
- Constitutional amendment resolutions are due February 10, 2027; appropriation bills March 1.

The Arkansas Freedom of Information Task Force (§ 25-19-111, Act 923 of 2017) is to report
its recommendations on proposed changes by November 1 of each even-numbered year. Whether it
met or reported in 2026 is not known; worth asking one of its appointing bodies (the Press
Association, SPJ Arkansas) in November.

## Every week, from November 16

1. Run both searches (they return nothing until bills are filed):
   - exact phrase "Freedom of Information Act of 1967":
     <https://arkleg.state.ar.us/Bills/Search?ddBienniumSession=2027%2F2027R&hdnSessions=z2027R%2C&ddChamber=A&tbExactPhrase=Freedom+of+Information+Act+of+1967&ddExclusivity=Only>
   - exact phrase "25-19-" (catches bills that amend a section without the act's name in
     the title, and bills that add a new section):
     <https://arkleg.state.ar.us/Bills/Search?ddBienniumSession=2027%2F2027R&hdnSessions=z2027R%2C&ddChamber=A&tbExactPhrase=25-19-&ddExclusivity=Only>
2. Discard bills that only mention the act in passing; read the title, then the text.
3. Add each real one to Personalized Bill Tracking (<https://arkleg.state.ar.us/Bills/TrackingLogin>)
   for the daily change email.
4. Note it in the list below: number, what it would do in one line, committee, status.

A scheduled task (`aswemayact-foia-bill-watch`, in the Claude app's scheduled tasks) runs
these searches every Monday morning and reports any bill it has not seen before. It only
reads arkleg; it changes nothing and sends nothing.

## When a bill moves

- **On a committee agenda:** House committee agendas go up at least eighteen hours ahead
  (House Rule 60(a), 2025 rules); a Senate committee cannot hear a bill until a day after
  referral (Senate Rule 7.11). That is the window to tell readers. Whether the site posts
  anything about a pending bill is the editor's call; if it does, it says what the bill would
  change and links the bill, and takes no position the manual cannot source.
- **Passed and signed:** an act without an emergency clause or a date of its own takes
  effect about three months after sine die. The Attorney General publishes the exact date
  each session (for 2025, Op. 2025-032: August 5, 2025, not the August 4 a simple count
  gives, because the referendum deadline fell on a Sunday). Update the
  manual for the effective date, not the signing date. Before then, a page can carry a
  callout: "Act N of 2027 changes this on DATE."
- **After sine die:** check arkleg's *Code Sections Amended* list, Title 25
  (<https://arkleg.state.ar.us/Acts/CodeSectionsAmended?ddBienniumSession=2027%2F2027R>),
  against every manual page's `statutes:` list, and watch for the next edition of the
  Attorney General's handbook. The handbook check (`npm run handbook`) needs the new edition
  before law quotations can be re-verified.

## Bills seen

| Bill | What it would do | Committee | Status | Checked |
| ---- | ---------------- | --------- | ------ | ------- |
| | | | | |
