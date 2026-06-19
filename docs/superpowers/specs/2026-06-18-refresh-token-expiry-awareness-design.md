# Refresh-token expiry awareness — design

**Date:** 2026-06-18
**Status:** Approved
**Priority:** High (most likely real-user data-loss path)

## Problem

The app is offline-first. A teacher on a multi-week field trip, a student
on a long commute without service, a user in a low-connectivity dorm — any
of them can be using the app for days at a time with the device fully
offline. While offline:

- `silentRefresh()` correctly short-circuits when there is no network
  (`features/auth/useTokenRefresh.ts:44`), so the refresh token sitting in
  Keychain is never rotated.
- The backend's refresh token has a fixed wall-clock TTL of **30 days**
  (`classedge-mobile-test/lms/settings.py:420`) and is **single-use**
  (`ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`).
- The client tracks `expiresAt` only for the **access token** (15-minute
  lifetime, `features/auth/auth.slice.ts:87`). The refresh token's own
  expiry is never decoded, persisted, or surfaced.

When the user returns online with a refresh token that crossed its
30-day TTL while offline, the next `silentRefresh` call returns 401, the
captive-portal guard fires forced logout
(`useTokenRefresh.ts:106-112`), `recordForcedLogout` snapshots the
unsynced CRUD count, `signOut` clears PowerSync, and the user sees the
"Session Expired" dialog on the next LoginScreen mount with *N* unsynced
changes that **cannot be recovered**.

The user had no warning. The data they entered while offline is lost.
This is the single most likely data-loss path in the current auth
design.

## Constraints

- **Refresh tokens are JWTs.** The backend signs them with RS256
  (`lms/settings.py:425`) and exposes an `exp` claim. The client already
  uses `jwt-decode` to read access-token claims (`auth.slice.ts:74`); the
  same library can decode refresh tokens without any new dependency.
- **No backend changes required.** The `exp` claim is already present in
  every refresh token issued by `PowerSyncTokenRefreshView` and the login
  endpoints.
- **MMKV is fine for the expiry timestamp.** It is not a secret — knowing
  *when* a token expires is harmless. The refresh token itself stays in
  Keychain via `expo-secure-store`.
- **The warning must reach the user while they are still online or
  recently online.** Once they are offline past the warning threshold,
  there is no longer anything the app can do to save the session — the
  warning is the entire deliverable.
- **No new dependencies.** Use existing libraries (`jwt-decode`,
  `react-native-mmkv`, `heroui-native` Dialog/Banner).
- **Respect the user's preference for terse UX.** A non-blocking inline
  banner on home/landing screens is preferred over a modal that
  interrupts work, except in the final 24 hours where a one-time modal
  on app foreground is acceptable.

## Decisions

1. **Persist `refreshExpiresAt` in MMKV** alongside the existing
   `expiresAt`. Decoded from the refresh token's `exp` claim at the
   moment the token is written via `setRefreshToken`.
2. **Restore `refreshExpiresAt` on app launch** in `restoreSession`,
   identical to how `expiresAt` is restored today.
3. **Compute `daysUntilRefreshExpiry`** as a derived selector on top of
   the store. Used by both UI and headless callers.
4. **Three thresholds, three UX layers:**
   - **> 7 days remaining:** silent. No UI surface.
   - **≤ 7 days and > 1 day remaining:** non-blocking inline banner
     visible on tab screens (`(tabs)` layout), wording adapts to days
     left ("Your offline session expires in 5 days — connect to keep
     working offline.").
   - **≤ 1 day remaining:** one-shot per-day modal on app foreground.
     Dismissible. Stronger wording ("Your session expires today —
     reconnect now or your unsynced changes may be lost.").
4. **Online users see nothing.** The banner and modal only render when
   `isConnected && isInternetReachable` are **false**, or when a
   `silentRefresh` attempt has been failing for > 1 hour despite being
   online. The whole point is to warn users who cannot refresh.
5. **Modal one-shot per calendar day** is tracked by an MMKV key
   `lastRefreshExpiryWarningShown` storing an ISO date string. Reset on
   successful refresh.
6. **Telemetry hooks** via `captureAuthMessage` for "shown_banner",
   "shown_modal", "user_dismissed_modal" to measure whether the warning
   actually changes behavior.

## Architecture summary

| Layer | File | Responsibility |
|---|---|---|
| Token store | `features/auth/auth.slice.ts` | Decode `exp` from refresh token, persist `refreshExpiresAt` to MMKV, restore it in `restoreSession`, clear it in `clearCredentials` |
| Storage keys | `utils/storage-keys.ts` | Add `REFRESH_EXPIRES_AT` and `LAST_REFRESH_EXPIRY_WARNING_SHOWN` |
| Selector | `features/auth/refreshExpiry.ts` (new) | Derive `daysUntilRefreshExpiry` and the threshold state (`safe \| warn \| critical \| expired`) |
| Banner UI | `features/auth/components/RefreshExpiryBanner.tsx` (new) | Non-blocking banner rendered inside `(main)/(drawer)/(tabs)/_layout.tsx` |
| Modal UI | `features/auth/components/RefreshExpiryModal.tsx` (new) | One-shot per-day modal triggered from `app/_layout.tsx` on foreground |

## Out of scope

- Extending the backend's refresh-token TTL beyond 30 days. The
  30-day window is a security-policy decision; this design works
  *within* it.
- Allowing the app to continue past refresh-token expiry. Once the
  refresh token is dead and the user is online, forced logout is the
  correct behavior — the design surfaces the *warning*, not a workaround.
- Persisting unsynced edits across forced logout. That is a separate
  problem (sync hygiene) tracked under existing PowerSync work.

## Open questions

None. Backend already issues JWT refresh tokens with `exp`; client only
needs to consume what is already there.
