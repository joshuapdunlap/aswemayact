// tests/unit/letter.test.ts
import {
  DEFAULTS,
  LETTER_VERSION,
  CATCH_ALL_NOUNS,
  DOCUMENT_TYPE_WORDS,
  type LetterInput,
} from "../../src/lib/letter/model";
import {
  generateLetter,
  generateFollowUp,
  generateDeadlineCard,
  isVagueSubject,
} from "../../src/lib/letter/generate";
import { isValidStatute } from "../../src/lib/content-rules";

// --- brief tests (verbatim) ---

test("empty input still yields a well-formed letter with no undefined", () => {
  const out = generateLetter(DEFAULTS).map(s => s.text).join("\n");
  expect(out).toContain("To the custodian of records");
  expect(out).toContain("citizen of the State of Arkansas");
  expect(out).toContain("§ 25-19-105(a)(3)");
  expect(out).not.toMatch(/undefined|\[\s*\]|\{\{/);
});
test("document types are named and the fee and format sentences cite their subsections", () => {
  const s = generateLetter({ ...DEFAULTS, documentTypes: ["contract","nda"], subject: "license-plate reader cameras", electronicFormat: true });
  const text = s.map(x => x.text).join(" ");
  expect(text).toContain("contracts");
  expect(text).toContain("non-disclosure agreements");
  expect(s.find(x => x.basis === "§ 25-19-105(d)(3)(A)(iii)")).toBeTruthy();
  expect(s.find(x => x.basis === "§ 25-19-105(d)(2)(B)")).toBeTruthy();
});
test("proxy standing sentence names the person", () => {
  const text = generateLetter({ ...DEFAULTS, standing: "proxy", proxyFor: "A. Reader" }).map(x => x.text).join(" ");
  expect(text).toContain("on behalf of A. Reader");
});
test("vague subject detection", () => {
  expect(isVagueSubject("communications about the drone facility")).toBe(true);
  expect(isVagueSubject("the non-disclosure agreement with Swarm Aero")).toBe(false);
});
test("deadline card counts three working days skipping weekends", () => {
  const c = generateDeadlineCard({ ...DEFAULTS, requestDate: "2026-10-09" }); // Friday
  expect(c.thirdWorkingDay).toBe("2026-10-14"); // Wed
  expect(c.dayFour.length).toBeGreaterThan(0);
});
test("equivocal follow-up quotes the statute's three required statements", () => {
  const text = generateFollowUp(DEFAULTS, "equivocal").map(x => x.text).join(" ");
  expect(text).toMatch(/exist.*exempt.*do not exist|do not exist.*exempt/i);
});

// --- additional tests ---

const FULL: LetterInput = {
  ...DEFAULTS,
  agency: "City of Example",
  contact: "Records Clerk",
  documentTypes: ["contract", "nda", "other"],
  otherType: "data-sharing logs",
  subject: "license-plate reader cameras",
  parties: ["Example Vendor, Inc.", " ", "the Police Department"],
  dateFrom: "2026-01-01",
  dateTo: "2026-06-30",
  electronicFormat: true,
  originalMedia: true,
  requesterName: "Pat Requester",
  requesterEmail: "pat@example.org",
  requestDate: "2026-10-09",
};

const texts = (s: { text: string }[]) => s.map(x => x.text);
const pristine = /undefined|null|NaN|\[\s*\]|\{\{|\s{2,}|\s[.,;:]|\.\./;

test("every basis emitted is a valid statute string or a case name", () => {
  const inputs: LetterInput[] = [DEFAULTS, FULL, { ...FULL, standing: "proxy", proxyFor: "A. Reader" }];
  for (const i of inputs) {
    const all = [...generateLetter(i), ...generateFollowUp(i, "silent"), ...generateFollowUp(i, "equivocal")];
    for (const s of all) {
      if (s.basis === undefined) continue;
      expect(isValidStatute(s.basis) || /\bv\.\s/.test(s.basis), s.basis).toBe(true);
    }
  }
});

test("DEFAULTS and full input produce pristine text in every output", () => {
  for (const i of [DEFAULTS, FULL]) {
    const all = [...generateLetter(i), ...generateFollowUp(i, "silent"), ...generateFollowUp(i, "equivocal")];
    for (const t of texts(all)) {
      expect(t.trim().length, JSON.stringify(t)).toBeGreaterThan(0);
      expect(t, t).not.toMatch(pristine);
    }
  }
});

test("letter header: date, contact, agency name on the line above the salutation", () => {
  const t = texts(generateLetter(FULL));
  const sal = t.indexOf("To the custodian of records,");
  expect(sal).toBeGreaterThan(0);
  expect(t[sal - 1]).toBe("City of Example");
  expect(t).toContain("Records Clerk");
  expect(t).toContain("9 October 2026");
});

test("letter without agency or date omits those lines and starts at the salutation", () => {
  const t = texts(generateLetter(DEFAULTS));
  expect(t[0]).toBe("To the custodian of records,");
});

test("standing sentence uses the brief's fixed copy", () => {
  const s = generateLetter(DEFAULTS);
  const standing = s.find(x => x.text.startsWith("I am a citizen"));
  expect(standing?.text).toBe(
    "I am a citizen of the State of Arkansas and make this request under the Arkansas Freedom of Information Act, Ark. Code Ann. § 25-19-101 et seq.",
  );
  expect(standing?.basis).toBe("§ 25-19-105(a)(2)(A)");
  const proxy = generateLetter({ ...DEFAULTS, standing: "proxy", proxyFor: "A. Reader" }).find(x => x.text.startsWith("I am a citizen"));
  expect(proxy?.text).toBe(
    "I am a citizen of the State of Arkansas and make this request under the Arkansas Freedom of Information Act, Ark. Code Ann. § 25-19-101 et seq., on behalf of A. Reader, who is not an Arkansas citizen, as permitted by the Attorney General's opinions.",
  );
});

test("proxy standing without a name still reads well", () => {
  const text = texts(generateLetter({ ...DEFAULTS, standing: "proxy" })).join(" ");
  expect(text).toContain("on behalf of a person who is not an Arkansas citizen");
});

test("each document type becomes a numbered item carrying subject, parties and dates", () => {
  const t = texts(generateLetter(FULL));
  expect(t).toContain(
    "1. All contracts concerning license-plate reader cameras involving Example Vendor, Inc. and the Police Department, dated from 1 January 2026 through 30 June 2026.",
  );
  expect(t.some(x => x.startsWith("2. All non-disclosure agreements concerning"))).toBe(true);
  expect(t.some(x => x.startsWith("3. All data-sharing logs concerning"))).toBe(true);
});

test("open-ended date ranges", () => {
  const from = texts(generateLetter({ ...FULL, dateTo: undefined })).join(" ");
  expect(from).toContain("dated on or after 1 January 2026");
  const to = texts(generateLetter({ ...FULL, dateFrom: "" })).join(" ");
  expect(to).toContain("dated on or before 30 June 2026");
});

test("other type without a description falls back to 'other records'", () => {
  const t = texts(generateLetter({ ...DEFAULTS, documentTypes: ["other"], subject: "x" })).join(" ");
  expect(t).toContain("1. All other records concerning x.");
});

test("format and original-media sentences appear only when chosen", () => {
  const off = generateLetter({ ...FULL, electronicFormat: false, originalMedia: false });
  expect(off.find(x => x.basis === "§ 25-19-105(d)(2)(B)")).toBeUndefined();
  expect(off.find(x => /original/.test(x.text))).toBeUndefined();
  const on = generateLetter(FULL);
  expect(on.find(x => x.basis === "§ 25-19-105(d)(2)(B)")?.text).toContain("readily available electronic format");
  expect(on.find(x => /original media file/.test(x.text))?.basis).toBe("§ 25-19-103(15)(A)");
});

test("fee, personnel-time, existence, exemption and active-use sentences carry their pinned bases", () => {
  const s = generateLetter(DEFAULTS);
  const fee = s.find(x => x.basis === "§ 25-19-105(d)(3)(A)(iii)");
  expect(fee?.text).toMatch(/estimate of the fees/);
  expect(fee?.text).toMatch(/\$25/);
  expect(fee?.text).not.toMatch(/itemiz/); // (A)(iii) is the advance-payment rule, not itemization
  const itemized = s.find(x => x.basis === "§ 25-19-105(d)(3)(B)");
  expect(itemized?.text).toMatch(/itemized breakdown/);
  expect(s.indexOf(itemized!)).toBe(s.indexOf(fee!) + 1);
  expect(s.find(x => x.basis === "§ 25-19-105(d)(3)(A)(i)")?.text).toMatch(/personnel time/);
  const a3 = s.filter(x => x.basis === "§ 25-19-105(a)(3)");
  expect(a3.some(x => /exist/.test(x.text))).toBe(true);
  expect(a3.some(x => /specific exemption/.test(x.text))).toBe(true);
  const active = s.find(x => x.basis === "§ 25-19-105(e)");
  expect(active?.text).toContain("stating the date and hour the records will be available");
});

test("closing carries the requester's name and email, with a neutral fallback", () => {
  const t = texts(generateLetter(FULL));
  expect(t.slice(-3)).toEqual(["Sincerely,", "Pat Requester", "pat@example.org"]);
  const d = texts(generateLetter(DEFAULTS));
  expect(d.slice(-2)).toEqual(["Sincerely,", "The requester"]);
});

test("letter never speaks about the site itself", () => {
  const text = texts([...generateLetter(FULL), ...generateFollowUp(FULL, "silent")]).join(" ");
  expect(text).not.toMatch(/aswemayact|this site|website|builder|generated/i);
});

test("silent follow-up cites the three-day certification and the § 25-19-107 remedy", () => {
  const s = generateFollowUp(FULL, "silent");
  expect(s.find(x => x.basis === "§ 25-19-105(e)")).toBeTruthy();
  expect(s.find(x => x.basis?.startsWith("§ 25-19-107"))).toBeTruthy();
  const text = texts(s).join(" ");
  expect(text).toContain("On 9 October 2026");
  expect(text).toContain("contracts, non-disclosure agreements and data-sharing logs concerning license-plate reader cameras");
});

test("equivocal follow-up uses the brief's clear-statement copy", () => {
  const s = generateFollowUp(FULL, "equivocal");
  const clear = s.find(x => x.text.includes("a clear statement that each record exists, is exempt, or does not exist."));
  expect(clear?.basis).toBe("§ 25-19-105(a)(3)");
});

test("follow-up without a request date still reads well", () => {
  const text = texts(generateFollowUp(DEFAULTS, "silent")).join(" ");
  expect(text).toMatch(/^To the custodian of records,/);
  expect(text).toContain("I recently made a written request");
});

test("deadline card: fixed day-four list, ISO dates, weekday and weekend starts", () => {
  const c = generateDeadlineCard({ ...DEFAULTS, requestDate: "2026-10-12" }); // Monday
  expect(c).toEqual({
    requestDate: "2026-10-12",
    thirdWorkingDay: "2026-10-15",
    dayFour: [
      "Send the follow-up for a silent response",
      "Re-read 'Denied, now what'",
      "Note the date you may file under § 25-19-107",
    ],
  });
  expect(generateDeadlineCard({ ...DEFAULTS, requestDate: "2026-10-10" }).thirdWorkingDay).toBe("2026-10-14"); // Saturday
  expect(generateDeadlineCard({ ...DEFAULTS, requestDate: "2026-12-30" }).thirdWorkingDay).toBe("2027-01-04"); // year rollover
});

test("deadline card with no or invalid date returns empty dates, not NaN", () => {
  for (const d of ["", "2026-13-40", "soon"]) {
    const c = generateDeadlineCard({ ...DEFAULTS, requestDate: d });
    expect(c.requestDate).toBe("");
    expect(c.thirdWorkingDay).toBe("");
    expect(c.dayFour.length).toBe(3);
  }
});

test("vague subject: catch-all nouns without a document type", () => {
  expect(isVagueSubject("anything related to the stadium")).toBe(true);
  expect(isVagueSubject("all records regarding the bond issue")).toBe(true);
  expect(isVagueSubject("Information about the budget")).toBe(true);
  expect(isVagueSubject("emails and records about the stadium")).toBe(false);
  expect(isVagueSubject("purchase orders for body cameras")).toBe(false);
  expect(isVagueSubject("meeting minutes from March")).toBe(false);
  expect(isVagueSubject("the 2025 budget")).toBe(false);
  expect(isVagueSubject("")).toBe(false);
  // whole words only: "database" is not "data", "recordsroom" not "records"
  expect(isVagueSubject("documents in the database")).toBe(true);
});

test("word lists are exported for the UI", () => {
  expect(CATCH_ALL_NOUNS).toEqual(expect.arrayContaining(["communications", "records", "documents", "information", "anything", "everything", "all records", "any records"]));
  expect(DOCUMENT_TYPE_WORDS).toEqual(expect.arrayContaining(["contract", "agreement", "invoice", "purchase order", "calendar", "email", "text", "recording", "policy", "data", "export", "minutes", "report"]));
  expect(LETTER_VERSION).toBe("2026-10");
});

// --- Task 7 refinements: sentence kinds, follow-up date, existence wording ---

test("every emitted sentence carries a kind", () => {
  for (const i of [DEFAULTS, FULL, { ...FULL, standing: "proxy" as const, proxyFor: "A. Reader" }]) {
    const all = [...generateLetter(i), ...generateFollowUp(i, "silent", "2026-10-15"), ...generateFollowUp(i, "equivocal")];
    for (const s of all) expect(["meta", "heading", "paragraph", "item"], s.text).toContain(s.kind);
  }
});

test("letter kinds: header and closing are meta, numbered items are item, the rest paragraph", () => {
  const s = generateLetter(FULL);
  const kindOf = (t: string) => s.find(x => x.text === t)?.kind;
  for (const t of ["9 October 2026", "Records Clerk", "City of Example", "To the custodian of records,", "Sincerely,", "Pat Requester", "pat@example.org"]) {
    expect(kindOf(t), t).toBe("meta");
  }
  const items = s.filter(x => /^\d+\. /.test(x.text));
  expect(items.length).toBe(3);
  for (const x of items) expect(x.kind).toBe("item");
  expect(s.filter(x => x.kind === "item").length).toBe(3);
  expect(s.find(x => x.text.startsWith("I am a citizen"))?.kind).toBe("paragraph");
  expect(s.find(x => x.text.startsWith("Thank you"))?.kind).toBe("paragraph");
  // meta lines never carry a basis; items and paragraphs about the law do
  for (const x of s.filter(x => x.kind === "meta")) expect(x.basis).toBeUndefined();
  // the placeholder item for an empty letter is an item too
  expect(generateLetter(DEFAULTS).filter(x => x.kind === "item").map(x => x.text)).toEqual([
    "1. All records concerning the subject of this request.",
  ]);
});

test("existence sentence uses the reworded copy and keeps its basis", () => {
  // "Ark. Code Ann. §" rather than "Section": the letter text must carry the § citation
  // (brief test above) and a sentence should not open on a bare "§".
  const s = generateLetter(DEFAULTS).find(x => x.text.startsWith("Ark. Code Ann. § 25-19-105(a)(3)"));
  expect(s?.text).toBe(
    "Ark. Code Ann. § 25-19-105(a)(3) requires a written response to a written request; for each numbered item, please say whether responsive records exist and, if none do, that no records exist.",
  );
  expect(s?.basis).toBe("§ 25-19-105(a)(3)");
  expect(s?.kind).toBe("paragraph");
});

test("follow-up date line: today when given, else the request date, else none", () => {
  const withToday = generateFollowUp(FULL, "silent", "2026-10-15");
  expect(withToday[0]).toEqual({ text: "15 October 2026", kind: "meta" });
  expect(texts(withToday).join(" ")).toContain("On 9 October 2026, I made");
  const fallback = generateFollowUp(FULL, "equivocal");
  expect(fallback[0].text).toBe("9 October 2026");
  const invalidToday = generateFollowUp(FULL, "silent", "not a date");
  expect(invalidToday[0].text).toBe("9 October 2026");
  expect(generateFollowUp(DEFAULTS, "silent")[0].text).toBe("To the custodian of records,");
  expect(generateFollowUp(DEFAULTS, "silent", "2026-10-15")[0].text).toBe("15 October 2026");
});
