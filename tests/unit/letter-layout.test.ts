import { DEFAULTS, type LetterInput } from "../../src/lib/letter/model";
import { generateLetter, generateFollowUp } from "../../src/lib/letter/generate";
import { layoutLetter, letterToText } from "../../src/lib/letter/layout";
import { letterHtml, PROXY_OPINIONS } from "../../src/components/letter/render";

const FULL: LetterInput = {
  ...DEFAULTS,
  agency: "City of Example",
  contact: "Records Clerk",
  documentTypes: ["contract", "nda"],
  subject: "license-plate reader cameras",
  requesterName: "Pat Requester",
  requesterEmail: "pat@example.org",
  requestDate: "2026-10-09",
};

test("layout: date, address, salutation, body, items, signature", () => {
  const blocks = layoutLetter(generateLetter(FULL));
  expect(blocks.map((b) => b.type).slice(0, 5)).toEqual(["date", "address", "salutation", "paragraph", "items"]);
  expect(blocks[1].sentences.map((s) => s.text)).toEqual(["Records Clerk", "City of Example"]);
  expect(blocks.find((b) => b.type === "items")!.sentences.length).toBe(2);
  const last = blocks[blocks.length - 1];
  expect(last.type).toBe("signature");
  expect(last.sentences.map((s) => s.text)).toEqual(["Sincerely,", "Pat Requester", "pat@example.org"]);
});

test("layout: consecutive sentences with the same basis share a paragraph", () => {
  const blocks = layoutLetter(generateLetter(DEFAULTS));
  const paras = blocks.filter((b) => b.type === "paragraph");
  // standing + "I request copies" share § 25-19-105(a)(2)(A)
  expect(paras[0].sentences.map((s) => s.basis)).toEqual(["§ 25-19-105(a)(2)(A)", "§ 25-19-105(a)(2)(A)"]);
  // exactly one (a)(3) paragraph: existence + exemption sentences are adjacent
  expect(paras.filter((p) => p.sentences[0].basis === "§ 25-19-105(a)(3)").length).toBe(1);
  for (const p of paras) expect(new Set(p.sentences.map((s) => s.basis)).size).toBe(1);
});

test("layout: no date and no address when not given", () => {
  const blocks = layoutLetter(generateLetter(DEFAULTS));
  expect(blocks[0].type).toBe("salutation");
});

test("layout: follow-up keeps its date line", () => {
  const blocks = layoutLetter(generateFollowUp(FULL, "silent", "2026-10-15"));
  expect(blocks[0]).toMatchObject({ type: "date" });
  expect(blocks[0].sentences[0].text).toBe("15 October 2026");
});

test("text: blank lines between blocks, items one per line, trailing newline", () => {
  const text = letterToText(generateLetter(FULL));
  expect(text.startsWith("9 October 2026\n\nRecords Clerk\nCity of Example\n\nTo the custodian of records,\n\nI am a citizen")).toBe(true);
  expect(text).toContain("public records:\n\n1. All contracts concerning license-plate reader cameras.\n2. All non-disclosure agreements");
  expect(text.endsWith("Sincerely,\nPat Requester\npat@example.org\n")).toBe(true);
  expect(text).not.toMatch(/\n{3,}|undefined|§ 25-19-105\(a\)\(3\)\n/);
});

test("html: sentences carry data-basis, title and a focusable basis label; text is escaped", () => {
  const html = letterHtml(generateLetter({ ...DEFAULTS, agency: `<b>"A&B"</b>` }));
  expect(html).toContain("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
  expect(html).not.toContain("<b>");
  expect(html).toMatch(/<span class="sentence" tabindex="0" data-basis="§ 25-19-105\(a\)\(3\)" title="Rests on § 25-19-105\(a\)\(3\)">/);
  expect(html).toContain('<span class="basis">§ 25-19-105(a)(3)</span>');
  expect(html).toContain('<ol class="letter__items">');
  expect(html).not.toContain("undefined");
});

test("html: proxy standing tooltip appends the Attorney General's opinions", () => {
  const html = letterHtml(generateLetter({ ...DEFAULTS, standing: "proxy", proxyFor: "A. Reader" }));
  expect(PROXY_OPINIONS).toBe("Op. Att'y Gen. 2008-191, 97-071, 96-190");
  expect(html).toContain(`title="Rests on § 25-19-105(a)(2)(A); Op. Att&#39;y Gen. 2008-191, 97-071, 96-190"`);
  const citizen = letterHtml(generateLetter(DEFAULTS));
  expect(citizen).not.toContain("Op. Att");
});

test("opinions are set only on the proxy standing sentence, never inferred from user text", () => {
  const input: LetterInput = {
    ...DEFAULTS,
    documentTypes: ["contract"],
    subject: "contracts signed on behalf of the city",
    parties: ["an agent acting on behalf of the vendor"],
    requestDate: "2026-10-09",
  };
  // Citizen standing: nothing carries opinions, in the letter or the follow-ups.
  const citizen = [...generateLetter(input), ...generateFollowUp(input, "silent"), ...generateFollowUp(input, "equivocal")];
  expect(citizen.filter((s) => s.opinions)).toEqual([]);
  const html = [generateLetter(input), generateFollowUp(input, "silent")].map(letterHtml).join("");
  expect(html).toContain("on behalf of the city");
  expect(html).not.toContain("Op. Att");

  // Proxy standing: exactly the standing sentence carries them; items do not.
  const proxy = generateLetter({ ...input, standing: "proxy", proxyFor: "A. Reader" });
  const withOpinions = proxy.filter((s) => s.opinions);
  expect(withOpinions.map((s) => s.text.startsWith("I am a citizen"))).toEqual([true]);
  expect(withOpinions[0].opinions).toBe(PROXY_OPINIONS);
  for (const s of proxy.filter((x) => x.kind === "item")) expect(s.opinions).toBeUndefined();
});

test("proxy standing keeps its own span: the opinions tooltip covers only that sentence", () => {
  const html = letterHtml(generateLetter({ ...DEFAULTS, standing: "proxy", proxyFor: "A. Reader" }));
  const spans = [...html.matchAll(/<span class="sentence"[^>]*title="([^"]*)">([^<]*)/g)].map((m) => ({ title: m[1], text: m[2] }));
  const tagged = spans.filter((s) => s.title.includes("Op. Att"));
  expect(tagged.length).toBe(1);
  expect(tagged[0].text).toMatch(/^I am a citizen/);
  expect(tagged[0].text).not.toContain("I request copies");
  const request = spans.find((s) => s.text.startsWith("I request copies"));
  expect(request?.title).toBe("Rests on § 25-19-105(a)(2)(A)");
});
