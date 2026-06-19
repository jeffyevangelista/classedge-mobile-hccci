# Refresh-endpoint 403 handling — design

**Date:** 2026-06-18
**Status:** Approved
**Priority:** High (silent zombie-session risk; ~30 lines of code)

## Audit findings (2026-06-18)

Backend audited against `classedge-hccci/classedge-mobile-test`:

- `lms/settings.py:418-422` — `SIMPLE_JWT` configures
  `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`,
  `REFRESH_TOKEN_LIFETIME=timedelta(days=30)`.
- `accounts/views/user_views.py:673-740` — `PowerSyncTokenRefreshView`
  extends DRF SimpleJWT's `TokenRefreshView`. Invalid / expired /
  blacklisted refresh tokens raise `InvalidToken`, which DRF SimpleJWT
  maps to **HTTP 401** with body shape `{detail, code: "token_not_valid"}`.
- The view does **not** participate in `drf-standardized-errors`'s
  envelope format — the response body is the legacy SimpleJWT shape,
  not `{type, errors: [...]}`.

The current 401-only client check is therefore **correct today**. The
hardening landed here is forward-compatible:

- Keeps treating 401 (with or without a standardized body) as fatal.
- Additionally treats 401/403 carrying a standardized
  `token_not_valid`/`not_authenticated` code as fatal — covers a future
  in which the refresh endpoint is folded into `drf-standardized-errors`
  or a proxy normalizes status codes.
- Continues to ignore infrastructure 403s (no token-error code in body).


## Problem

`silentRefresh` in `features/auth/useTokenRefresh.ts:89-115` treats only
HTTP **401** from the refresh endpoint as "refresh token is dead":

```ts
if (status === 401) {
  const { isConnected, isInternetReachable } = useStore.getState();
  if (isConnected && isInternetReachable) {
    captureAuthMessage("forced_logout", { reason: "refresh_401" });
    await recordForcedLogout();
    await signOut();
  }
}
return false;
```

The inline comment correctly observes that 403 from a WAF/proxy during a
deploy should not boot a healthy session. That reasoning is sound for
*infrastructure* 403s. But it leaves two real holes:

1. **Cloudflare / nginx / Django middleware can return 403 with a real
   token-revoked semantic.** If an ops engineer ever flips an "admin
   disabled this user" or "session revoked" path that surfaces as 403
   instead of 401, the client will spin forever on a dead token without
   ever logging out. Telemetry will show repeated `silent_refresh_failed`
   events but no `forced_logout`.
2. **`drf-standardized-errors` may surface token errors as 403 in the
   future.** The client already special-cases this in `lib/axios.ts:53-62`
   for *API* calls (treating 401 *or* 403 with `code in {token_not_valid,
   not_authenticated}` as token errors). The refresh endpoint does **not**
   apply the same logic — it inspects only `error.response.status`.

The backend today (`PowerSyncTokenRefreshView` extending DRF SimpleJWT's
`TokenRefreshView`) returns 401 with body `{detail, code: "token_not_valid"}`
on invalid/expired/blacklisted refresh tokens. The current 401-only check
is correct **today**. The hardening is defense-in-depth against future
backend changes or proxy behavior.

## Constraints

- **Do not regress the captive-portal guard.** Today, a 401 from refresh
  *only* triggers forced logout when the device is genuinely online
  (`isConnected && isInternetReachable`). Whatever discriminator we add
  for 403 must preserve that guard.
- **Do not log out on infrastructure 403s.** A Cloudflare WAF challenge,
  a deploy-time misconfiguration, or an expired CDN cert returning 403
  must still pass through and return `false`, not force-logout.
- **Discriminator must be the response body's `code`, not the status
  alone.** Status 403 with no `code: "token_not_valid"` (or
  `not_authenticated`) is treated as a recoverable infra error.
- **Reuse `isStandardizedError` from `lib/api-error.ts`.** Do not
  duplicate the type guard.
- **Telemetry differentiates the path.** `captureAuthMessage("forced_logout",
  { reason: "refresh_403_token_invalid" })` so dashboards can tell the
  two paths apart.

## Decisions

1. **Treat 403 as fatal only when the response body carries a
   token-revocation `code`.** Specifically: HTTP 403 + body matches
   `isStandardizedError` + at least one error has
   `code ∈ {"token_not_valid", "not_authenticated"}`.
2. **Reuse the captive-portal guard for the 403 path.** Identical online
   check as the 401 path.
3. **Add a separate telemetry reason** so future analysis can distinguish
   "backend returned 401" vs "backend / proxy returned 403 with a
   token-revocation code".
4. **No backend changes.** This is purely client hardening. The backend
   behavior is correct today; the client is becoming more tolerant of
   plausible future drift.
5. **No regression test for backend; an audit confirms** the SimpleJWT
   `TokenRefreshView` returns 401 with `code: "token_not_valid"` for
   revoked / expired / blacklisted refresh tokens, recorded in the plan
   as a verification step.

## Architecture summary

| File | Change |
|---|---|
| `features/auth/useTokenRefresh.ts:89-115` | Extract a `isTokenInvalidResponse(error)` helper. Call it after the existing 401 check; if true and online, run the same `recordForcedLogout → signOut` path with telemetry reason `refresh_403_token_invalid`. |
| `lib/api-error.ts` (existing) | Reused; no change. |

## Out of scope

- Re-architecting the refresh endpoint or session model.
- Adding a "session revoked by admin" UI distinct from the generic
  "Session Expired" dialog. Surface is shared.
- Backend changes to standardize the refresh endpoint's error format
  under `drf-standardized-errors`. (Worth a separate ticket.)

## Open questions

None. Backend audit in the plan confirms current behavior; the change is
forward-compatible with either status code carrying a token-revocation
code.
