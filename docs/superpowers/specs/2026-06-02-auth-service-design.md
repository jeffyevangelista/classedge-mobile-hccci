# Auth Service + Deep-Link Driven OAuth

**Date:** 2026-06-02
**Status:** Design — pending implementation plan

## Goal

Replace the current "passive callback route + LoginScreen-owns-completion" OAuth architecture with a centralized auth service that owns the entire Microsoft OAuth lifecycle. The deep-link callback handler becomes the active completion point. Eliminates fragile mount-state coupling, fixes cold-start failures, and gives users clear feedback during the transition.

## Background

The current flow has a structural fragility:

1. User taps MS button in `MSAuthButton.tsx` → `AuthSession.useAuthRequest` opens the in-app browser
2. MS redirects to `classedge*://auth/callback?code=…`
3. The deep link reaches **both** `promptAsync()` (resolves it) **and** Expo Router (navigates to `app/auth/callback.tsx`)
4. `callback.tsx` renders a passive spinner — it does no work
5. The actual code exchange happens in `MSAuthButton`'s `useEffect`, which only works because **LoginScreen stays mounted underneath the pushed callback route**
6. `useMsLogin` mutation runs, `hydrateSession` writes tokens, `isAuthenticated` flips, root layout swaps to `(main)`

Failure modes today:
- **Cold-start mid-OAuth:** app killed during MS auth → reopened with deep link → `callback.tsx` mounts → no MSAuthButton instance to process the response → user stuck on spinner forever
- **LoginScreen unmount mid-flow:** if anything ever unmounts LoginScreen before `promptAsync` resolves (a router quirk, a navigation refactor), auth silently breaks
- **No timeout / no recovery:** hung backend or dropped network leaves user staring at a spinner indefinitely
- **No error visibility on the callback screen:** if the exchange fails, the toast surfaces on LoginScreen — but the user is looking at the callback spinner
- **Brief visual flash:** every login briefly shows the spinner screen before the layout swap

The root cause: OAuth completion logic is split across two files (`MSAuthButton.tsx` triggers and completes; `callback.tsx` is a load-bearing decoy) with an implicit invariant that one component must stay mounted while the other handles the redirect.

## Success criteria

1. **No silent failures from mount-state changes.** OAuth completion runs to success or explicit failure regardless of which screens are mounted.
2. **Cold-start mid-OAuth recovers.** App killed during MS auth, then relaunched via the deep link, completes the sign-in successfully and lands on the dashboard.
3. **Timeout fallback.** A hung exchange (network drop, backend slow) bails out within 30 seconds with a clear error and route back to LoginScreen, instead of an indefinite spinner.
4. **Phase-aware UI.** The user sees distinct feedback for "opening browser", "exchanging code", "talking to backend" — not one undifferentiated spinner.
5. **Retryable failures.** If the backend hand-off fails, the user can retry without re-doing the full Microsoft browser dance — the OAuth code is still valid (within Microsoft's exchange window).
6. **All OAuth logic lives in one file.** Single source of truth for debugging, telemetry, and future extension (Google/Apple login).

## Non-goals

- **Switching OAuth libraries.** Stay on `expo-auth-session`. MSAL would be overkill for our single-tenant, single-account-per-user use case.
- **Multi-account support.** One MS account per device. Account switching is the existing `hydrateSession` flow (clears prior PowerSync data).
- **Token refresh changes.** `useTokenRefresh.ts` stays as-is. The backend-issued JWT refresh is independent of the MS OAuth flow.
- **Backend changes.** The `/auth/microsoft/` endpoint contract is unchanged.
- **Azure AD config changes.** The redirect URI `classedge*://auth/callback` stays registered exactly as today.
- **Replacing the existing OAuth flow for non-MS providers.** No Google/Apple sign-in in scope. The service is shaped to allow them later but doesn't add them.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ app/_layout.tsx (root)                                       │
│ - On mount: check Linking.getInitialURL() (cold-start case)  │
│ - Register Linking.addEventListener('url', handler)          │
│ - Handler delegates to authService.handleCallbackUrl(url)    │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ features/auth/authService.ts (NEW — the brain)               │
│                                                              │
│ State (in Zustand auth slice):                               │
│   oauthPhase: "idle" | "opening_browser" | "awaiting_user"   │
│                | "exchanging_code" | "exchanging_session"    │
│                                                              │
│ Methods:                                                     │
│   startMicrosoftLogin()                                      │
│     - Builds AuthRequest (PKCE), persists codeVerifier       │
│     - Sets phase: opening_browser → awaiting_user            │
│     - Opens browser via promptAsync                          │
│     - On promptAsync resolve: delegates to handleCallbackUrl │
│       (so both warm-app and cold-start paths converge)       │
│                                                              │
│   handleCallbackUrl(url)                                     │
│     - Parses ?code= from url                                 │
│     - Reads stored codeVerifier                              │
│     - Sets phase: exchanging_code                            │
│     - Exchanges code → MS access token                       │
│     - Sets phase: exchanging_session                         │
│     - Calls /auth/microsoft/ → AuthResponse                  │
│     - Calls hydrateSession(data)                             │
│     - Clears codeVerifier, resets phase to idle              │
│                                                              │
│   cancelOAuth()                                              │
│     - Clears codeVerifier, resets phase to idle              │
│     - Used by timeout / user abort / fatal error             │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Component layer (becomes thin)                               │
│                                                              │
│ MSAuthButton.tsx                                             │
│   - Single onPress: authService.startMicrosoftLogin()        │
│   - isDisabled when oauthPhase !== "idle"                    │
│   - Spinner + phase label when active                        │
│   - NO useAuthRequest, NO useEffect, NO mutation logic       │
│                                                              │
│ app/auth/callback.tsx                                        │
│   - Reads code from useLocalSearchParams                     │
│   - On mount: authService.handleCallbackUrl(<reconstructed>) │
│   - Renders a branded "Signing you in…" screen with the      │
│     active phase from oauthPhase                             │
│   - On error: routes back to /login with error toast         │
└──────────────────────────────────────────────────────────────┘
```

### Why both Linking listener AND callback.tsx?

The Linking listener catches the URL when the app is launched cold via the deep link (where there's no React tree yet to render `callback.tsx`). The callback.tsx route catches the URL in the warm-app case (where the in-app browser closes and the OS routes the deep link through Expo Router).

Both paths converge on `authService.handleCallbackUrl(url)`, which is idempotent — a duplicate call (e.g., listener fires AND callback.tsx mounts) is a no-op because the code is already being processed or has been processed.

### State storage

| State | Storage | Why |
|---|---|---|
| `oauthPhase` | Zustand (in-memory) | UI reactivity; resets on app launch |
| `codeVerifier` | MMKV | Must survive app kill for cold-start recovery; short-lived; not sensitive enough to need SecureStore (a captured verifier without the session is useless) |
| `oauthStartedAt` (for timeout) | Zustand | Set when `startMicrosoftLogin` runs; checked in timeout watchdog |

### Idempotency contract

`handleCallbackUrl(url)` MUST be safe to call multiple times with the same URL:
1. Extract code from URL
2. If `oauthPhase === "exchanging_code"` or `"exchanging_session"` → no-op (already in flight)
3. If the same code was already processed (track last-processed-code in module scope) → no-op
4. Otherwise proceed

This handles the warm-app case where the listener and callback.tsx both fire with the same URL.

### Timeout watchdog

A 30-second timer starts when `oauthPhase` leaves `"idle"`. If still non-idle at 30s, `cancelOAuth()` fires + toast: "Sign-in is taking longer than expected. Please try again." Route back to LoginScreen if currently on callback.tsx.

Implemented as a `useEffect` in the root layout (or a dedicated watcher hook) that watches `oauthPhase` + `oauthStartedAt`.

### Cold-start recovery flow

1. User opens MS browser, completes auth, OS sends `classedge.dev://auth/callback?code=…` while app is killed
2. OS launches the app with the URL as initial intent
3. `app/_layout.tsx` mounts → calls `Linking.getInitialURL()` → gets the URL
4. Calls `authService.handleCallbackUrl(url)`
5. Service reads stored `codeVerifier` from MMKV, performs exchange, calls backend
6. `hydrateSession` writes tokens → `isAuthenticated` flips → routes to `(main)`
7. User lands on dashboard without ever seeing LoginScreen on this launch

### Warm-app flow (most common)

1. User taps MS on LoginScreen → `authService.startMicrosoftLogin()`
2. Service stores `codeVerifier` in MMKV, sets `oauthPhase = "opening_browser"`
3. Browser opens, user authenticates
4. MS redirects → in-app browser closes → `promptAsync` resolves AND deep link propagates to Expo Router
5. Two convergent paths fire `handleCallbackUrl`:
   - The resolve handler in `startMicrosoftLogin` (from `promptAsync` result)
   - The callback.tsx route mounting and calling it
6. Idempotency guard ensures only the first one actually exchanges
7. Service exchanges code, calls backend, calls `hydrateSession`, resets phase to idle
8. Route swap to `(main)`

### Failure flows

| Failure | Today | After |
|---|---|---|
| User cancels MS browser | `promptAsync` resolves with non-success, `authInProgress` resets | Service detects cancel, sets `oauthPhase = "idle"`, deletes verifier |
| Code exchange fails (network) | toast on LoginScreen, retry full flow | Service surfaces error, callback.tsx shows "Sign-in failed" with Retry button — retry just calls `handleCallbackUrl` again with the cached code |
| Backend `/auth/microsoft/` returns 5xx | toast on LoginScreen, retry full flow | Same as above — retry without re-doing browser |
| Backend returns 4xx (e.g., user not provisioned) | toast on LoginScreen | callback.tsx shows specific error from backend, single button: "Back to sign in" |
| Hung exchange (>30s) | Indefinite spinner | Timeout watchdog cancels, toast, route back to LoginScreen |
| Cold-start with stale verifier (code expired) | N/A — feature didn't exist | Exchange fails with "invalid_grant", same retry path as above |

## File-level changes

### New files

- `features/auth/authService.ts` — the service module (functions + module state)
- `features/auth/oauth.types.ts` — shared types (OAuthPhase, etc.)

### Modified files

- `lib/store.ts` — auth slice gains `oauthPhase` field + setter
- `features/auth/auth.slice.ts` — add `oauthPhase` field
- `features/auth/components/MSAuthButton.tsx` — gut it: single onPress + phase-aware label/spinner
- `app/auth/callback.tsx` — becomes the active handler (currently passive)
- `app/_layout.tsx` — register `Linking.addEventListener` + check `getInitialURL` on mount; add timeout watchdog
- `features/auth/auth.hooks.ts` — `useMsLogin` mutation may become an internal service helper instead of an exported hook (TBD during plan)
- `utils/storage-keys.ts` — add `OAUTH_CODE_VERIFIER` key

### Unchanged

- `features/auth/hydrateSession.ts` — still the central session writer
- `features/auth/useTokenRefresh.ts` — refresh flow independent of OAuth
- `features/auth/signOut.ts` — unchanged
- `lib/telemetry.ts` — existing auth events still fire; may add `oauth_phase_timeout` event
- Azure AD config — redirect URI string unchanged

## Telemetry additions

Extend the existing `TelemetryEvent` union with:
- `oauth_started` — when `startMicrosoftLogin` runs (extras: trigger source)
- `oauth_phase_timeout` — when watchdog cancels (extras: phase at timeout, elapsedMs)
- `oauth_cold_start_recovery` — when `getInitialURL` returns an `auth/callback` URL (extras: elapsedMs from app launch to handler)

Plus existing `ms_token_exchange_failed` retained.

## Migration & rollout

Single-PR big-bang migration, same pattern as the skeleton-first PR. Rollback = `git revert <merge-commit>`.

Backward compatibility considerations:
- The `useMsLogin` exported hook signature may change; verify no other call sites use it before removing.
- The Azure AD redirect URI doesn't change — no coordinated backend or Azure deploy needed.
- The MMKV `OAUTH_CODE_VERIFIER` key is new; old installs won't have it (fine — only relevant during an active flow).

## Acceptance checklist

Manual (no automated test infra):

- [ ] Fresh MS login: tap → browser → auth → branded "Signing you in…" screen with phase label → dashboard. No "Unmatched Route" error.
- [ ] Cold-start mid-OAuth: tap MS, force-kill the app while browser is open, complete auth in browser → app relaunches → directly lands on dashboard without showing LoginScreen.
- [ ] Cancel mid-flow: tap MS, cancel browser → returns to LoginScreen with phase reset to idle (MSAuthButton tappable again).
- [ ] Network drop during exchange: simulate offline after MS browser closes → callback screen shows error + Retry button → reconnect → tap Retry → completes.
- [ ] Timeout: simulate backend hang (>30s) → callback screen shows timeout error → route back to LoginScreen.
- [ ] Backend 4xx (user not provisioned): backend returns 403 → callback screen shows backend message → "Back to sign in" button.
- [ ] Telemetry events fire in Sentry (with DSN configured): `oauth_started`, `oauth_phase_timeout` on hung backend test, `oauth_cold_start_recovery` on cold-start test.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] Grep for `useAuthRequest` returns zero matches in app code (only in node_modules).

## Open questions noted for review

1. **codeVerifier in MMKV vs SecureStore.** Chose MMKV. Verifier is short-lived (~5 min OAuth code window), useless without the matching session, and SecureStore would add overhead to a hot path. If you'd rather be conservative, swap to SecureStore — only changes which storage helper the service uses.

2. **Timeout duration.** Chose 30s. Could be 15s (more aggressive) or 60s (more tolerant for slow networks). Easy to tune.

3. **callback.tsx visual.** Chose "branded screen with phase label" for clarity (user sees what's happening). Alternative: render `null` and let LoginScreen show through (smoother but offers no feedback). My pick prioritizes UX clarity over visual seamlessness.

4. **`useMsLogin` hook.** May become an internal service implementation detail rather than an exported hook. Need to confirm no other call sites depend on it (a grep at plan-writing time).
