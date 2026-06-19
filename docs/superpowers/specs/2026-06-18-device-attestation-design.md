# Device binding & attestation — design

**Date:** 2026-06-18
**Status:** Proposed (long-horizon hardening; not scheduled)
**Priority:** Medium (raises cost of token-theft attacks)

## Problem

All bearer tokens issued by the backend (`access_token`,
`refresh_token`, `powersync_token`) are **unbound** — anyone in
possession of the bytes can replay them from anywhere. Today this is an
acceptable trade-off because:

- Refresh tokens never leave the iOS Keychain / Android Keystore.
- The app has no WebView with third-party content.
- No third-party SDKs read or proxy auth tokens.

But the threat model is changing as the chat feature ships (real-time
messaging raises the value of session theft) and as the app's user base
grows (more attractive target). Once a refresh token is exfiltrated, a
30-day session can be replayed on any device with no fingerprinting
defense.

The industry-standard response is **device binding via attestation** —
the device proves its identity at refresh time using a hardware-backed
signal that cannot be replayed off-device.

## Constraints

- **Apple App Attest** (iOS 14+) generates a hardware-attested key the
  app can use to sign challenges. The backend verifies the attestation
  with Apple's CA on first install, then accepts assertions on every
  refresh.
- **Google Play Integrity API** is the Android counterpart.
- **Both require backend integration.** This is not a pure-client
  change; the Django refresh endpoint must verify attestations and
  reject mismatches.
- **Both have rate-limited verification quotas** (Apple's is generous,
  Google's tiered). Per-refresh attestation is feasible at this app's
  scale but worth confirming during implementation.
- **Cold-start cost.** First-launch attestation can take 500-2000 ms;
  must run async after login, not block the login flow.
- **Cannot break Expo development workflow.** Attestation is unavailable
  in Expo Go and the iOS simulator. Implementation must gate on
  `__DEV__` or build profile so dev builds skip attestation.

## Decisions

1. **Add `attestation_assertion` to the `/auth/refresh/` request body.**
   Backend verifies and binds the refresh token's `jti` claim to a
   device key on first use; subsequent refreshes must come from the same
   device key.
2. **Generate the device key lazily.** Skip until the first successful
   refresh; do not block the initial login.
3. **Graceful degradation:** if attestation fails on a real device for a
   non-malicious reason (Apple CA outage, Google Play Services missing),
   the backend logs but falls through to the legacy unbound path. After
   N consecutive failures, treat as suspicious and force re-login.
4. **Dev builds skip attestation entirely** — controlled by an
   `EXPO_PUBLIC_ATTESTATION_ENABLED` flag that ships as `false` for
   `development` and `true` for `preview` / `production`.
5. **The attestation key is rotated** on every device-passcode change
   (Apple App Attest does this automatically on key invalidation). The
   client detects invalidation and re-attests on the next launch.

## Architecture summary

| Layer | File | Responsibility |
|---|---|---|
| Client native bridge | `features/auth/attestation.ts` (new) | Wrap `expo-app-integrity` (or `react-native-ios-app-attest` / `react-native-google-play-integrity`); expose `generateAssertion(challenge: string)` |
| Refresh request | `features/auth/refreshToken.ts` (modify) | Fetch challenge from backend, sign with attestation key, include in refresh payload |
| Backend refresh endpoint | `classedge-mobile-test/accounts/views/user_views.py` (PowerSyncTokenRefreshView) | Issue challenges, verify assertions, bind/check device key |
| Backend storage | New `DeviceAttestation` model — user, key ID, public key, last seen | Persist verified keys |
| Config | `app.config.ts`, `eas.json` | Per-profile `EXPO_PUBLIC_ATTESTATION_ENABLED` |

## Out of scope

- WebAuthn / passkeys as a sign-in factor. Different problem (login UX),
  same underlying primitive.
- DPoP (RFC 9449) — JS-side cryptographic proof-of-possession. Heavier
  to implement on RN, weaker than hardware attestation for this app's
  threat model.
- Attesting access tokens / PowerSync tokens. Refresh is the long-lived
  bearer; access and PowerSync rotate every 15 minutes and 30 minutes
  respectively, so the steal-and-replay window for those alone is
  small.

## Open questions

- Which RN library: `expo-app-integrity` (community), the unmaintained
  `react-native-ios-app-attest`, or a custom Expo Modules native package?
  Defer to prototyping during implementation.
- Backend: extend SimpleJWT's `TokenRefreshView` or wrap a new
  custom view? Implementation will pick.
- Rate-limit posture: per-user, per-IP, per-device-key? Start with
  per-user + per-IP, evaluate.
