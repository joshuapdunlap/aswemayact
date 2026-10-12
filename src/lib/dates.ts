const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// Frontmatter dates parse as UTC midnight, so all date math here is UTC.

/** Folio date, "d MMM yyyy" with English month abbreviations: "11 Oct 2026". */
export function formatFolio(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Folio date to the month, for pages dated by issue rather than reviewed: "Oct 2026". */
export function formatFolioMonth(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Kicker dateline, uppercase: "LITTLE ROCK · OCTOBER 2026". */
export function formatDateline(place: string, d: Date): string {
  return `${place} · ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`.toUpperCase();
}
