// Types, constants and defaults for the request-letter builder. Pure data; no DOM.

/** Printed in the letter footer so a reader can tell which wording produced a letter. */
export const LETTER_VERSION = "2026-10";

export type DocumentType =
  | "contract"
  | "nda"
  | "invoice"
  | "purchase-order"
  | "calendar"
  | "email-text"
  | "recording"
  | "policy"
  | "data-export"
  | "other";

export interface LetterInput {
  agency: string;
  contact: string;
  documentTypes: DocumentType[];
  otherType?: string;
  subject: string;
  parties: string[];
  dateFrom?: string; // ISO yyyy-mm-dd
  dateTo?: string; // ISO yyyy-mm-dd
  electronicFormat: boolean;
  originalMedia: boolean;
  standing: "citizen" | "proxy";
  proxyFor?: string;
  requesterName: string;
  requesterEmail: string;
  requestDate: string; // ISO yyyy-mm-dd
}

/** How a sentence sits in the letter: header, salutation and sign-off lines are "meta";
 *  numbered request items are "item"; running text is "paragraph". */
export type SentenceKind = "meta" | "heading" | "paragraph" | "item";

/** One line or sentence of output. `basis` is a statute string ("§ 25-19-105(e)") or a case name. */
export interface Sentence {
  text: string;
  basis?: string;
  kind?: SentenceKind;
  /** Further authority shown with the basis in the tooltip (the proxy standing sentence). */
  opinions?: string;
}

/** Attorney General's opinions on requests made for a non-citizen. */
export const PROXY_OPINIONS = "Op. Att'y Gen. 2008-191, 97-071, 96-190";

export interface DeadlineCard {
  requestDate: string;
  thirdWorkingDay: string;
  dayFour: string[];
}

/** Checklist entries: `label` for the form, `plural` for the letter. "other" uses `otherType`. */
export const DOCUMENT_TYPES: readonly { id: DocumentType; label: string; plural: string }[] = [
  { id: "contract", label: "Contract", plural: "contracts" },
  { id: "nda", label: "Non-disclosure agreement", plural: "non-disclosure agreements" },
  { id: "invoice", label: "Invoice", plural: "invoices" },
  { id: "purchase-order", label: "Purchase order", plural: "purchase orders" },
  { id: "calendar", label: "Calendar", plural: "calendars" },
  { id: "email-text", label: "Email or text message", plural: "emails and text messages" },
  { id: "recording", label: "Meeting recording", plural: "meeting recordings" },
  { id: "policy", label: "Policy", plural: "policies" },
  { id: "data-export", label: "Data export", plural: "data exports" },
  { id: "other", label: "Other", plural: "other records" },
];

/** Catch-all nouns that, without a document type, make a subject too vague to reach a contract. */
export const CATCH_ALL_NOUNS: readonly string[] = [
  "communications",
  "records",
  "documents",
  "information",
  "anything",
  "everything",
  "all records",
  "any records",
];

/** Words that name a kind of document; any one of them makes a subject specific enough. */
export const DOCUMENT_TYPE_WORDS: readonly string[] = [
  "contract",
  "agreement",
  "invoice",
  "purchase order",
  "calendar",
  "email",
  "text",
  "recording",
  "policy",
  "data",
  "export",
  "minutes",
  "report",
];

/** Items the deadline card lists for the day after the third working day. */
export const DAY_FOUR: readonly string[] = [
  "Send the follow-up for a silent response",
  "Re-read 'Denied, now what'",
  "Note the date you may file under § 25-19-107",
];

export const DEFAULTS: LetterInput = {
  agency: "",
  contact: "",
  documentTypes: [],
  otherType: "",
  subject: "",
  parties: [],
  dateFrom: "",
  dateTo: "",
  electronicFormat: true,
  originalMedia: false,
  standing: "citizen",
  proxyFor: "",
  requesterName: "",
  requesterEmail: "",
  requestDate: "",
};
