# Flow-Keyed OAuth Verifier Storage

**Date:** 2026-06-02
**Status:** Design — pending implementation plan

## Goal

Eliminate the "No codeVerifier in storage" error class by making PKCE verifier storage flow-specific instead of module-scoped. Each OAuth attempt gets a unique flow ID round-tripped via the OAuth `state` parameter; verifiers are keyed by that ID and pruned on TTL. Stale URL replays, watchdog-during-auth deletions, failed-retry losses, and concurrent-attempt races all become impossible by construction.

## Background

The auth-service migration shipped on 2026-06-02 uses a single MMKV slot for the PKCE `codeVerifier`. Any of these scenarios wipes it prematurely:

1. **30-second watchdog timeout** fires while the user is still authenticating (MFA, Conditional Access, account picker). The verifier is deleted via `cancelOAuth()`. When the user finishes and the deep link arrives, `handleCallbackUrl` finds no verifier and throws.
2. **Stale URL replay.** Android occasionally re-delivers a deep link via `Linking.getInitialURL()` or `addEventListener` on app launch (intent persistence quirk). The replayed URL is from a prior successful login — verifier was deleted on that success. Cold-start handler fires `handleCallbackUrl` → no verifier → error logged.
3. **Previous failed exchange.** If the first `handleCallbackUrl` call fails (network blip, MS rate-limit, backend 500), its catch fires `cancelOAuth()` which deletes the verifier AND nulls `lastProcessedCode`. A subsequent call with the same URL bypasses idempotency and finds no verifier.
4. **External stale URL.** If someone shares an OAuth callback URL or it shows up in browser history, tapping it brings the deep link to the app with no in-flight OAuth, hence no verifier.

The shared root cause: **the verifier is a single module-scoped slot.** There's no way to correlate a redirect URL with the flow that initiated it.

## Success criteria

1. The "No codeVerifier in storage" error path is unreachable for any user-initiated flow.
2. The 30-second watchdog stops destroying state — it resets the UI's `oauthPhase` to `idle` (so the user can re-tap MS) but leaves verifier entries intact for late-arriving redirects within Microsoft's code-validity window (~10 minutes).
3. Stale URL replays (Android intent re-delivery, externally-shared URLs) are silently ignored — no console noise, no Sentry false-positive `ms_token_exchange_failed` events.
4. Concurrent or overlapping OAuth attempts cannot trample each other.
5. Verifier entries don't accumulate indefinitely in MMKV — TTL cleanup happens on the next `startMicrosoftLogin` call.

## Non-goals

- **Switching to a different OAuth library.** Stay on `expo-auth-session`.
- **Server-side state validation.** The `state` parameter is purely a local correlation ID; we don't validate it against a server.
- **Multi-account or multi-tenant changes.** One MS account per device, same as today.
- **Watchdog elimination.** A 30s UI-state reset is still useful as a heuristic ("the user isn't actually authenticating any more, let them retap"). We just stop destroying the verifier.
- **Backend changes.** The `/auth/microsoft/` contract is unchanged.
- **Azure AD configuration.** No redirect URI changes.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ startMicrosoftLogin()                                       │
│ 1. flowId = Crypto.randomUUID()                             │
│ 2. Prune verifier entries older than TTL (10 min)           │
│ 3. AuthRequest({ ..., state: flowId, ... })                 │
│ 4. setMMKVItem(`oauth_verifier:${flowId}`,                  │
│      { codeVerifier, createdAt })                           │
│ 5. promptAsync → on success, pass URL to handleCallbackUrl  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼  classedge://auth/callback?code=…&state=<flowId>
┌─────────────────────────────────────────────────────────────┐
│ handleCallbackUrl(url)                                      │
│ 1. Parse `code` AND `state` from URL                        │
│ 2. If no `code` → silent return                             │
│ 3. If `code === lastProcessedCode` → silent return (dedup)  │
│ 4. If no `state` → silent return (malformed/stale)          │
│ 5. verifier = getMMKVItem(`oauth_verifier:${state}`)        │
│ 6. If no verifier entry → silent return                     │
│    (stale URL replay; emit info-level Sentry event)         │
│ 7. Exchange code + verifier                                 │
│ 8. On success: delete this flow's verifier entry,           │
│    setOAuthPhase idle, set lastProcessedCode                │
│ 9. On exchange error: emit Sentry, set error on UI,         │
│    DO NOT delete verifier (allow retry within MS window)    │
└─────────────────────────────────────────────────────────────┘
```

### Storage schema

| Key pattern | Value | Lifetime |
|---|---|---|
| `oauth_verifier:<flowId>` | `{ codeVerifier: string, createdAt: number }` | Until success OR pruned (>10 min old) |

The old single key `MMKV_KEYS.OAUTH_CODE_VERIFIER` (value `"oauthCodeVerifier"`) gets removed. The cleanup function deletes it explicitly on first run for backwards-compat.

### Pruning strategy

**Lazy, on-demand pruning.** Each call to `startMicrosoftLogin` runs a small cleanup pass:

1. Iterate MMKV keys matching the prefix `oauth_verifier:`
2. For each entry, parse `createdAt`; if `Date.now() - createdAt > 10 * 60 * 1000`, delete it
3. Continue with the new login flow

No background timer, no scheduled cleanup. The set of entries is small (at most a handful of stale ones from cancelled flows). The cost is one MMKV iteration per login attempt — negligible.

The user's MMKV wrapper (`@/lib/storage/mmkv-storage`) doesn't currently expose a `getAllKeys` method, so we'll need to use the underlying `storage.getAllKeys()` directly (or extend the wrapper — TBD at plan time).

### What changes about `cancelOAuth()`

Before:
- Deletes verifier
- Resets `oauthPhase` to idle
- Nulls `lastProcessedCode`
- Clears `inFlightExchange`

After:
- Resets `oauthPhase` to idle
- Nulls `lastProcessedCode`
- Clears `inFlightExchange`
- **Does NOT delete verifier entries.** Pruning is now centralized in `startMicrosoftLogin`.

The watchdog can still call `cancelOAuth()` at 30s — it just won't destroy verifiers anymore. The user can retap MS to get a fresh flow; the orphaned verifier from the timed-out flow will be pruned on the next login.

### Telemetry additions

Extend the existing `TelemetryEvent` union with:

- **`oauth_stale_url_ignored`** — fired when `handleCallbackUrl` silently returns due to missing verifier entry (stale URL replay). Info-level. Lets us monitor frequency without it being treated as an error.

The existing `ms_token_exchange_failed` event continues to fire only for real exchange failures (network, MS rejected the code, backend failure, etc.) — NOT for stale-URL noise.

### Idempotency contract (unchanged semantically)

`handleCallbackUrl` remains idempotent: same URL twice = single exchange. The dedup mechanism stays the same (`inFlightExchange` for in-flight, `lastProcessedCode` for already-processed). The flow-keyed verifier doesn't replace idempotency — it complements it by also handling cross-flow stale URLs.

## File-level changes

### New helpers

- `features/auth/oauthVerifierStore.ts` (NEW) — thin module exposing `saveVerifier(flowId, verifier)`, `getVerifier(flowId)`, `deleteVerifier(flowId)`, `pruneExpired()`. Encapsulates the prefix + serialization details.

### Modified files

- `features/auth/authService.ts` — generate flowId, pass as `state`, key verifier storage, extract state from URL, prune on startMicrosoftLogin, update cancelOAuth
- `utils/storage-keys.ts` — remove `OAUTH_CODE_VERIFIER` (the prefix is now an implementation detail of `oauthVerifierStore.ts`)
- `lib/telemetry.ts` — add `oauth_stale_url_ignored` to `TelemetryEvent` union
- `lib/storage/mmkv-storage.ts` — add `getAllMMKVKeys()` helper exposing `storage.getAllKeys()`

### Unchanged

- `app/auth/callback.tsx` — no changes needed; still calls `handleCallbackUrl(url)` with the URL it has. The service handles the new state-parameter logic transparently.
- `app/_layout.tsx` — Linking listener and getInitialURL unchanged; still pass raw URL to `handleCallbackUrl`. Watchdog unchanged (still calls `cancelOAuth()` at 30s).
- `MSAuthButton.tsx` — unchanged
- `hydrateSession.ts`, `useTokenRefresh.ts`, `signOut.ts` — unchanged
- Azure AD config — unchanged

## Backwards compatibility

On the first run after upgrade:
- Any existing single-key verifier entry (`MMKV_KEYS.OAUTH_CODE_VERIFIER` value `"oauthCodeVerifier"`) is deleted explicitly during the first `pruneExpired()` call.
- No user-visible impact — verifiers are short-lived OAuth state, not durable user data.

## Acceptance checklist (manual — no test infra)

- [ ] Happy path: tap MS → complete auth quickly → land on dashboard. No change vs current behavior.
- [ ] Slow MS auth (>30s): tap MS, take >30s in browser (slow account selection, simulated MFA delay), complete auth → still lands on dashboard. Today this fails with "No codeVerifier"; after the fix it succeeds.
- [ ] Cancel mid-auth: tap MS, press back in browser → returns to LoginScreen, no error. No verifier entries leak (or at most one orphan that gets pruned on next attempt).
- [ ] Cold-start replay: complete an MS login successfully, force-kill the app, reopen → app launches normally (any stale deep link triggers `oauth_stale_url_ignored` telemetry but no error UI).
- [ ] Multiple cancel-retap-cycle: tap MS, cancel, tap MS again, complete → succeeds. Old orphan verifier from the first flow is pruned.
- [ ] No "No codeVerifier in storage" error in console during any of the above.
- [ ] Console doesn't fill up with `[OAuth deep-link] handleCallbackUrl failed` warnings during normal use.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] Telemetry: `oauth_stale_url_ignored` fires on cold-start replay scenario when DSN is configured.

## Rollback

Single PR — `git revert <merge-commit>` restores the previous single-slot verifier behavior. No DB migrations, no server changes, no Azure changes.

The MMKV `oauth_verifier:*` entries persisted by the new code would become orphans after rollback, but the old code's `OAUTH_CODE_VERIFIER` constant doesn't read them — they're harmless until they expire (no GC after rollback). If this matters, a small cleanup script can be added at rollback time.

## Open questions noted for review

1. **flowId format.** Chose `Crypto.randomUUID()` from `expo-crypto` (already a dep). Alternative: `Date.now() + Math.random().toString(36)` if we want to avoid the import. UUID is cleaner; no security need for cryptographic randomness here (the state param is local-only).

2. **TTL duration.** Chose 10 minutes to match Microsoft's authorization code validity window. Could be 5 (more aggressive cleanup) or 15 (more tolerant). 10 is the natural fit.

3. **Pruning trigger.** Chose lazy-on-startMicrosoftLogin. Alternative: also prune in `handleCallbackUrl` (after a successful exchange) for symmetry. Marginal benefit; current spec keeps cleanup centralized in one entry point.

4. **`oauth_stale_url_ignored` telemetry.** Sending info-level events to Sentry is fine but generates noise. Could also be gated behind a debug flag or a sample rate. Default: send always, sample later if volume becomes a problem.

5. **Watchdog UI behavior.** The 30s watchdog still resets `oauthPhase` to idle. But now the user might be on `callback.tsx` (cold-start case) — the cancellation-detection effect there will route them to /login. Should the watchdog also surface a toast/dialog explaining what happened? Default in this spec: no — silent UI reset, user re-taps if needed. The error toast on callback.tsx still handles the "real failure" case.

6. **`getAllMMKVKeys` helper.** New addition to the storage wrapper. Could also use `storage.getAllKeys()` directly from `mmkvPersister` for one-off use. Adding a helper keeps the wrapper consistent (`getMMKVItem`/`setMMKVItem`/`deleteMMKVItem`/`getAllMMKVKeys`). My pick: add the helper.
