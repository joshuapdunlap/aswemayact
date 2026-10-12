// Pure sentence generation for the request-letter builder. No DOM, no I/O.
// Every sentence that states or invokes the law carries the subsection it rests on
// in `basis`; header, salutation and closing lines carry none.
// All date math is UTC.

import {
  CATCH_ALL_NOUNS,
  DAY_FOUR,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_WORDS,
  PROXY_OPINIONS,
  type DeadlineCard,
  type DocumentType,
  type LetterInput,
  type Sentence,
} from "./model";

const ACT = "the Arkansas Freedom of Information Act, Ark. Code Ann. § 25-19-101 et seq.";
const SALUTATION = "To the custodian of records,";
const DAY_MS = 86_400_000;

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// ---------- small helpers ----------

function clean(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** UTC midnight for a valid ISO yyyy-mm-dd string, else null. */
function parseIso(s: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(s));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(Date.UTC(y, mo, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo && date.getUTCDate() === d ? date : null;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Letter date: "9 October 2026". */
function longDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "a", "a and b", "a, b and c". */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Ends `s` with a full stop unless it already ends with terminal punctuation. */
function period(s: string): string {
  return /[.?!]$/.test(s) ? s : `${s}.`;
}

function pluralFor(t: DocumentType, i: LetterInput): string {
  if (t === "other") return clean(i.otherType) || "other records";
  return DOCUMENT_TYPES.find((d) => d.id === t)?.plural ?? "records";
}

/** Distinct, known document types in the order chosen. */
function chosenTypes(i: LetterInput): DocumentType[] {
  const known = new Set(DOCUMENT_TYPES.map((d) => d.id));
  return [...new Set(i.documentTypes ?? [])].filter((t) => known.has(t));
}

function dateClause(i: LetterInput): string {
  const from = parseIso(i.dateFrom);
  const to = parseIso(i.dateTo);
  if (from && to) return ` dated from ${longDate(from)} through ${longDate(to)}`;
  if (from) return ` dated on or after ${longDate(from)}`;
  if (to) return ` dated on or before ${longDate(to)}`;
  return "";
}

function partiesClause(i: LetterInput): string {
  const parties = (i.parties ?? []).map(clean).filter((p) => p.length > 0);
  return parties.length ? ` involving ${joinList(parties)}` : "";
}

/** One numbered item per document type, each carrying the subject, parties and dates. */
function items(i: LetterInput): string[] {
  const subject = clean(i.subject);
  const about = subject ? ` concerning ${subject}` : "";
  const parties = partiesClause(i);
  const dates = dateClause(i);
  const rest = parties && dates ? `${parties},${dates}` : `${parties}${dates}`;
  const types = chosenTypes(i);
  if (types.length === 0) {
    const tail = `${about}${rest}` || " concerning the subject of this request";
    return [period(`1. All records${tail}`)];
  }
  return types.map((t, n) => period(`${n + 1}. All ${pluralFor(t, i)}${about}${rest}`));
}

/** Short description of the request for a follow-up letter. */
function requestSummary(i: LetterInput): string {
  const subject = clean(i.subject);
  const types = chosenTypes(i);
  const kinds = types.length ? joinList(types.map((t) => pluralFor(t, i))) : "records";
  if (subject) return `${kinds} concerning ${subject}`;
  return types.length ? kinds : "public records";
}

/** Date line (when `date` is valid), addressee lines and salutation. */
function header(i: LetterInput, date: Date | null): Sentence[] {
  const out: Sentence[] = [];
  if (date) out.push({ text: longDate(date), kind: "meta" });
  const contact = clean(i.contact);
  const agency = clean(i.agency);
  if (contact) out.push({ text: contact, kind: "meta" });
  if (agency) out.push({ text: agency, kind: "meta" });
  out.push({ text: SALUTATION, kind: "meta" });
  return out;
}

function closing(i: LetterInput): Sentence[] {
  const email = clean(i.requesterEmail);
  const out: Sentence[] = [];
  if (email) out.push({ text: `Please send the records and your response to ${email}.`, kind: "paragraph" });
  out.push({ text: "Thank you for your help.", kind: "paragraph" });
  out.push({ text: "Sincerely,", kind: "meta" });
  out.push({ text: clean(i.requesterName) || "The requester", kind: "meta" });
  if (email) out.push({ text: email, kind: "meta" });
  return out;
}

function standing(i: LetterInput): Sentence {
  const base = `I am a citizen of the State of Arkansas and make this request under ${ACT}`;
  if (i.standing === "proxy") {
    const name = clean(i.proxyFor);
    const who = name ? `${name},` : "a person";
    return {
      text: `${base}, on behalf of ${who} who is not an Arkansas citizen, as Attorney General opinions have acknowledged.`,
      basis: "§ 25-19-105(a)(2)(A)",
      opinions: PROXY_OPINIONS,
    };
  }
  return { text: base, basis: "§ 25-19-105(a)(2)(A)" };
}

function followUpOpening(i: LetterInput): Sentence {
  const date = parseIso(i.requestDate);
  const when = date ? `On ${longDate(date)}, I made` : "I recently made";
  return {
    text: `${when} a written request under ${ACT}, for ${requestSummary(i)}.`,
    basis: "§ 25-19-105(a)(2)(A)",
  };
}

/** Running text unless the sentence already says what it is. */
function asParagraph(s: Sentence): Sentence {
  return s.kind ? s : { ...s, kind: "paragraph" };
}

// ---------- public API ----------

/** The request letter, one entry per line or sentence, in order. */
export function generateLetter(i: LetterInput): Sentence[] {
  const out: Sentence[] = [...header(i, parseIso(i.requestDate)), standing(i)];

  out.push({ text: "I request copies of the following public records:", basis: "§ 25-19-105(a)(2)(A)" });
  for (const item of items(i)) out.push({ text: item, basis: "§ 25-19-105(a)(2)(C)", kind: "item" });

  if (i.electronicFormat) {
    out.push({
      text: "I ask for the records in the readily available electronic format in which they are kept, or in a format to which they are readily convertible with your existing software.",
      basis: "§ 25-19-105(d)(2)(B)",
    });
  }
  if (i.originalMedia) {
    out.push({
      text: "For any audio or video recording, I ask for the original media file as the recording device created it, with its metadata, and for any record that identifies the make, model and identification number of each device used.",
      basis: "§ 25-19-103(15)(A)",
    });
  }

  out.push(
    {
      text: "Please provide immediately any responsive records that are not in active use or storage.",
      basis: "§ 25-19-105(a)(6)",
    },
    {
      text: "If any record is in active use or storage, please certify that fact to me in writing, stating the date and hour the records will be available, which must be within three working days.",
      basis: "§ 25-19-105(e)",
    },
    {
      text: "Ark. Code Ann. § 25-19-105(a)(3) requires a written response to a written request; for each numbered item, please say whether responsive records exist and, if none do, that no records exist.",
      basis: "§ 25-19-105(a)(3)",
    },
    {
      text: "If any record or part of a record is withheld, please identify the specific exemption relied on for each.",
      basis: "§ 25-19-105(a)(3)",
    },
    {
      text: "If your office does not hold a record I have asked for, please tell me which custodian does, if you know or can readily find out.",
      basis: "§ 25-19-105(a)(3)(C)",
    },
    {
      text: "If a record contains exempt information, please delete only that information and provide the rest of the record.",
      basis: "§ 25-19-105(f)(2)",
    },
    {
      text: "Please indicate on each released record the amount of information deleted.",
      basis: "§ 25-19-105(f)(3)",
    },
    {
      text: "Before any copies are made, please send me an estimate of the fees; I understand that payment in advance may be required only if the estimated fee exceeds $25.",
      basis: "§ 25-19-105(d)(3)(A)(iii)",
    },
    {
      text: "Please provide an itemized breakdown of any charges.",
      basis: "§ 25-19-105(d)(3)(B)",
    },
    {
      text: "Any fee for copies may not exceed the actual costs of reproduction and may not include existing agency personnel time spent searching for, retrieving, reviewing or copying the records.",
      basis: "§ 25-19-105(d)(3)(A)(i)",
    },
    {
      text: "If any item is not specific enough for you to locate the records with reasonable effort, please contact me and I will clarify it.",
      basis: "§ 25-19-105(a)(2)(C)",
    },
  );

  return [...out.map(asParagraph), ...closing(i)];
}

/** A follow-up letter for a request met with silence or with an equivocal answer.
 *  `today` (ISO yyyy-mm-dd) dates the follow-up; without a valid one it carries the request date. */
export function generateFollowUp(i: LetterInput, kind: "silent" | "equivocal", today?: string): Sentence[] {
  const date = parseIso(today) ?? parseIso(i.requestDate);
  const out: Sentence[] = [...header(i, date), followUpOpening(i)];

  if (kind === "silent") {
    out.push(
      {
        text: "Records that are not in active use or storage must be provided immediately.",
        basis: "§ 25-19-105(a)(6)",
      },
      {
        text: "If records are in active use or storage, the custodian must certify that fact in writing and set a date and hour within three working days when they will be available; I have received neither the records nor such a certification.",
        basis: "§ 25-19-105(e)",
      },
      {
        text: "Please send the records now or, for each item, the written response § 25-19-105(a)(3) requires.",
        basis: "§ 25-19-105(a)(3)",
      },
      {
        text: "A citizen denied the rights the act grants may appeal immediately to circuit court, and I would rather resolve this with you.",
        basis: "§ 25-19-107(a)",
      },
    );
  } else {
    out.push(
      {
        text: "Your response does not state plainly whether the records I asked for exist.",
        basis: "§ 25-19-105(a)(3)",
      },
      {
        text: "For each numbered item in my request, I ask for a clear statement that each record exists, is exempt, or does not exist.",
        basis: "§ 25-19-105(a)(3)",
      },
      {
        text: "If records are withheld as exempt, please identify the specific exemption that applies to each.",
        basis: "§ 25-19-105(a)(3)",
      },
      {
        text: "If no responsive records exist for an item, please say plainly that they do not exist.",
        basis: "§ 25-19-105(a)(3)",
      },
      {
        text: "If the records exist and are not exempt, please send them or, if they are in active use or storage, certify that fact in writing with the date and hour they will be available.",
        basis: "§ 25-19-105(e)",
      },
    );
  }

  return [...out.map(asParagraph), ...closing(i)];
}

/** Request date, the third working day after it (Saturday and Sunday skipped; no holidays), and day-four steps. */
export function generateDeadlineCard(i: LetterInput): DeadlineCard {
  const start = parseIso(i.requestDate);
  if (!start) return { requestDate: "", thirdWorkingDay: "", dayFour: [...DAY_FOUR] };
  let t = start.getTime();
  let counted = 0;
  while (counted < 3) {
    t += DAY_MS;
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) counted++;
  }
  return { requestDate: toIso(start), thirdWorkingDay: toIso(new Date(t)), dayFour: [...DAY_FOUR] };
}

function wordPattern(w: string): string {
  const words = w.split(/\s+/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const last = words.pop() as string;
  const tail = last.endsWith("y") ? `${last.slice(0, -1)}(?:y|ies)` : `${last}(?:s|es)?`;
  return [...words, tail].join("\\s+");
}

const CATCH_ALL_RE = new RegExp(`\\b(?:${CATCH_ALL_NOUNS.map((n) => n.split(/\s+/).join("\\s+")).join("|")})\\b`, "i");
const DOC_TYPE_RE = new RegExp(`\\b(?:${DOCUMENT_TYPE_WORDS.map(wordPattern).join("|")})\\b`, "i");

/** True when the subject leans on a catch-all noun without naming any kind of document. */
export function isVagueSubject(s: string): boolean {
  const text = clean(s);
  return CATCH_ALL_RE.test(text) && !DOC_TYPE_RE.test(text);
}
