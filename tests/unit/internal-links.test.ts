// tests/unit/internal-links.test.ts
import { internalRef, distFileFor, collectRefsAndIds } from "../../src/lib/internal-links";

test("internal references resolve against the page; external and special schemes are skipped", () => {
  expect(internalRef("/manual/", "/")).toEqual({ path: "/manual/", fragment: null, samePage: false });
  expect(internalRef("/manual/the-clock/#keeping-time", "/")).toEqual({ path: "/manual/the-clock/", fragment: "keeping-time", samePage: false });
  expect(internalRef("#fn-1", "/about/")).toEqual({ path: "/about/", fragment: "fn-1", samePage: true });
  expect(internalRef("../sources/?q=1", "/manual/denied/")).toEqual({ path: "/manual/sources/", fragment: null, samePage: false });
  expect(internalRef("/pagefind/pagefind-ui.js", "/search/")).toEqual({ path: "/pagefind/pagefind-ui.js", fragment: null, samePage: false });
  expect(internalRef("/manual/write-a-request/#what%20to%20ask", "/")).toEqual({ path: "/manual/write-a-request/", fragment: "what to ask", samePage: false });
  for (const v of ["https://example.org/", "//cdn.example.org/x.js", "mailto:editor@aswemayact.org", "tel:+15015550100", "data:image/png;base64,AA", "javascript:void(0)", "#", ""]) {
    expect(internalRef(v, "/")).toBeNull();
  }
});

test("a site path maps to the built file Workers static assets would serve", () => {
  const files = new Set(["dist/index.html", "dist/manual/index.html", "dist/favicon.svg", "dist/_astro/a.b1.css", "dist/legacy.html"]);
  const exists = (f: string) => files.has(f);
  expect(distFileFor("/", exists)).toBe("dist/index.html");
  expect(distFileFor("/manual/", exists)).toBe("dist/manual/index.html");
  expect(distFileFor("/manual", exists)).toBe("dist/manual/index.html"); // auto-trailing-slash
  expect(distFileFor("/favicon.svg", exists)).toBe("dist/favicon.svg");
  expect(distFileFor("/_astro/a.b1.css", exists)).toBe("dist/_astro/a.b1.css");
  expect(distFileFor("/legacy", exists)).toBe("dist/legacy.html");
  expect(distFileFor("/trails/", exists)).toBeNull();
  expect(distFileFor("/missing.js", exists)).toBeNull();
});

test("collects href and src values and every id (and a[name]) from a page", () => {
  const html = `<!doctype html><html><head><link rel="icon" href="/favicon.svg"><script src="/_astro/x.js"></script></head>
    <body><a href="#main" id="skip">Skip</a><main id="main"><img src="/img.png" alt=""><a name="old"></a>
    <a href="mailto:x@y.z">mail</a><a>no href</a></main></body></html>`;
  const { refs, ids } = collectRefsAndIds(html);
  expect(refs).toEqual([
    { attr: "href", value: "/favicon.svg" },
    { attr: "src", value: "/_astro/x.js" },
    { attr: "href", value: "#main" },
    { attr: "src", value: "/img.png" },
    { attr: "href", value: "mailto:x@y.z" },
  ]);
  expect([...ids].sort()).toEqual(["main", "old", "skip"]);
});
