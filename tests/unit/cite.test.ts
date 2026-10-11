// tests/unit/cite.test.ts
import { isUrl, isLinkable, hostLabel, parseSource } from "../../src/lib/cite";
test("isUrl accepts only absolute http(s) URLs", () => {
  expect(isUrl("https://arkleg.state.ar.us/")).toBe(true);
  expect(isUrl("http://example.org")).toBe(true);
  expect(isUrl("The Atlantic Monthly, July 1945")).toBe(false);
  expect(isUrl("/manual/the-clock/")).toBe(false);
});
test("isLinkable also accepts site-relative paths", () => {
  expect(isLinkable("/manual/the-clock/")).toBe(true);
  expect(isLinkable("All pages")).toBe(false);
});
test("hostLabel gives the host without www", () => {
  expect(hostLabel("https://www.arkansasag.gov/opinions/")).toBe("arkansasag.gov");
  expect(hostLabel("https://web.archive.org/web/2024/x")).toBe("web.archive.org");
});
test("parseSource splits a 'Label https://url' entry", () => {
  expect(parseSource("AG FOIA Handbook, 22nd ed. https://media.ark.org/ag/x.pdf")).toEqual({
    label: "AG FOIA Handbook, 22nd ed.",
    url: "https://media.ark.org/ag/x.pdf",
  });
});
test("parseSource labels a bare URL by host and keeps plain text unlinked", () => {
  expect(parseSource("https://www.rcfp.org/open-government-guide/arkansas/")).toEqual({
    label: "rcfp.org",
    url: "https://www.rcfp.org/open-government-guide/arkansas/",
  });
  expect(parseSource("Ark. Code Ann. § 25-19-105")).toEqual({ label: "Ark. Code Ann. § 25-19-105" });
});
