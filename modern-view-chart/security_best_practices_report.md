# Security Best Practices Report

## Executive Summary
Security review for the web stack (Next.js frontend + Express backend) found **4 meaningful issues**:
- 2 high-risk findings that should be fixed first (password storage design, token transport/storage design).
- 2 medium-risk hardening gaps (CSP/header posture and legacy query-token auth compatibility).

---

## High Severity

### SEC-001: Reversible password storage (encryption/decryption instead of one-way hashing)
**Impact:** If database and/or encryption key leaks, attacker can recover plaintext user passwords and reuse them across systems.

**Evidence:**
- `backend/modules/user/user.controller.js:74-77` encrypts password with AES (`CryptoJS.AES.encrypt`).
- `backend/modules/user/user.controller.js:130-135` decrypts stored password and compares plaintext.
- `backend/modules/auth/auth.controller.js:74-77` also decrypts stored password for login.

**Why this is risky:** Passwords must be stored as one-way hashes (Argon2id/bcrypt/scrypt), never decryptable.

**Recommendation:**
- Migrate to `bcrypt` or `argon2` (`hash` at register/change-password, `compare` at login).
- Add progressive migration: when login succeeds with legacy format, re-hash immediately and replace stored value.
- Rotate `KEY_CRYPTO` after migration completion (and remove password encryption path).

---

### SEC-002: Sensitive auth tokens are passed/stored in weak channels (query string + localStorage)
**Impact:** Access/service tokens can leak via logs, browser history, analytics/referrer surfaces, or be stolen via XSS.

**Evidence:**
- Query token injection in proxy:
  - `src/app/api/[...path]/route.ts:19-22` appends `ACCESS_TOKEN` as `access_token` query parameter.
- Backend auth allows service auth via query params:
  - `backend/middlewares/requireAuth.js:19-29` accepts `access_token`/`access_ticket` from query.
- WebSocket query-token compatibility path exists and defaults enabled:
  - `backend/websocket/index.js:49` (`WS_ALLOW_QUERY_AUTH` defaults `true`).
  - `backend/websocket/index.js:133-155` accepts query auth during deprecation window.
- Frontend stores bearer access token in `localStorage`:
  - `src/components/auth/GoogleSignInButton.tsx:123-124` stores `auth_access_token`.

**Why this is risky:**
- Query params are commonly logged and broadly exposed.
- localStorage tokens are directly readable by injected scripts (XSS blast radius increases).

**Recommendation:**
- Stop using query string tokens for HTTP/WS auth in production.
- Prefer `Authorization: Bearer ...` header (or short-lived ws-ticket in protocol only).
- Keep refresh token in `HttpOnly` cookie; avoid storing access token in localStorage (or keep very short TTL + strict CSP if migration is staged).
- Set `WS_ALLOW_QUERY_AUTH=false` in production and remove legacy compatibility after cutoff.

---

## Medium Severity

### SEC-003: CSP is permissive (`unsafe-inline`) and baseline security headers are incomplete
**Impact:** XSS impact reduction is weakened; missing standard hardening headers increases exploitability of client-side bugs.

**Evidence:**
- `backend/app.js:129-130` sets `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'`.
- No centralized `helmet()` usage found in middleware stack.

**Recommendation:**
- Introduce `helmet()` with tailored config.
- Move toward nonce-based CSP for scripts and remove `unsafe-inline` where feasible.
- Ensure baseline headers (`X-Content-Type-Options`, frame protections via CSP `frame-ancestors` / X-Frame-Options, referrer policy).

---

### SEC-004: WS query-auth deprecation window is time-based with permissive fallback defaults
**Impact:** If env is misconfigured/missing, query-based auth remains active by default longer than intended.

**Evidence:**
- `backend/websocket/index.js:49-54` defaults to allowing query auth and sets fallback sunset window dynamically (`now + 14 days`) when env missing.

**Recommendation:**
- Fail closed in production: default `WS_ALLOW_QUERY_AUTH=false`.
- Require explicit allowlist/feature flag for temporary compatibility.
- Emit startup warning/error when deprecated auth mode is active.

---

## Suggested Fix Order
1. SEC-001 password hashing migration.
2. SEC-002 remove query-token/localStorage token patterns.
3. SEC-003 tighten CSP + add `helmet` baseline.
4. SEC-004 make WS query-auth fail-closed by default.
