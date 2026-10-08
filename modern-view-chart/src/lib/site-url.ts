const PRODUCTION_SITE_URL = "https://vivutrade.io.vn";
const DEVELOPMENT_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const fallback = process.env.NODE_ENV === "production"
    ? PRODUCTION_SITE_URL
    : DEVELOPMENT_SITE_URL;
  const normalized = raw
    ? /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`
    : fallback;

  try {
    return new URL(normalized);
  } catch {
    return new URL(fallback);
  }
}

export function getSiteOrigin(): string {
  return getSiteUrl().origin;
}
