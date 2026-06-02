# Auth Service + Deep-Link Driven OAuth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LoginScreen-coupled OAuth flow with a centralized `authService` that owns the entire Microsoft OAuth lifecycle. Eliminates fragile mount-state coupling, fixes cold-start failures, adds timeout + retry, and gives users phase-aware feedback.

**Architecture:** New `features/auth/authService.ts` owns OAuth state via a Zustand `oauthPhase` field. PKCE `codeVerifier` is persisted to MMKV so it survives app kill. The deep link arrives via both `Linking.addEventListener` (cold-start) and `callback.tsx` (warm-app) — both converge on an idempotent `handleCallbackUrl(url)`. MSAuthButton becomes a thin trigger; callback.tsx becomes the active handler with branded "Signing you in…" UI.

**Tech Stack:** expo-auth-session (AuthRequest class, not hook), expo-linking, Zustand, MMKV. No automated test infra — verification per task is `npx tsc --noEmit` + manual dev-build smoke test.

**Source documents:**
- Spec: `docs/superpowers/specs/2026-06-02-auth-service-design.md`
- Existing OAuth code (to be modified/replaced): `features/auth/components/MSAuthButton.tsx`, `app/auth/callback.tsx`, `features/auth/auth.hooks.ts` (`useMsLogin`)
- Existing telemetry: `lib/telemetry.ts`

**Commit policy:** Standing user preference is no auto-commit. Each task ends with a suggested commit message. The implementer should stage the files and either commit or batch with adjacent tasks at their discretion.

---

## Phase 1 — Foundation (no behavior change)

### Task 1: Add OAUTH_CODE_VERIFIER storage key

**Files:**
- Modify: `utils/storage-keys.ts`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/utils/storage-keys.ts
```

The file exports a `MMKV_KEYS` object. Add a new key for the OAuth PKCE code verifier.

- [ ] **Step 2: Add the new key**

Add a line `OAUTH_CODE_VERIFIER: "oauth_code_verifier",` to the `MMKV_KEYS` object. Place it alphabetically or next to other auth-related keys (e.g., near `ACCESS_TOKEN`, `REFRESH_TOKEN`, etc.).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`
Expected: `EXIT=0`.

- [ ] **Step 4: Stage**

```bash
git add utils/storage-keys.ts
```

Suggested commit message: `feat(auth): add OAUTH_CODE_VERIFIER storage key for OAuth PKCE persistence`

---

### Task 2: Extend telemetry with OAuth phase events

**Files:**
- Modify: `lib/telemetry.ts`

- [ ] **Step 1: Read the current file** to locate the `TelemetryEvent` union.

- [ ] **Step 2: Add three new event names to the union**

Find this block in `lib/telemetry.ts`:

```ts
export type TelemetryEvent =
  // auth flow
  | "ms_token_exchange_failed"
  | "silent_refresh_failed"
  | "forced_logout"
  | "account_switch_detected"
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

Suggested commit message: `feat(telemetry): add oauth lifecycle event types`

---

### Task 3: Add OAuth phase state to auth slice

**Files:**
- Modify: `features/auth/auth.slice.ts`

- [ ] **Step 1: Read the current file** to confirm structure (it exports `createAuthSlice` with `AuthState`, `AuthAction`, `initialState`).

- [ ] **Step 2: Extend `AuthState` type**

Find the `type AuthState = { ... }` block. Add two fields at the end (before the closing `};`):

```ts
  oauthPhase: OAuthPhase;
  oauthStartedAt: number | null;
```

- [ ] **Step 3: Extend `AuthAction` type**

Find the `type AuthAction = { ... }` block. Add at the end (before the closing `};`):

```ts
  setOAuthPhase: (next: { phase: OAuthPhase; startedAt: number | null }) => void;
```

- [ ] **Step 4: Add the `OAuthPhase` type at the top of the file**

Just after the existing imports, add:

```ts
export type OAuthPhase =
  | "idle"
  | "opening_browser"
  | "awaiting_user"
  | "exchanging_code"
  | "exchanging_session";
```

- [ ] **Step 5: Add fields to `initialState`**

Find the `const initialState: AuthState = { ... }` block. Add two fields at the end (before the closing `};`):

```ts
  oauthPhase: "idle",
  oauthStartedAt: null,
```

- [ ] **Step 6: Add the action implementation**

Inside the `createAuthSlice` function body (the object returned to the StateCreator), add this action after the existing `setLegalUpdateRequired` (or wherever the implementations are listed):

```ts
  setOAuthPhase: ({ phase, startedAt }) => {
    set({ oauthPhase: phase, oauthStartedAt: startedAt });
  },
```

- [ ] **Step 7: Reset OAuth state in `clearCredentials`**

Find the `clearCredentials` method. The current implementation calls `set(() => ({ ...initialState }))`. Since `initialState` now includes `oauthPhase: "idle"` and `oauthStartedAt: null`, the existing line already resets them — no change needed. Verify by reading the method.

- [ ] **Step 8: Reset OAuth state in `restoreSession`**

Find the `restoreSession` method. The current `set(...)` call only sets auth-token-related fields. OAuth state should default to idle on cold start. Find the final `set({ ... })` in the success path and add at the end of the object:

```ts
        oauthPhase: "idle",
        oauthStartedAt: null,
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 10: Stage**

```bash
git add features/auth/auth.slice.ts
```

Suggested commit message: `feat(auth): add OAuthPhase state and setOAuthPhase action to auth slice`

---

## Phase 2 — Service

### Task 4: Create the auth service

**Files:**
- Create: `features/auth/authService.ts`

- [ ] **Step 1: Write the service file**

Create `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/auth/authService.ts` with this exact content:

```ts
// features/auth/authService.ts
//
// Centralized Microsoft OAuth lifecycle owner. All OAuth completion logic
// lives here so it doesn't depend on any component being mounted. The deep
// link arrives via both Linking.addEventListener (cold-start) and the
// callback.tsx route (warm-app) — both converge on handleCallbackUrl, which
// is idempotent.

import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import useStore from "@/lib/store";
import { env } from "@/utils/env";
import { MMKV_KEYS } from "@/utils/storage-keys";
import {
  deleteMMKVItem,
  getMMKVItem,
  setMMKVItem,
} from "@/lib/storage/mmkv-storage";
import { captureAuthError, captureAuthMessage } from "@/lib/telemetry";
import { msLogin } from "./auth.apis";
import { hydrateSession } from "./hydrateSession";

const SCOPES = ["api://183431e3-ef34-43eb-8dbe-c4e4b7da7786/read"];
const REDIRECT_PATH = "auth/callback";

// Module-level idempotency state. Cleared by cancelOAuth / on success.
let lastProcessedCode: string | null = null;
let inFlightExchange: Promise<void> | null = null;

const getDiscoveryUrl = () =>
  `https://login.microsoftonline.com/${env.EXPO_PUBLIC_MICROSOFT_TENANT_ID}/v2.0`;

const getRedirectUri = () =>
  AuthSession.makeRedirectUri({ path: REDIRECT_PATH });

/**
 * Entry point invoked by MSAuthButton. Builds the AuthRequest, persists the
 * PKCE codeVerifier to MMKV (so it survives app kill), opens the browser,
 * and on warm-app return delegates to handleCallbackUrl.
 *
 * Errors are surfaced via toast at the call site; this throws after telemetry
 * + state cleanup.
 */
export async function startMicrosoftLogin(): Promise<void> {
  const { setOAuthPhase } = useStore.getState();

  try {
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
      extraParams: { prompt: "select_account" },
    });

    // makeAuthUrlAsync generates the codeVerifier as a side effect.
    await request.makeAuthUrlAsync(discovery);

    if (!request.codeVerifier) {
      throw new Error("Failed to generate PKCE codeVerifier");
    }

    setMMKVItem(MMKV_KEYS.OAUTH_CODE_VERIFIER, request.codeVerifier);

    setOAuthPhase({ phase: "awaiting_user", startedAt });
    captureAuthMessage("oauth_started");

    const result = await request.promptAsync(discovery);

    if (result.type === "success" && result.params?.code) {
      // Warm-app path: pass the URL to the same handler the deep-link
      // listener uses. handleCallbackUrl is idempotent — if callback.tsx
      // also mounts and fires this, the second call is a no-op.
      const callbackUrl =
        result.url ?? `${redirectUri}?code=${result.params.code}`;
      await handleCallbackUrl(callbackUrl);
    } else if (result.type === "cancel" || result.type === "dismiss") {
      cancelOAuth();
    } else if (result.type === "error") {
      captureAuthError(
        "ms_token_exchange_failed",
        new Error(result.errorCode ?? "unknown_oauth_error"),
      );
      cancelOAuth();
      throw new Error(result.errorCode ?? "OAuth error");
    }
  } catch (error) {
    captureAuthError("ms_token_exchange_failed", error);
    cancelOAuth();
    throw error;
  }
}

/**
 * Completes OAuth given a redirect URL containing `?code=…`. Called by both
 * the Linking listener (cold-start path) and the callback.tsx route
 * (warm-app path). Idempotent: same URL twice = single exchange.
 */
export async function handleCallbackUrl(url: string): Promise<void> {
  if (inFlightExchange) return inFlightExchange;

  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code as string | undefined;

  if (!code) {
    cancelOAuth();
    return;
  }

  if (code === lastProcessedCode) return;

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
      const codeVerifier = getMMKVItem<string>(MMKV_KEYS.OAUTH_CODE_VERIFIER);

      if (!codeVerifier) {
        throw new Error(
          "No codeVerifier in storage; cannot complete OAuth exchange",
        );
      }

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

      // Success — clear state.
      deleteMMKVItem(MMKV_KEYS.OAUTH_CODE_VERIFIER);
      setOAuthPhase({ phase: "idle", startedAt: null });
    } catch (error) {
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
 * Reset OAuth state — called on cancel, error, timeout. Safe to call when
 * already idle. Clears persisted codeVerifier so a fresh login starts clean.
 */
export function cancelOAuth(): void {
  const { setOAuthPhase } = useStore.getState();
  deleteMMKVItem(MMKV_KEYS.OAUTH_CODE_VERIFIER);
  setOAuthPhase({ phase: "idle", startedAt: null });
  lastProcessedCode = null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

If errors mention missing `setOAuthPhase` on the store, Task 3 wasn't applied correctly — revisit. If errors mention `AuthRequest` or `fetchDiscoveryAsync` not existing on `AuthSession`, this is unexpected and worth investigating before proceeding (these are standard expo-auth-session exports).

- [ ] **Step 3: Stage**

```bash
git add features/auth/authService.ts
```

Suggested commit message: `feat(auth): add authService owning Microsoft OAuth lifecycle`

---

## Phase 3 — UI rewiring

### Task 5: Rewrite MSAuthButton as a thin trigger

**Files:**
- Modify: `features/auth/components/MSAuthButton.tsx`

- [ ] **Step 1: Read the current file** to confirm what's being replaced.

- [ ] **Step 2: Replace the entire file contents**

Replace `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/auth/components/MSAuthButton.tsx` with:

```tsx
import MsLogo from "@/assets/ms-logo.svg";
import { Button, Spinner, useThemeColor, useToast } from "heroui-native";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { startMicrosoftLogin } from "../authService";

const MSAuthButton = () => {
  const { toast } = useToast();
  const oauthPhase = useStore((s) => s.oauthPhase);
  const themeColorAccentForeground = useThemeColor("accent-foreground");

  const isInFlight = oauthPhase !== "idle";

  const handleSignIn = async () => {
    if (isInFlight) return;
    try {
      await startMicrosoftLogin();
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Sign-in failed",
        description: getApiErrorMessage(error),
      });
    }
  };

  return (
    <Button
      className="w-full"
      variant="primary"
      size="lg"
      onPress={handleSignIn}
      isDisabled={isInFlight}
    >
      {isInFlight ? (
        <Spinner color={themeColorAccentForeground} />
      ) : (
        <>
          <MsLogo width={24} height={24} />
          <Button.Label>Continue with Microsoft</Button.Label>
        </>
      )}
    </Button>
  );
};

export default MSAuthButton;
```

Key changes from the prior implementation:
- No more `useAuthRequest`, `useEffect`, `processedCodeRef`, or `useMsLogin` here. All gone.
- `oauthPhase` from the store drives the disabled/spinner state.
- The button delegates entirely to `startMicrosoftLogin()`.
- Errors thrown by the service are caught here and surfaced as toast.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 4: Stage**

```bash
git add features/auth/components/MSAuthButton.tsx
```

Suggested commit message: `refactor(auth): gut MSAuthButton to thin trigger delegating to authService`

---

### Task 6: Rewrite callback.tsx as the active handler

**Files:**
- Modify: `app/auth/callback.tsx`

- [ ] **Step 1: Replace the entire file contents**

Replace `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/auth/callback.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { router, useLocalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import useStore from "@/lib/store";
import { cancelOAuth, handleCallbackUrl } from "@/features/auth/authService";
import { getApiErrorMessage } from "@/lib/api-error";

const phaseLabel: Record<string, string> = {
  idle: "Almost done…",
  opening_browser: "Opening Microsoft…",
  awaiting_user: "Waiting for Microsoft…",
  exchanging_code: "Verifying your account…",
  exchanging_session: "Signing you in…",
};

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string }>();
  const oauthPhase = useStore((s) => s.oauthPhase);
  const surfaceColor = useThemeColor("surface");
  const accentColor = useThemeColor("accent");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.code) return;

    // Reconstruct a URL the service can parse. We only need the query string;
    // the scheme is irrelevant for Linking.parse on a relative URL — but we
    // include it to match the deep-link format.
    const url = `classedge://auth/callback?code=${encodeURIComponent(
      params.code,
    )}`;

    handleCallbackUrl(url).catch((err) => {
      setError(getApiErrorMessage(err));
    });
  }, [params.code]);

  const handleBackToLogin = () => {
    cancelOAuth();
    setError(null);
    router.replace("/login");
  };

  const handleRetry = () => {
    if (!params.code) {
      handleBackToLogin();
      return;
    }
    setError(null);
    const url = `classedge://auth/callback?code=${encodeURIComponent(
      params.code,
    )}`;
    handleCallbackUrl(url).catch((err) => {
      setError(getApiErrorMessage(err));
    });
  };

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: surfaceColor,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          gap: 16,
        }}
      >
        <AppText weight="semibold" className="text-lg text-center">
          Sign-in failed
        </AppText>
        <AppText className="text-sm text-center text-muted">{error}</AppText>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Button variant="secondary" onPress={handleBackToLogin}>
            <Button.Label>Back to sign in</Button.Label>
          </Button>
          <Button variant="primary" onPress={handleRetry}>
            <Button.Label>Retry</Button.Label>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: surfaceColor,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
      }}
    >
      <Spinner color={accentColor} />
      <AppText weight="semibold" className="text-base">
        {phaseLabel[oauthPhase] ?? "Signing you in…"}
      </AppText>
    </View>
  );
}
```

Key behaviors:
- On mount, reads `?code=` from the URL params and calls `handleCallbackUrl`. The service's idempotency guard handles the case where the warm-app path already fired the same handler.
- Renders a phase-aware "Signing you in…" screen using the store's `oauthPhase`.
- On error: shows error message + Back/Retry buttons. Retry calls `handleCallbackUrl` again with the same code (still valid within Microsoft's window).
- When `hydrateSession` flips `isAuthenticated`, the root layout's Stack.Protected unmounts this whole screen and mounts `(main)`. No explicit navigation needed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 3: Stage**

```bash
git add app/auth/callback.tsx
```

Suggested commit message: `refactor(auth): callback.tsx becomes active OAuth handler with phase UI and retry`

---

### Task 7: Add Linking listener + initial URL + timeout watchdog in app/_layout.tsx

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Read the current file** at `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/_layout.tsx` to confirm structure.

- [ ] **Step 2: Add imports**

Near the top of the file (with the other imports), add:

```tsx
import * as Linking from "expo-linking";
import {
  cancelOAuth,
  handleCallbackUrl,
} from "@/features/auth/authService";
import { captureAuthMessage } from "@/lib/telemetry";
```

- [ ] **Step 3: Pull oauth state from store**

Find the existing destructure:

```tsx
  const { restoreSession, clearCredentials, isAuthenticated, authUser } =
    useStore();
```

Replace with:

```tsx
  const { restoreSession, clearCredentials, isAuthenticated, authUser } =
    useStore();
  const oauthPhase = useStore((s) => s.oauthPhase);
  const oauthStartedAt = useStore((s) => s.oauthStartedAt);
```

- [ ] **Step 4: Add the deep-link handler effects**

Find this existing block:

```tsx
  useEffect(() => {
    if (isAuthenticated) armPostLoginReady();
  }, [isAuthenticated]);
```

Immediately AFTER it, add three new effects:

```tsx
  // Cold-start: app launched via deep link (classedge://auth/callback?code=…)
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      if (url.includes("auth/callback") && url.includes("code=")) {
        const startedAt = Date.now();
        captureAuthMessage("oauth_cold_start_recovery", {
          elapsedFromLaunchMs: 0,
          startedAt,
        });
        handleCallbackUrl(url).catch((err) => {
          console.warn("[OAuth cold-start] handleCallbackUrl failed", err);
        });
      }
    });
  }, []);

  // Warm-app: deep link arrives while app is running
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (!url) return;
      if (url.includes("auth/callback") && url.includes("code=")) {
        handleCallbackUrl(url).catch((err) => {
          console.warn("[OAuth deep-link] handleCallbackUrl failed", err);
        });
      }
    });
    return () => subscription.remove();
  }, []);

  // Timeout watchdog: cancel OAuth if a phase persists past 30s
  useEffect(() => {
    if (oauthPhase === "idle" || !oauthStartedAt) return;
    const elapsed = Date.now() - oauthStartedAt;
    const remaining = 30_000 - elapsed;
    if (remaining <= 0) {
      captureAuthMessage("oauth_phase_timeout", {
        phase: oauthPhase,
        elapsedMs: elapsed,
      });
      cancelOAuth();
      return;
    }
    const timer = setTimeout(() => {
      captureAuthMessage("oauth_phase_timeout", {
        phase: oauthPhase,
        elapsedMs: 30_000,
      });
      cancelOAuth();
    }, remaining);
    return () => clearTimeout(timer);
  }, [oauthPhase, oauthStartedAt]);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 6: Stage**

```bash
git add app/_layout.tsx
```

Suggested commit message: `feat(auth): wire deep-link listener, cold-start recovery, and OAuth timeout watchdog`

---

## Phase 4 — Cleanup

### Task 8: Remove or shrink useMsLogin

**Files:**
- Modify: `features/auth/auth.hooks.ts` (possibly delete `useMsLogin`)
- Check: any other callers of `useMsLogin`

- [ ] **Step 1: Grep for callers**

Run:
```bash
grep -rn "useMsLogin" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .
```

Expected callers BEFORE this task:
- `features/auth/auth.hooks.ts` (the definition)
- `features/auth/components/MSAuthButton.tsx` (the old caller — should now be GONE after Task 5)

Any other matches → STOP. Those need migration first or the hook must stay.

- [ ] **Step 2: Remove `useMsLogin` from `features/auth/auth.hooks.ts`**

If grep confirms no remaining callers, delete the entire `export const useMsLogin = () => { ... }` block.

Also remove the now-unused imports if any (e.g., `msLogin` from `./auth.apis`, but check whether it's used elsewhere first — `authService.ts` imports it).

- [ ] **Step 3: Re-grep to confirm zero callers**

```bash
grep -rn "useMsLogin" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .
```

Expected: zero matches.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit; echo "EXIT=$?"`. Expected: `EXIT=0`.

- [ ] **Step 5: Stage**

```bash
git add features/auth/auth.hooks.ts
```

Suggested commit message: `chore(auth): remove unused useMsLogin hook (logic now in authService)`

---

## Phase 5 — Verification

### Task 9: Manual acceptance pass

**Files:** none modified — verification only.

Walk through the spec's acceptance checklist on a dev build. Run each scenario manually and note pass/fail:

- [ ] **Happy path:** Fresh MS login → tap → browser → auth → branded "Signing you in…" screen with phase label → dashboard. No "Unmatched Route" error.

- [ ] **Cold-start mid-OAuth:** tap MS, force-kill the app while the browser is open (swipe up from app switcher, or `adb shell am force-stop com.classify.classedge.dev`), complete auth in browser. Tap the redirect in the system browser if needed. App relaunches → directly lands on dashboard without showing LoginScreen first.

- [ ] **Cancel mid-flow:** tap MS → close the browser without completing → app returns to LoginScreen with the button re-enabled (oauthPhase reset to idle).

- [ ] **Network drop during exchange:** tap MS → complete auth in browser → quickly enable airplane mode before the in-app browser closes → callback screen shows error + Retry button → disable airplane mode → tap Retry → completes.

- [ ] **Timeout:** simulate backend hang (point `EXPO_PUBLIC_API_URL` to a sinkhole, OR add a temporary `await new Promise(r => setTimeout(r, 60000))` in `msLogin`) → wait 30s → callback screen shows timeout error → tap Back to sign in → returns to LoginScreen.

- [ ] **Backend 4xx:** make the backend return 403 for `/auth/microsoft/` (or use a user not provisioned in the system) → callback screen shows backend error message → Back to sign in.

- [ ] **Telemetry (only if `EXPO_PUBLIC_SENTRY_DSN` is set):** verify these events appear in Sentry: `oauth_started`, `oauth_phase_timeout` (during the timeout test), `oauth_cold_start_recovery` (during the cold-start test).

- [ ] **Typecheck clean:** `npx tsc --noEmit; echo "EXIT=$?"` → `EXIT=0`.

- [ ] **No stale references:** `grep -rn "useMsLogin\|useAuthRequest" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .` returns zero matches in app code.

If any scenario fails, stop and diagnose before declaring the migration done.

---

## Out-of-scope reminder

Per the spec, this PR explicitly does NOT touch:

- Switching to MSAL or another OAuth library
- Multi-account support
- Token refresh logic (`useTokenRefresh.ts`)
- `signOut.ts` / `hydrateSession.ts`
- Backend `/auth/microsoft/` contract
- Azure AD configuration (redirect URI stays as today)
- Sentry source map upload

If a task above tempts you to touch any of these, stop and ask the user.

---

## Rollback

Single PR — `git revert <merge-commit>` restores `MSAuthButton.tsx`, `callback.tsx`, `app/_layout.tsx`, `auth.slice.ts`, the deleted `useMsLogin` hook, the storage key, and the telemetry event additions. No DB migrations, no server changes, no Azure changes — purely client-side. No feature flag needed.

## Notes on uncertainty

- `AuthSession.AuthRequest` and `AuthSession.fetchDiscoveryAsync` are standard expo-auth-session exports, but the exact behavior of `request.makeAuthUrlAsync(discovery)` populating `request.codeVerifier` is worth verifying at Task 4 implementation time. If the verifier is generated lazily inside `promptAsync` instead, the service needs to capture it from `request.codeVerifier` immediately after `promptAsync` returns OR use a different code path (e.g., `loadAsync` instead of `makeAuthUrlAsync`).
- The Linking listener fires for ANY URL matching the app's schemes. The `url.includes("auth/callback")` guard is broad on purpose — if you later add other deep links (e.g., `classedge://event/123`), the listener naturally ignores them.
- `useLocalSearchParams` returns string values from query params in Expo Router; the `?code=…` extraction in callback.tsx should work without further parsing.
