---
name: auth
description: "Skill for the Auth area of BE_ViewChart. 98 symbols across 29 files."
---

# Auth

98 symbols | 29 files | Cohesion: 82%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how logError, issueAuthTokens, verifyAccessToken work
- Modifying auth-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/backend/auth/userJwt.js` | getAccessTokenFallbackSecret, getRefreshFallbackFromAccessToken, getAccessSecret, getRefreshSecret, getAccessTtl (+12) |
| `modern-view-chart/src/lib/auth/client-session.ts` | readStoredAccessToken, getStoredAccessToken, writeStoredSession, clearStoredSession, updateStoredSession (+5) |
| `modern-view-chart/backend/modules/auth/token-utils.js` | getGoogleClientId, parseJwtPayload, toAuthResponse, normalizeModuleKey, dedupeModules (+2) |
| `modern-view-chart/src/lib/auth/session.ts` | readStoredAccessToken, refreshStoredAccessToken, writeStoredAuthSession, clearStoredAuthSession, readStoredAuthUser (+1) |
| `modern-view-chart/src/lib/auth/entitlements.ts` | normalizeModules, inferModulesFromPlan, readAuthUserObject, setClientModulesLocal, setClientPlanLocal (+1) |
| `modern-view-chart/src/components/auth/GoogleSignInButton.tsx` | resolveLocalizedRedirectTarget, GoogleSignInButton, resolveClientId, mountButton, boot (+1) |
| `modern-view-chart/backend/auth/modules.js` | normalizeModuleKey, normalizeEntitlementModules, inferPlanFromModules, inferModulesFromPlan, resolveUserEntitlements |
| `modern-view-chart/backend/auth/accessTicket.js` | decodeBase64Url, verifyAccessTicket, encodeBase64Url, createAccessTicket |
| `modern-view-chart/backend/services/database.js` | maybeConfigureMongoDns, registerConnectionListeners, useDatabase |
| `modern-view-chart/backend/modules/auth/cookie-utils.js` | getRefreshTokenFromRequest, setRefreshCookie, clearRefreshCookie |

## Entry Points

Start here when exploring this area:

- **`logError`** (Function) — `modern-view-chart/backend/logger.js:46`
- **`issueAuthTokens`** (Function) — `modern-view-chart/backend/auth/userJwt.js:86`
- **`verifyAccessToken`** (Function) — `modern-view-chart/backend/auth/userJwt.js:132`
- **`rotateRefreshToken`** (Function) — `modern-view-chart/backend/auth/userJwt.js:145`
- **`revokeRefreshToken`** (Function) — `modern-view-chart/backend/auth/userJwt.js:175`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `logError` | Function | `modern-view-chart/backend/logger.js` | 46 |
| `issueAuthTokens` | Function | `modern-view-chart/backend/auth/userJwt.js` | 86 |
| `verifyAccessToken` | Function | `modern-view-chart/backend/auth/userJwt.js` | 132 |
| `rotateRefreshToken` | Function | `modern-view-chart/backend/auth/userJwt.js` | 145 |
| `revokeRefreshToken` | Function | `modern-view-chart/backend/auth/userJwt.js` | 175 |
| `normalizeUserRole` | Function | `modern-view-chart/backend/auth/roles.js` | 2 |
| `isRoleAllowed` | Function | `modern-view-chart/backend/auth/roles.js` | 10 |
| `login` | Function | `modern-view-chart/backend/modules/user/auth.controller.js` | 53 |
| `getGoogleClientId` | Function | `modern-view-chart/backend/modules/auth/token-utils.js` | 0 |
| `parseJwtPayload` | Function | `modern-view-chart/backend/modules/auth/token-utils.js` | 4 |
| `toAuthResponse` | Function | `modern-view-chart/backend/modules/auth/token-utils.js` | 88 |
| `getRefreshTokenFromRequest` | Function | `modern-view-chart/backend/modules/auth/cookie-utils.js` | 0 |
| `setRefreshCookie` | Function | `modern-view-chart/backend/modules/auth/cookie-utils.js` | 10 |
| `clearRefreshCookie` | Function | `modern-view-chart/backend/modules/auth/cookie-utils.js` | 22 |
| `refresh` | Function | `modern-view-chart/backend/modules/auth/handlers/token-handlers.js` | 7 |
| `logout` | Function | `modern-view-chart/backend/modules/auth/handlers/token-handlers.js` | 35 |
| `revokeSessions` | Function | `modern-view-chart/backend/modules/auth/handlers/session-handlers.js` | 6 |
| `login` | Function | `modern-view-chart/backend/modules/auth/handlers/login-handlers.js` | 12 |
| `googleLogin` | Function | `modern-view-chart/backend/modules/auth/handlers/login-handlers.js` | 48 |
| `readStoredAccessToken` | Function | `modern-view-chart/src/lib/auth/session.ts` | 11 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Refresh → GetAccessTokenFallbackSecret` | intra_community | 6 |
| `Refresh → GetRefreshFallbackFromAccessToken` | intra_community | 6 |
| `CreateApp → GetAccessTokenFallbackSecret` | cross_community | 6 |
| `Login → GetAccessTokenFallbackSecret` | intra_community | 5 |
| `Login → GetRefreshFallbackFromAccessToken` | intra_community | 5 |
| `ModuleHubClient → NormalizeModules` | cross_community | 5 |
| `ModuleHubClient → InferModulesFromPlan` | cross_community | 5 |
| `PollRemoteState → ReadStoredAccessToken` | cross_community | 5 |
| `UpsertUserModules → NormalizeModuleKey` | intra_community | 5 |
| `RunInitialSync → ReadStoredAccessToken` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 5 calls |
| User | 4 calls |
| Backend | 3 calls |

## How to Explore

1. `gitnexus_context({name: "logError"})` — see callers and callees
2. `gitnexus_query({query: "auth"})` — find related execution flows
3. Read key files listed above for implementation details
