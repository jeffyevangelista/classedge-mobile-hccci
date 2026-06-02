# Flow-Keyed OAuth Verifier Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the "No codeVerifier in storage" error class by keying PKCE verifier storage to per-flow IDs round-tripped via OAuth `state` parameter, with TTL pruning.

**Architecture:** A new thin module `oauthVerifierStore.ts` encapsulates per-flow MMKV storage (`oauth_verifier:<flowId>`). `authService.ts` generates a UUID flowId per login, passes it as `state` in the AuthRequest, stores the verifier keyed by that ID, and on callback looks up the verifier by the round-tripped `state`. `cancelOAuth()` stops destroying verifiers; pruning happens lazily on each new login (10-minute TTL matches MS code expiry).

**Tech Stack:** expo-auth-session (state param), expo-crypto (UUID), react-native-mmkv (key iteration), Zustand. **No automated test infrastructure** — verification per task is `npx tsc --noEmit` + manual dev-build smoke test.

**Source documents:**
- Spec: `docs/superpowers/specs/2026-06-02-flow-keyed-oauth-verifier-design.md`
- Current OAuth service (to be modified): `features/auth/authService.ts`
- Current MMKV helpers: `lib/storage/mmkv-storage.ts` + `lib/storage/mmkvPersister.ts`

**Commit policy:** Standing user preference is no auto-commit. Each task ends with a suggested commit message. The implementer should stage the files and either commit or batch with adjacent tasks at their discretion.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/telemetry.ts` | Modify | Add `oauth_stale_url_ignored` event |
| `lib/storage/mmkv-storage.ts` | Modify | Expose `getAllMMKVKeys()` helper |
| `features/auth/oauthVerifierStore.ts` | Create | Per-flow verifier save/get/delete/prune |
| `features/auth/authService.ts` | Modify | Use flowId + state, delegate to verifier store, stop deleting verifiers in cancelOAuth |
| `utils/storage-keys.ts` | Modify | Remove now-unused `OAUTH_CODE_VERIFIER` constant |

---

## Phase 1 — Foundation (no behavior change)

### Task 1: Add `oauth_stale_url_ignored` telemetry event

**Files:**
- Modify: `lib/telemetry.ts`

- [ ] **Step 1: Read** `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/lib/telemetry.ts` to confirm the current `TelemetryEvent` union.

- [ ] **Step 2: Apply the edit**

Find:
```ts
export type TelemetryEvent =
  // auth flow
  | "ms_token_exchange_failed"
  | "silent_refresh_failed"
  | "forced_logout"
  | "account_switch_detected"
  // oauth lifecycle
  | "oauth_started"
  | "oauth_phase_timeout"
  | "oauth_cold_start_recovery"
  // section rendering
  | "section_loading_slow"
  | "section_offline_empty"
  | "post_login_ready";
```

Replace with:
```ts
export type TelemetryEvent =
  // auth flow
  | "ms_token_exchange_failed"
  | "silent_refresh_failed"
  | "forced_logout"
  | "account_switch_detected"
  // oauth lifecycle
  | "oauth_started"
  | "oauth_phase_timeout"
  | "oauth_cold_start_recovery"
  | "oauth_stale_url_ignored"
  // section rendering
  | "section_loading_slow"
  | "section_offline_empty"
  | "post_login_ready";
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 4: Stage**

```bash
git add lib/telemetry.ts
```

Suggested commit message: `feat(telemetry): add oauth_stale_url_ignored event for benign stale URL detections`

---

### Task 2: Add `getAllMMKVKeys` helper to the storage wrapper

**Files:**
- Modify: `lib/storage/mmkv-storage.ts`

**Context:** The MMKV instance is exported as `storage` from `lib/storage/mmkvPersister.ts`. `react-native-mmkv` provides `storage.getAllKeys(): string[]`. We expose a thin wrapper to keep `mmkv-storage.ts` as the canonical entry point.

- [ ] **Step 1: Read** `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/lib/storage/mmkv-storage.ts` (current content: three exports — `getMMKVItem`, `setMMKVItem`, `deleteMMKVItem`).

- [ ] **Step 2: Append the new helper**

After the existing `deleteMMKVItem` function (at the end of the file), add:

```ts
export const getAllMMKVKeys = (): string[] => {
  try {
    return storage.getAllKeys();
  } catch (error) {
    console.log("Error getting all MMKV keys", error);
    return [];
  }
};
```

(The existing `import { storage } from "./mmkvPersister";` at the top of the file already covers the dependency — no new import needed.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 4: Stage**

```bash
git add lib/storage/mmkv-storage.ts
```

Suggested commit message: `feat(storage): expose getAllMMKVKeys helper for prefix iteration`

---

### Task 3: Create the verifier store

**Files:**
- Create: `features/auth/oauthVerifierStore.ts`

- [ ] **Step 1: Write the file**

Create `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/auth/oauthVerifierStore.ts` with this exact content:

```ts
// features/auth/oauthVerifierStore.ts
//
// Per-flow PKCE codeVerifier storage. Each Microsoft OAuth attempt generates
// a unique flowId (passed to MS as the `state` parameter and round-tripped
// back in the redirect URL). The verifier is stored keyed by that flowId,
// so concurrent flows, stale URL replays, and watchdog timeouts can't
// trample each other.
//
// TTL = 10 minutes (matches Microsoft's authorization code validity window).
// Pruning is lazy: pruneExpired() runs at the start of each new login.

import {
  deleteMMKVItem,
  getAllMMKVKeys,
  getMMKVItem,
  setMMKVItem,
} from "@/lib/storage/mmkv-storage";

const KEY_PREFIX = "oauth_verifier:";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

// Legacy single-slot key from before flow-keyed storage. Pruned on first run
// after upgrade. Value matches what was in MMKV_KEYS.OAUTH_CODE_VERIFIER.
const LEGACY_KEY = "oauthCodeVerifier";

type VerifierEntry = {
  codeVerifier: string;
  createdAt: number;
};

const keyFor = (flowId: string) => `${KEY_PREFIX}${flowId}`;

export function saveVerifier(flowId: string, codeVerifier: string): void {
  const entry: VerifierEntry = { codeVerifier, createdAt: Date.now() };
  setMMKVItem(keyFor(flowId), entry);
}

export function getVerifier(flowId: string): string | null {
  const entry = getMMKVItem<VerifierEntry>(keyFor(flowId));
  return entry?.codeVerifier ?? null;
}

export function deleteVerifier(flowId: string): void {
  deleteMMKVItem(keyFor(flowId));
}

/**
 * Delete verifier entries older than TTL_MS, plus the legacy single-slot key
 * if it's still present (one-time cleanup after upgrade).
 *
 * Called at the start of each startMicrosoftLogin() so the set never grows
 * unbounded. No background timer needed.
 */
export function pruneExpired(): void {
  // Legacy cleanup — always remove this if present.
  deleteMMKVItem(LEGACY_KEY);

  const now = Date.now();
  const allKeys = getAllMMKVKeys();
  for (const key of allKeys) {
    if (!key.startsWith(KEY_PREFIX)) continue;
    const entry = getMMKVItem<VerifierEntry>(key);
    if (!entry || typeof entry.createdAt !== "number") {
      // Malformed entry — delete defensively.
      deleteMMKVItem(key);
      continue;
    }
    if (now - entry.createdAt > TTL_MS) {
      deleteMMKVItem(key);
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 3: Stage**

```bash
git add features/auth/oauthVerifierStore.ts
```

Suggested commit message: `feat(auth): add per-flow OAuth verifier store with TTL pruning`

---

## Phase 2 — Refactor the service to use flow IDs

### Task 4: Refactor authService.ts to use flowId + state + verifier store

**Files:**
- Modify: `features/auth/authService.ts`

**Step 1: Apply the full file replacement.** Use the `Write` tool to overwrite the file with this exact content:

```ts
// features/auth/authService.ts
//
// Centralized Microsoft OAuth lifecycle owner. All OAuth completion logic
// lives here so it doesn't depend on any component being mounted.
//
// Each login attempt generates a unique flowId (UUID), passed to Microsoft
// as the OAuth `state` parameter. The PKCE codeVerifier is keyed by flowId
// in MMKV. When the redirect arrives, we look up the verifier by the
// round-tripped state. Stale URLs (no matching verifier entry) are silently
// ignored. The deep link arrives via both Linking.addEventListener
// (cold-start) and the callback.tsx route (warm-app) — both converge on
// handleCallbackUrl, which is idempotent.

import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import useStore from "@/lib/store";
import { env } from "@/utils/env";
import { captureAuthError, captureAuthMessage } from "@/lib/telemetry";
import { msLogin } from "./auth.apis";
import { hydrateSession } from "./hydrateSession";
import {
  deleteVerifier,
  getVerifier,
  pruneExpired,
  saveVerifier,
} from "./oauthVerifierStore";

const SCOPES = ["api://183431e3-ef34-43eb-8dbe-c4e4b7da7786/read"];
const REDIRECT_PATH = "auth/callback";

// Module-level idempotency state. Cleared by cancelOAuth.
let lastProcessedCode: string | null = null;
let inFlightExchange: Promise<void> | null = null;

const getDiscoveryUrl = () =>
  `https://login.microsoftonline.com/${env.EXPO_PUBLIC_MICROSOFT_TENANT_ID}/v2.0`;

const getRedirectUri = () =>
  AuthSession.makeRedirectUri({ path: REDIRECT_PATH });

/**
 * Entry point invoked by MSAuthButton. Generates a flowId, prunes expired
 * verifier entries, builds the AuthRequest with `state: flowId`, persists
 * the PKCE codeVerifier keyed by flowId, opens the browser, and on warm-app
 * return delegates to handleCallbackUrl.
 *
 * Errors are surfaced via toast at the call site; this throws after telemetry
 * + state cleanup.
 */
export async function startMicrosoftLogin(): Promise<void> {
  const { setOAuthPhase } = useStore.getState();
  let reachedHandleCallback = false;

  try {
    pruneExpired();

    const flowId = Crypto.randomUUID();
    const startedAt = Date.now();
    setOAuthPhase({ phase: "opening_browser", startedAt });

    const discovery = await AuthSession.fetchDiscoveryAsync(getDiscoveryUrl());
    const redirectUri = getRedirectUri();

    const request = new AuthSession.AuthRequest({
      clientId: env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      state: flowId,
      extraParams: { prompt: "select_account" },
    });

    await request.makeAuthUrlAsync(discovery);

    if (!request.codeVerifier) {
      throw new Error("Failed to generate PKCE codeVerifier");
    }

    saveVerifier(flowId, request.codeVerifier);

    setOAuthPhase({ phase: "awaiting_user", startedAt });
    captureAuthMessage("oauth_started");

    const result = await request.promptAsync(discovery);

    if (result.type === "success" && result.params?.code) {
      const callbackUrl =
        result.url ??
        `${redirectUri}?code=${result.params.code}&state=${flowId}`;
      reachedHandleCallback = true;
      await handleCallbackUrl(callbackUrl);
    } else if (result.type === "cancel" || result.type === "dismiss") {
      cancelOAuth();
    } else if (result.type === "error") {
      captureAuthError(
        "ms_token_exchange_failed",
        new Error(result.errorCode ?? "unknown_oauth_error"),
      );
      cancelOAuth();
      reachedHandleCallback = true;
      throw new Error(result.errorCode ?? "OAuth error");
    }
  } catch (error) {
    if (!reachedHandleCallback) {
      captureAuthError("ms_token_exchange_failed", error);
      cancelOAuth();
    }
    throw error;
  }
}

/**
 * Completes OAuth given a redirect URL containing `?code=…&state=…`. Called
 * by both the Linking listener (cold-start path) and the callback.tsx route
 * (warm-app path). Idempotent: same URL twice = single exchange.
 *
 * Silent returns:
 *   - No code in URL → stray deep link, ignore.
 *   - Same code as last processed → already handled, ignore.
 *   - No state in URL → malformed, can't correlate, ignore.
 *   - No verifier entry for this state → stale URL replay, emit info-level
 *     telemetry and ignore (no error UI).
 */
export async function handleCallbackUrl(url: string): Promise<void> {
  if (inFlightExchange) return inFlightExchange;

  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code as string | undefined;
  const state = parsed.queryParams?.state as string | undefined;

  if (!code) return;
  if (code === lastProcessedCode) return;
  if (!state) {
    captureAuthMessage("oauth_stale_url_ignored", { reason: "no_state" });
    return;
  }

  const codeVerifier = getVerifier(state);
  if (!codeVerifier) {
    captureAuthMessage("oauth_stale_url_ignored", {
      reason: "verifier_not_found",
    });
    return;
  }

  inFlightExchange = (async () => {
    try {
      lastProcessedCode = code;
      const { setOAuthPhase, oauthStartedAt } = useStore.getState();
      const startedAt = oauthStartedAt ?? Date.now();

      setOAuthPhase({ phase: "exchanging_code", startedAt });

      const discovery = await AuthSession.fetchDiscoveryAsync(
        getDiscoveryUrl(),
      );
      const redirectUri = getRedirectUri();

      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: codeVerifier },
        },
        discovery,
      );

      if (!tokenResult.accessToken) {
        throw new Error("MS token exchange returned no accessToken");
      }

      setOAuthPhase({ phase: "exchanging_session", startedAt });

      const data = await msLogin(tokenResult.accessToken);
      await hydrateSession(data);

      // Success — clear THIS flow's verifier (others stay until TTL).
      deleteVerifier(state);
      setOAuthPhase({ phase: "idle", startedAt: null });
    } catch (error) {
      // NOTE: we don't delete the verifier here. Keep it so the user (or
      // another fire of the same URL within MS's code window) could retry.
      // The orphan will be pruned on next startMicrosoftLogin.
      captureAuthError("ms_token_exchange_failed", error);
      cancelOAuth();
      throw error;
    } finally {
      inFlightExchange = null;
    }
  })();

  return inFlightExchange;
}

/**
 * Reset OAuth state — called on cancel, error, timeout. Resets UI phase and
 * idempotency state, but does NOT delete verifier entries (those live until
 * TTL or success). Pruning is centralized in startMicrosoftLogin.
 */
export function cancelOAuth(): void {
  const { setOAuthPhase } = useStore.getState();
  setOAuthPhase({ phase: "idle", startedAt: null });
  lastProcessedCode = null;
  inFlightExchange = null;
}
```

**Key changes from the previous version:**
- Imports `Crypto.randomUUID` from `expo-crypto` and the new verifier store.
- Removes the old `MMKV_KEYS.OAUTH_CODE_VERIFIER` import (no longer used; the key is gone in Task 5).
- `startMicrosoftLogin`: calls `pruneExpired()` first, generates flowId, passes `state: flowId` in AuthRequest, calls `saveVerifier(flowId, codeVerifier)`. The success-branch fallback URL includes `&state=${flowId}` so even if `result.url` is missing we can correlate.
- `handleCallbackUrl`: parses `state` from URL, looks up verifier via `getVerifier(state)`, silent-returns with `oauth_stale_url_ignored` telemetry on missing state or missing verifier. Replaces the "throws No codeVerifier" path.
- `handleCallbackUrl` exchange-failure branch: removed the verifier deletion. The verifier stays — only `cancelOAuth()` runs.
- `cancelOAuth`: stripped of verifier deletion. Pure UI/state reset.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

If errors mention `Crypto.randomUUID` not existing, verify `expo-crypto` is installed (`grep "expo-crypto" package.json` should show it). If errors mention `MMKV_KEYS.OAUTH_CODE_VERIFIER` still in use elsewhere, those need migration too — grep before proceeding:

```bash
grep -rn "OAUTH_CODE_VERIFIER" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
```

Expected hits after this task: ONLY `utils/storage-keys.ts` (Task 5 removes it).

- [ ] **Step 3: Stage**

```bash
git add features/auth/authService.ts
```

Suggested commit message: `refactor(auth): key OAuth verifiers by per-flow UUID via state parameter`

---

### Task 5: Remove the now-unused `OAUTH_CODE_VERIFIER` constant

**Files:**
- Modify: `utils/storage-keys.ts`

- [ ] **Step 1: Confirm no remaining usage**

Run:
```bash
grep -rn "OAUTH_CODE_VERIFIER" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
```

Expected: only `utils/storage-keys.ts`. If anything else still references it, STOP and report BLOCKED.

- [ ] **Step 2: Read** `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/utils/storage-keys.ts` to locate the line.

- [ ] **Step 3: Delete the line**

Remove the single line:
```ts
  OAUTH_CODE_VERIFIER: "oauthCodeVerifier",
```

Be careful to preserve commas and indentation of surrounding lines.

(The legacy MMKV value `"oauthCodeVerifier"` is now referenced as a string literal `LEGACY_KEY` inside `oauthVerifierStore.ts` for the one-time cleanup — the constant in `storage-keys.ts` is no longer needed.)

- [ ] **Step 4: Re-grep to confirm zero matches**

```bash
grep -rn "OAUTH_CODE_VERIFIER" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
```

Expected: zero matches.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 6: Stage**

```bash
git add utils/storage-keys.ts
```

Suggested commit message: `chore(storage): remove unused OAUTH_CODE_VERIFIER key (now flow-keyed in verifier store)`

---

## Phase 3 — Verification

### Task 6: Manual acceptance pass

**Files:** none modified — verification only.

Walk through the spec's acceptance checklist on a dev build:

- [ ] **Happy path:** tap MS → complete auth quickly → land on dashboard. No change vs current behavior. Verify in MMKV (via dev tool or logging) that the `oauth_verifier:<flowId>` entry was deleted on success.

- [ ] **Slow MS auth:** tap MS, take >30s in browser (manually slow-walk account selection, simulate MFA delay), complete auth. Today this fails with "No codeVerifier"; after this fix it should succeed. The watchdog will have reset oauthPhase to idle at 30s, but the verifier survives, so the late-arriving callback completes the exchange.

- [ ] **Cancel mid-auth:** tap MS, press back in browser → returns to LoginScreen, no error. The orphan verifier entry stays in MMKV (pruned on next `startMicrosoftLogin` or after 10 min).

- [ ] **Cold-start replay:** complete an MS login successfully, force-kill the app (`adb shell am force-stop com.classify.classedge.dev` or swipe up from app switcher), reopen → app launches normally. If Android replays the OAuth deep link, the warm-app listener (or cold-start handler) fires `handleCallbackUrl`, finds no verifier for that flowId (deleted on previous success), silently returns. **No "No codeVerifier" error in console.**

- [ ] **Multiple cancel-retap cycles:** tap MS, cancel, tap MS again, complete → succeeds. The first flow's verifier is pruned when the second `startMicrosoftLogin` runs `pruneExpired()`.

- [ ] **No noisy console:** during normal use (including cancel and stale-URL paths), the console does NOT show `[OAuth deep-link] handleCallbackUrl failed [Error: No codeVerifier in storage]`. Stale URLs are silently ignored.

- [ ] **Telemetry (with `EXPO_PUBLIC_SENTRY_DSN` set):** verify `oauth_stale_url_ignored` events appear in Sentry on the cold-start-replay scenario. `ms_token_exchange_failed` should NOT fire for stale URLs (only for real exchange failures).

- [ ] **Typecheck clean:** `npx tsc --noEmit; echo "EXIT=$?"` → `EXIT=0`.

- [ ] **No stale references:** `grep -rn "OAUTH_CODE_VERIFIER" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .` returns zero matches in app code.

If any scenario fails, stop and diagnose before declaring the migration done.

---

## Out-of-scope reminder

Per the spec, this PR explicitly does NOT touch:

- The OAuth library choice (stay on expo-auth-session)
- Multi-account or multi-tenant logic
- The watchdog UI behavior (still resets `oauthPhase` to idle at 30s; only behavior change is it no longer wipes the verifier)
- Backend `/auth/microsoft/` contract
- Azure AD configuration (redirect URI unchanged; `state` parameter is automatically round-tripped by MS)
- `MSAuthButton.tsx`, `callback.tsx`, `app/_layout.tsx`, `hydrateSession.ts`, `useTokenRefresh.ts`, `signOut.ts` — all unchanged

If a task above tempts you to touch any of these, stop and ask the user.

---

## Rollback

Single PR — `git revert <merge-commit>` restores the single-slot verifier behavior. Any `oauth_verifier:<flowId>` entries already persisted in user devices become orphans after rollback (the reverted code doesn't read or prune them); they're harmless string blobs that sit until manually cleared. No DB migrations, no server changes, no Azure changes.

## Notes on uncertainty

- **`AuthRequest({ state })`** — expo-auth-session's `AuthRequest` constructor accepts a `state` field directly. If typecheck flags the `state` field as not allowed (unexpected), the alternative is to pass it via `extraParams: { state: flowId, prompt: "select_account" }`. The redirect URL behavior is identical (MS round-trips whatever `state` you pass in the authorization request).
- **`Linking.parse(url).queryParams.state`** — expo-linking returns query params as `Record<string, string | string[] | undefined>`. The cast `as string | undefined` in `handleCallbackUrl` matches existing pattern used for `code`.
- **`Crypto.randomUUID()`** — `expo-crypto ^15` exports `randomUUID(): string`. If this errors with "not exported", fall back to `Crypto.randomUUID` from `expo-crypto/build/Crypto` or use a manual UUID generator (`Date.now() + Math.random().toString(36).slice(2)`).
- **`storage.getAllKeys()`** — `react-native-mmkv` exposes this on the storage instance. If the installed version's typedef differs, check the actual signature in `node_modules/react-native-mmkv/lib/typescript/`.
