# Biometric re-authentication gate — design

**Date:** 2026-06-18
**Status:** Proposed (not scheduled for implementation in this batch)
**Priority:** Medium-high (device-theft hardening)

## Problem

The refresh token sits in iOS Keychain / Android Keystore via
`expo-secure-store` (`lib/storage/secure-storage.ts:1`). Encryption at
rest is fine, but on an **unlocked** device, anyone who can pick it up
has up to **30 days** of full session access:

- Gradebook, attendance, financial records of a student (PII of minors).
- Teacher's classroom management, grading, announcements.
- Chat history with classmates / teachers.

Education apps do not typically carry banking-level scrutiny, but the
combination of *PII + minors + long offline sessions* warrants more than
"trust the OS lock screen." There is no app-level biometric check on
cold start, resume from background, or after an idle window.

## Constraints

- **Must not break offline-first.** The biometric prompt is a *local*
  check (Face ID / Touch ID / Android biometric), not a server call. It
  must succeed offline.
- **Must not break the "always logged in" feel.** Use the OS-provided
  fallback (device passcode) when biometrics are unavailable or disabled;
  do not force a password re-entry.
- **Must respect accessibility.** Some users do not have biometrics
  enrolled; some users (visually impaired, motor disabilities) cannot
  use them reliably. Always offer a device-passcode fallback. Never block
  forever.
- **Must not double-prompt on top of OS lock.** If the user just unlocked
  their device 2 seconds ago, prompting again is friction with no
  security benefit. Only prompt after app-level idle thresholds.
- **`expo-local-authentication`** is the supported library on Expo SDK
  versions this app uses; no new native module is needed.
- **No new tokens / endpoints.** This is a pure client gate.

## Decisions

1. **One opt-in toggle** in Settings: "Require biometric on resume."
   Default **off** until shipped + announced, then default **on** for new
   installs after a chosen release. Existing users keep their preference.
2. **Two trigger conditions** when the toggle is on:
   - **Cold start:** prompt during the `restoreSession` flow, before
     mounting the `(main)` stack.
   - **Resume from background after idle ≥ 5 minutes:** track via
     `AppState` listener storing `backgroundedAt` in memory; on
     `active` transition, compare and prompt if exceeded.
3. **Failure handling:**
   - Biometric not enrolled → silently fall back to passcode prompt.
   - Passcode not set → toggle disables itself, surface a one-shot
     in-app notice ("Enable a device passcode to use this feature.").
   - User cancels prompt → app stays on a blocking lock screen until
     they retry; offer "Sign out" as escape hatch.
3. **Lock screen UI** is a full-screen overlay in `app/_layout.tsx`,
   z-indexed above all stacks. Renders only when `isLocked === true` in
   the auth slice. PowerSync continues syncing in the background
   regardless; only the UI is gated.
4. **No grace period after successful prompt.** A passed prompt unlocks
   the session for the foreground lifetime. Backgrounding > 5 min
   re-arms.
5. **`isLocked` is in-memory only.** It is not persisted; cold start
   sets it to `true` by default when the toggle is on.

## Architecture summary

| File | Responsibility |
|---|---|
| `features/auth/biometric.slice.ts` (new) | Zustand slice with `isLocked`, `biometricEnabled`, `lastActiveAt`, `lock()`, `unlock()`, toggle action |
| `features/auth/useBiometricLock.ts` (new) | Hook installed at root: subscribes `AppState`, computes idle, drives lock/unlock |
| `features/auth/components/BiometricLockScreen.tsx` (new) | Full-screen overlay UI; calls `expo-local-authentication`; offers retry + sign-out |
| `screens/profile/SettingsScreen.tsx` (existing) | Add toggle row "Require biometric on resume" |
| `app/_layout.tsx` (existing) | Conditionally render `BiometricLockScreen` above the protected stack when `isLocked && isAuthenticated` |
| `utils/storage-keys.ts` (existing) | Add `MMKV_KEYS.BIOMETRIC_ENABLED` |

## Out of scope

- Per-screen sensitivity gating (e.g., financial records require
  biometric every time). Can be layered later if needed.
- Server-side biometric attestation (proving the device did the
  biometric check). Belongs with device attestation (#3).
- Biometric-backed Keychain access (`expo-secure-store`'s
  `requireAuthentication` option). Worth considering but couples the
  refresh-token read to the prompt, which complicates the silent
  background refresh flow; deferred.

## Open questions

- Should the lock screen also gate PowerSync's *uploads* (treat the
  lock as "do not sync new local writes outbound")? Initial answer: no
  — uploads of already-queued data are not user-visible and continuing
  them is fine. Re-evaluate if user research disagrees.
- Cold-start lock UX during onboarding (first launch after install): we
  cannot prompt biometric because the user has not opted in yet. Initial
  answer: the toggle is off by default, so this is a non-issue at first
  ship.
