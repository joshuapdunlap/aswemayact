import { tieShortWords } from "../../src/lib/typography";

test("ties the section sign and citation abbreviations to the number after them", () => {
  expect(tieShortWords("Ark. Code Ann. § 25-19-101")).toBe("Ark. Code Ann. § 25-19-101");
  expect(tieShortWords("sec. 8, p. 108")).toBe("sec. 8, p. 108");
  expect(tieShortWords("176, no. 1 (July 1945), pp. 101–108")).toBe("176, no. 1 (July 1945), pp. 101–108");
});

test("leaves other spaces alone", () => {
  expect(tieShortWords("say no. Then go")).toBe("say no. Then go");
  expect(tieShortWords("help. 3 days")).toBe("help. 3 days");
  expect(tieShortWords("§§ 25-19-105 and 107")).toBe("§§ 25-19-105 and 107");
});

import { splitStatutes } from "../../src/lib/typography";
test("wraps whole statute numbers in a no-wrap span and leaves the text as written", () => {
  const parts = splitStatutes("under § 25-19-105(d)(3)(A)(iii), and §§ 25-19-101 et seq.");
  expect(parts.map((p) => (p.type === "text" ? p.value : `[${(p as any).children[0].value}]`)).join("")).toBe(
    "under [§ 25-19-105(d)(3)(A)(iii)], and [§§ 25-19-101] et seq.",
  );
  expect(splitStatutes("no citation here")).toEqual([{ type: "text", value: "no citation here" }]);
});

import { breakUrls } from "../../src/lib/typography";
test("lets a web address wrap at its joints, and escapes the rest", () => {
  expect(breakUrls("open https://a.gov/Acts/Doc?path=%2FACTS%2F&file=N.pdf with N")).toBe(
    "open https://a.gov/<wbr>Acts/<wbr>Doc?<wbr>path=<wbr>%2F<wbr>ACTS%2F<wbr>&amp;<wbr>file=<wbr>N.pdf with N",
  );
  expect(breakUrls("no address <here> & there")).toBe("no address &lt;here&gt; &amp; there");
  expect(breakUrls("https://a.gov/x.")).toBe("https://a.gov/<wbr>x.");
});
