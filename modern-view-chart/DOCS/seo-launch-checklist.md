# SEO Launch Checklist (vivutrade)

## 1) Environment
- Set `NEXT_PUBLIC_SITE_URL` to production URL (example: `https://vivutrade.com`).
- Ensure HTTPS certificate is valid and redirects are configured consistently.

## 2) Crawlability
- Verify `https://<domain>/robots.txt` returns 200.
- Verify `https://<domain>/sitemap.xml` returns 200 and includes key routes:
  - `/landing`, `/about`, `/contact`, `/privacy`, `/terms`, `/`, `/strategy/dashboard`, `/strategy/matrix`.
- Verify `https://<domain>/llms.txt` returns 200.

## 3) Metadata & Structured Data
- Check each public page has:
  - unique `title`, `description`, `canonical`.
  - Open Graph metadata.
- Validate JSON-LD on pages:
  - Organization, WebSite (site-wide).
  - SoftwareApplication (landing/about).
  - FAQPage (landing).
  - BreadcrumbList (content/legal pages).

## 4) UX & Readability
- Verify Vietnamese text renders correctly (no encoding artifacts).
- Verify heading hierarchy (`h1 > h2 > h3`) is logical.
- Verify text/button contrast is readable on desktop and mobile.

## 5) Indexing Setup
- Add property in Google Search Console and Bing Webmaster Tools.
- Submit `/sitemap.xml`.
- Request indexing for:
  - `/landing`
  - `/about`
  - `/privacy`
  - `/terms`

## 6) Post-Launch QA
- Run production build and smoke test routes.
- Confirm no 404 in internal links across footer/header/content.
- Track initial crawl/index status during first 7 days.
