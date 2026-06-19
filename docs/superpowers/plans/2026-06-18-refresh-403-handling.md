# Refresh-endpoint 403 handling — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat HTTP 403 from the refresh endpoint as a fatal session-expired signal **when** the body carries a `token_not_valid` / `not_authenticated` code, while preserving the captive-portal guard and continuing to ignore infrastructure 403s.

**Architecture:** Extract a small `isTokenInvalidResponse` helper that pattern-matches the axios error against the existing `StandardizedErrorResponse` shape and the two token-error codes. `silentRefresh`'s catch block fires forced logout on either 401 (existing behavior) or `isTokenInvalidResponse(error) === true` (new). All existing guards (online check, telemetry, signOut sequence) are reused. Backend audit confirms current 401-only behavior; the change is forward-compatible.

**Tech Stack:** TypeScript, axios, existing `lib/api-error.ts` `isStandardizedError` type guard, existing `captureAuthMessage` telemetry, no new dependencies.

## Global Constraints

- **Spec reference:** `docs/superpowers/specs/2026-06-18-refresh-403-handling-design.md`.
- **No backend changes.** Behavior is verified-then-hardened on the client.
- **Do not auto-stage or commit.** Leave `git add` / `git commit` to the human reviewer; suggested commit messages are guidance only.
- **Preserve the captive-portal guard.** Forced logout still requires `isConnected && isInternetReachable`.
- **Discriminator is body `code`, not status.** A 403 without `code: "token_not_valid"` or `code: "not_authenticated"` is a recoverable infra error and must **not** force logout.
- **Reuse `isStandardizedError`** from `lib/api-error.ts`. Do not duplicate the type guard.

---

### Task 1: Backend audit — confirm 401-only on revoked / expired refresh

**Files:**
- Read: `classedge-mobile-test/lms/settings.py:418-440` (SIMPLE_JWT config)
- Read: `classedge-mobile-test/accounts/views/user_views.py:673-740` (PowerSyncTokenRefreshView)

**Interfaces:**
- Produces: an audit note appended at the **top** of the spec recording (a) the current backend's response status + body for invalid / expired / blacklisted refresh tokens and (b) confirmation that the new client behavior is forward-compatible with current behavior.

- [ ] **Step 1: Verify SIMPLE_JWT config**

Open `classedge-mobile-test/lms/settings.py:418-440`. Confirm:
- `ROTATE_REFRESH_TOKENS = True`
- `BLACKLIST_AFTER_ROTATION = True`
- `REFRESH_TOKEN_LIFETIME = timedelta(days=30)`

Record findings inline (in a scratch buffer or PR description).

- [ ] **Step 2: Verify `PowerSyncTokenRefreshView` raises `InvalidToken`**

Open `classedge-mobile-test/accounts/views/user_views.py:673-740`. Confirm:
- The `except TokenError` block (line ~680) calls `raise InvalidToken(exc.args[0])`.
- The fallback `Invalid refresh token.` (line ~695) is also `InvalidToken`.

DRF SimpleJWT's `InvalidToken` exception extends `AuthenticationFailed` which DRF maps to HTTP **401** with body shape `{detail, code}`. This is the **expected current behavior**; the client's 401-only check is correct **today**.

- [ ] **Step 3: Confirm response body shape with a manual probe**

From a shell with the dev backend running, send a refresh request with a bogus refresh token:

```bash
curl -i -X POST "${API_BASE_URL}/auth/refresh/" \
  -H "Content-Type: application/json" \
  -d '{"refresh":"not-a-jwt"}'
```

Expected: `HTTP/1.1 401 Unauthorized` and body containing `"code":"token_not_valid"`. Capture the exact body for the spec.

- [ ] **Step 4: Record the audit in the spec**

Edit `docs/superpowers/specs/2026-06-18-refresh-403-handling-design.md`: add an "Audit findings (YYYY-MM-DD)" section near the top that records:
- Status code observed: 401
- Body code observed: `token_not_valid`
- Forward-compat: the client change in this plan keeps treating 401 as fatal and *additionally* treats 403-with-token-code as fatal.

- [ ] **Step 5: Commit (human reviewer)**

Suggested message: `docs(spec): record refresh-endpoint backend audit findings`.

---

### Task 2: Extract `isTokenInvalidResponse` helper

**Files:**
- Create: `features/auth/isTokenInvalidResponse.ts`
- Test: `features/auth/__tests__/isTokenInvalidResponse.test.ts`

**Interfaces:**
- Consumes: `isStandardizedError` from `lib/api-error.ts`.
- Produces:
  - `isTokenInvalidResponse(error: unknown): boolean`
  - Returns `true` if all of: `error?.response?.status` ∈ {401, 403}; `error.response.data` passes `isStandardizedError`; at least one error item has `code` ∈ {`"token_not_valid"`, `"not_authenticated"`}.
  - Returns `true` if `status === 401` and the body is not standardized (legacy SimpleJWT shape) — falls back to status-only.
  - Returns `false` otherwise (including non-axios errors, infra 403s, network failures).

- [ ] **Step 1: Write the failing tests**

Create `features/auth/__tests__/isTokenInvalidResponse.test.ts`:

```ts
import { isTokenInvalidResponse } from "../isTokenInvalidResponse";

function axiosLike(status: number, data?: unknown) {
  return { response: { status, data } } as any;
}

describe("isTokenInvalidResponse", () => {
  it("returns false for null / undefined errors", () => {
    expect(isTokenInvalidResponse(null)).toBe(false);
    expect(isTokenInvalidResponse(undefined)).toBe(false);
  });

  it("returns false for network errors (no response)", () => {
    expect(isTokenInvalidResponse({ request: {} })).toBe(false);
  });

  it("returns true for legacy 401 with no standardized body", () => {
    expect(
      isTokenInvalidResponse(
        axiosLike(401, { detail: "Token is invalid", code: "token_not_valid" }),
      ),
    ).toBe(true);
  });

  it("returns true for 403 with standardized token_not_valid code", () => {
    expect(
      isTokenInvalidResponse(
        axiosLike(403, {
          type: "client_error",
          errors: [
            { code: "token_not_valid", detail: "Token invalid", attr: null },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("returns true for 403 with not_authenticated code", () => {
    expect(
      isTokenInvalidResponse(
        axiosLike(403, {
          type: "client_error",
          errors: [
            { code: "not_authenticated", detail: "Not authenticated", attr: null },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("returns false for 403 from WAF / infra (no token code)", () => {
    expect(
      isTokenInvalidResponse(
        axiosLike(403, {
          type: "client_error",
          errors: [
            { code: "permission_denied", detail: "Forbidden", attr: null },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("returns false for 403 with arbitrary HTML body (Cloudflare challenge)", () => {
    expect(
      isTokenInvalidResponse(axiosLike(403, "<html>cf challenge</html>")),
    ).toBe(false);
  });

  it("returns false for 500", () => {
    expect(
      isTokenInvalidResponse(
        axiosLike(500, {
          type: "server_error",
          errors: [{ code: "error", detail: "boom", attr: null }],
        }),
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:
```bash
pnpm test features/auth/__tests__/isTokenInvalidResponse.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `features/auth/isTokenInvalidResponse.ts`:

```ts
import { isStandardizedError } from "@/lib/api-error";

const TOKEN_ERROR_CODES = new Set(["token_not_valid", "not_authenticated"]);

/**
 * True when an axios error indicates the refresh token itself is
 * server-side invalid (revoked, expired, blacklisted), as opposed to an
 * infrastructure 401/403 (WAF, proxy, deploy hiccup).
 *
 * - 401 with no standardized body → treated as token-invalid (legacy
 *   SimpleJWT shape).
 * - 401 or 403 with a standardized body carrying a token-error `code`
 *   → token-invalid.
 * - 403 without a token-error code → infrastructure; recoverable.
 */
export function isTokenInvalidResponse(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const response = (error as { response?: { status?: number; data?: unknown } })
    .response;
  if (!response || typeof response.status !== "number") return false;

  const { status, data } = response;
  if (status !== 401 && status !== 403) return false;

  if (isStandardizedError(data)) {
    return data.errors.some((e) => TOKEN_ERROR_CODES.has(e.code));
  }

  // Legacy SimpleJWT shape: 401 with {detail, code} body, not the
  // drf-standardized-errors envelope. Trust the 401 status alone.
  return status === 401;
}
```

- [ ] **Step 4: Run the tests**

Run:
```bash
pnpm test features/auth/__tests__/isTokenInvalidResponse.test.ts
```
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit (human reviewer)**

Suggested message: `feat(auth): isTokenInvalidResponse helper for refresh-endpoint errors`.

---

### Task 3: Use the helper in `silentRefresh`

**Files:**
- Modify: `features/auth/useTokenRefresh.ts:89-115`

**Interfaces:**
- Consumes: `isTokenInvalidResponse` from Task 2.
- Produces: `silentRefresh` now triggers forced logout on either 401 or 403-with-token-code, preserving the online guard. New telemetry reasons `refresh_401` (existing) and `refresh_403_token_invalid` (new) distinguish the paths.

- [ ] **Step 1: Import the helper**

Edit `features/auth/useTokenRefresh.ts`. Near the existing imports (lines 1-10), add:

```ts
import { isTokenInvalidResponse } from "./isTokenInvalidResponse";
```

- [ ] **Step 2: Replace the catch block's forced-logout branch**

In `features/auth/useTokenRefresh.ts`, locate the catch block (lines 89-115). Replace lines 97-114 (from `const status = error?.response?.status;` through the closing of the if block + `return false;`) with:

```ts
        const status = error?.response?.status;
        captureAuthError("silent_refresh_failed", error, { status });
        await appendSyncEvent({
          kind: "auth",
          status: "fail",
          httpStatus: typeof status === "number" ? status : null,
          message:
            error instanceof Error ? error.message : "Silent refresh failed",
        });

        const tokenInvalid = isTokenInvalidResponse(error);
        if (tokenInvalid) {
          const { isConnected, isInternetReachable } = useStore.getState();
          if (isConnected && isInternetReachable) {
            const reason =
              status === 401 ? "refresh_401" : "refresh_403_token_invalid";
            captureAuthMessage("forced_logout", { reason });
            await recordForcedLogout();
            await signOut();
          }
        }
        return false;
```

- [ ] **Step 3: TypeScript check**

Run:
```bash
pnpm tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Run all tests**

Run:
```bash
pnpm test
```
Expected: all tests pass.

- [ ] **Step 5: Manual smoke — 401 path still works (regression check)**

1. Sign in.
2. Reset the device clock forward by 31 days (or use a backend test endpoint that blacklists the current refresh token) to simulate a real 401 from `/auth/refresh/`.
3. Trigger any API request (or wait for the next foreground poll).
4. Expected: `silentRefresh` returns false, `recordForcedLogout` runs, `signOut` runs, and on next LoginScreen mount the Session Expired dialog appears.

If reproducing a real 401 is hard, fall back to a unit-style test by mocking `refresh()` to reject with `{ response: { status: 401, data: { detail: "x", code: "token_not_valid" } } }` and asserting `signOut` was called.

- [ ] **Step 6: Manual smoke — 403 with token code triggers forced logout**

1. Sign in.
2. In the debugger, monkey-patch `refresh` for one call:
   ```js
   const refreshMod = require("@/features/auth/refreshToken");
   const orig = refreshMod.refresh;
   refreshMod.refresh = async () => {
     const err = new Error("force-revoke");
     err.response = {
       status: 403,
       data: {
         type: "client_error",
         errors: [
           { code: "token_not_valid", detail: "revoked", attr: null },
         ],
       },
     };
     throw err;
   };
   await require("@/features/auth/useTokenRefresh").silentRefresh({ force: true });
   refreshMod.refresh = orig;
   ```
3. Expected: forced logout fires, user lands on LoginScreen with the Session Expired dialog.

- [ ] **Step 7: Manual smoke — infra 403 does NOT force logout**

1. Repeat Step 6 but with the body `{ type: "client_error", errors: [{ code: "permission_denied", detail: "x", attr: null }] }`.
2. Expected: `silentRefresh` returns false, the user **stays signed in**, and `signOut` was NOT called.

- [ ] **Step 8: Commit (human reviewer)**

Suggested message: `feat(auth): treat refresh 403-with-token-code as forced logout`.

---

### Task 4: Telemetry / dashboard verification

**Files:**
- None (verification only).

**Interfaces:**
- None.

- [ ] **Step 1: Check Sentry for the new event**

After Task 3 manual smoke, open Sentry (or whichever destination `captureAuthMessage` writes to) and confirm:
- `forced_logout` event with `reason: "refresh_401"` is still recorded (existing path).
- `forced_logout` event with `reason: "refresh_403_token_invalid"` is recorded (new path).

- [ ] **Step 2: Add a brief memory note**

Update auto-memory (`feedback_*.md` or `project_*.md` as appropriate) to record: "Refresh-endpoint 403 with token_not_valid code now triggers forced logout (defense-in-depth; client-only change, no backend change)." Skip if not material to future conversations.

---

## Self-Review checklist

- Spec section "Constraints" "do not regress captive-portal guard": Task 3 step 2 keeps the `isConnected && isInternetReachable` gate. ✅
- Spec "do not log out on infrastructure 403s": Task 2 helper requires a token-error code; Task 3 manual smoke step 7 verifies. ✅
- Spec "discriminator is body code, not status": Task 2 implementation matches. ✅
- Spec "reuse `isStandardizedError`": Task 2 imports the existing helper. ✅
- Spec "telemetry differentiates the path": Task 3 uses separate `reason` strings; Task 4 verifies. ✅
- Backend audit task documents the *current* behavior so future drift is detectable. ✅
- No placeholders. Every code block is complete. Helper signature consistent between Task 2 and Task 3.
