const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const normalized = raw
    ? /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`
    : DEFAULT_SITE_URL;

  try {
    return new URL(normalized);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function getSiteOrigin(): string {
  return getSiteUrl().origin;
}
