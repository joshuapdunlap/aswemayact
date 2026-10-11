// Client logic for the letter builder: read the form on every input, regenerate the letter,
// the follow-ups and the deadline card, and handle copy, download, print and clear.
// Nothing is stored (no localStorage, no cookies) and nothing is sent (no network).
// The default date on the letter is the reader's own calendar date (local time, so an
// Arkansas evening is not dated tomorrow); all date arithmetic after that is on ISO
// strings in UTC.

import { DEFAULTS, DOCUMENT_TYPES, type DocumentType, type LetterInput, type Sentence } from "../../lib/letter/model";
import { generateLetter, generateFollowUp, generateDeadlineCard, isVagueSubject } from "../../lib/letter/generate";
import { letterToText } from "../../lib/letter/layout";
import { letterHtml } from "./render";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Today's date on the reader's own calendar, as YYYY-MM-DD. */
function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "Fri 9 Oct 2026" for an ISO date; "—" when there is none. */
function cardDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "—";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const isDocumentType = (v: string): v is DocumentType => DOCUMENT_TYPES.some((t) => t.id === v);

function readForm(form: HTMLFormElement): LetterInput {
  const data = new FormData(form);
  const str = (name: string) => String(data.get(name) ?? "");
  return {
    ...DEFAULTS,
    agency: str("agency"),
    contact: str("contact"),
    documentTypes: data.getAll("documentTypes").map(String).filter(isDocumentType),
    otherType: str("otherType"),
    subject: str("subject"),
    parties: str("parties").split(/\r?\n/),
    dateFrom: str("dateFrom"),
    dateTo: str("dateTo"),
    electronicFormat: data.has("electronicFormat"),
    originalMedia: data.has("originalMedia"),
    standing: str("standing") === "proxy" ? "proxy" : "citizen",
    proxyFor: str("proxyFor"),
    requesterName: str("requesterName"),
    requesterEmail: str("requesterEmail"),
    requestDate: str("requestDate"),
  };
}

/** Clipboard API first; a hidden textarea and execCommand("copy") where it is missing or refused. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea
  }
  const active = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  active?.focus();
  return ok;
}

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Sets a status message; clears it first so the same message is announced again. */
function announce(el: HTMLElement | null, message: string) {
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}

export function initLetterBuilder() {
  const form = document.querySelector<HTMLFormElement>("form#builder");
  const preview = document.querySelector<HTMLElement>("#preview .letter__body");
  if (!form || !preview) return;

  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
  const requestDate = $<HTMLInputElement>("#request-date");
  const vague = $("#vague-warning");
  const placeholder = $("#placeholder-note");
  const status = $("#builder-status");
  const followStatus = $("#follow-up-status");
  const panels = { silent: $("#fu-silent"), equivocal: $("#fu-equivocal") };
  const tabs = [...document.querySelectorAll<HTMLButtonElement>("#follow-up [role=tab]")];
  const deadline = {
    request: $("[data-deadline=request]"),
    third: $("[data-deadline=third]"),
  };

  let current: { letter: Sentence[]; silent: Sentence[]; equivocal: Sentence[]; input: LetterInput } | null = null;

  function render() {
    const input = readForm(form!);
    const today = localToday();
    current = {
      input,
      letter: generateLetter(input),
      silent: generateFollowUp(input, "silent", today),
      equivocal: generateFollowUp(input, "equivocal", today),
    };
    preview!.innerHTML = letterHtml(current.letter);
    if (panels.silent) panels.silent.innerHTML = letterHtml(current.silent);
    if (panels.equivocal) panels.equivocal.innerHTML = letterHtml(current.equivocal);

    const noTypes = input.documentTypes.length === 0;
    if (vague) vague.hidden = !(noTypes && isVagueSubject(input.subject));
    if (placeholder) placeholder.hidden = !(noTypes && input.subject.trim() === "");

    const card = generateDeadlineCard(input);
    if (deadline.request) deadline.request.textContent = cardDate(card.requestDate);
    if (deadline.third) deadline.third.textContent = cardDate(card.thirdWorkingDay);
  }

  /** Back to DEFAULTS: the markup's default values, and today's date on the letter. */
  function reset() {
    form!.reset();
    if (requestDate) requestDate.value = localToday();
    render();
  }

  function selectTab(tab: HTMLButtonElement, focus: boolean) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls") ?? "");
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
  }

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("submit", (e) => e.preventDefault());

  $("#copy")?.addEventListener("click", async () => {
    if (!current) return;
    const ok = await copyText(letterToText(current.letter));
    announce(status, ok ? "Copied the letter as plain text." : "Could not copy. Select the letter and copy it by hand.");
  });

  $("#download")?.addEventListener("click", () => {
    if (!current) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(current.input.requestDate) ? current.input.requestDate : localToday();
    download(letterToText(current.letter), `foia-request-${date}.txt`);
    announce(status, `Saved foia-request-${date}.txt.`);
  });

  $("#print")?.addEventListener("click", () => window.print());

  $("#clear")?.addEventListener("click", () => {
    reset();
    announce(status, "Cleared. The form and the letter are back to the start.");
  });

  for (const tab of tabs) {
    tab.addEventListener("click", () => selectTab(tab, false));
    tab.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(tab);
      let next: number | null = null;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      selectTab(tabs[next], true);
    });
  }

  $("#copy-follow-up")?.addEventListener("click", async () => {
    if (!current) return;
    const which = panels.equivocal && !panels.equivocal.hidden ? "equivocal" : "silent";
    const ok = await copyText(letterToText(current[which]));
    announce(followStatus, ok ? "Copied the follow-up as plain text." : "Could not copy. Select the letter and copy it by hand.");
  });

  // Start clean on a reload or a return through history, which would otherwise restore
  // typed values. On a fresh navigation the browser restores nothing, so anything already
  // in the form was typed before this script ran; keep it.
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === "navigate") {
    if (requestDate && !requestDate.value) requestDate.value = localToday();
    render();
  } else {
    reset();
  }
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) reset();
  });
}
