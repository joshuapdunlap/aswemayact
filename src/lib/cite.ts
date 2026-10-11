// Helpers for rendering a citation's source, which is either a URL or plain text.

/** True when `s` is an absolute http(s) URL. */
export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

/** True when `s` can be an href: an absolute http(s) URL or a site-relative path. */
export function isLinkable(s: string): boolean {
  return isUrl(s) || s.startsWith("/");
}

/** Link text for a URL source: its host without a leading "www.". */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * A frontmatter source entry, "Label https://url": the label and its link. A bare URL is
 * labelled by its host; text without a URL is returned as a label alone.
 */
export function parseSource(s: string): { label: string; url?: string } {
  const m = s.trim().match(/^(.*?)\s*(https?:\/\/\S+)$/);
  if (!m) return { label: s.trim() };
  return { label: m[1] || hostLabel(m[2]), url: m[2] };
}
