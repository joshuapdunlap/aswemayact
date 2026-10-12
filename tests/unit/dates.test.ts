// tests/unit/dates.test.ts
import { formatFolio } from "../../src/lib/dates";
test("formats folio date as d MMM yyyy", () => {
  expect(formatFolio(new Date(Date.UTC(2026, 9, 11)))).toBe("11 Oct 2026");
  expect(formatFolio(new Date(Date.UTC(2026, 0, 3)))).toBe("3 Jan 2026");
});

import { formatDateline } from "../../src/lib/dates";
test("formats a kicker dateline as PLACE · MONTH YYYY", () => {
  expect(formatDateline("Little Rock", new Date(Date.UTC(2026, 9, 11)))).toBe("LITTLE ROCK · OCTOBER 2026");
  expect(formatDateline("Fort Smith", new Date(Date.UTC(2025, 0, 1)))).toBe("FORT SMITH · JANUARY 2025");
});

import { formatFolioMonth } from "../../src/lib/dates";
test("formats a month folio as MMM yyyy", () => {
  expect(formatFolioMonth(new Date(Date.UTC(2026, 9, 1)))).toBe("Oct 2026");
  expect(formatFolioMonth(new Date(Date.UTC(2025, 0, 31)))).toBe("Jan 2025");
});
