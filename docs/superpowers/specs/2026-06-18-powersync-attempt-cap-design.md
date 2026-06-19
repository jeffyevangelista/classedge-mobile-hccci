# PowerSync 5-attempt cap — audit & guardrails

**Date:** 2026-06-18
**Status:** Proposed (audit-only; low impact)
**Priority:** Low (already largely mitigated by `fetchOpWithAuthRetry`)

## Problem

`features/sync/crudMeta.ts:3` defines `STUCK_ATTEMPT_CAP = 5`. After 5
failed upload attempts on the same CRUD op, the op is dropped from the
PowerSync queue and surfaced in the Sync Center "Failed" list. The
intent is to prevent permanently-stuck ops from filling the queue and
spamming the backend.

The risk during *auth* failures specifically: if the access token
expires while the app is offline, and the user comes back online with
the queued CRUD trying to upload before `silentRefresh` completes, the
first uploads may fail with 401 and burn attempts before the refreshed
token is in hand.

The existing mitigation is `fetchOpWithAuthRetry` in
`powersync/Connector.ts:125-147`, which on 401:
- triggers `silentRefresh({ force: true })`
- retries the op once with the new token before counting it as a failure

That logic *should* keep an auth-only failure from costing attempts, but
it has not been verified end-to-end under realistic offline-then-online
conditions. There is also no telemetry to confirm the attempt counter
is *not* incrementing on auth retries.

## Constraints

- **Do not raise the cap blindly.** A higher cap means stuck ops sit in
  the queue longer; the user-visible "queued" count is more confusing.
- **Do not lower the cap.** 5 is already the floor of "give up gracefully
  without infinite retries."
- **Do not change the dropped-permanent-statuses list**
  (`features/sync/permanentStatuses.ts:17-19`); 401 is correctly *not* in
  the permanent list.
- **Audit must use real behavior**, not just a code read — write a
  scripted scenario that simulates offline → expired access token →
  online and confirms the attempt counter stays at 0 for the auth-only
  retry path.

## Decisions

1. **Audit-only first.** Confirm in code review and a manual test that
   `fetchOpWithAuthRetry` swallows the auth retry before the upload's
   attempt counter increments. Record findings in this spec; only open
   a follow-up implementation change if the audit fails.
2. **If audit fails:** add a discriminator in `crudMeta.ts` so auth-only
   failures (`status === 401 && refresh_in_progress`) are explicitly
   *not* counted toward the cap. Implementation detail to be decided
   only if needed.
3. **Add telemetry** regardless of audit outcome: emit a sync event
   when an upload attempt is recorded vs. retried-without-counting, so
   future regressions show up in dashboards.
4. **No change to `STUCK_ATTEMPT_CAP` value.** 5 is fine; the issue (if
   any) is *what counts* toward it, not the threshold.

## Architecture summary

| File | Audit step |
|---|---|
| `powersync/Connector.ts:125-147` | Read the code; confirm `transaction.complete()` is not called on the 401 path and the op is re-uploaded under the same transaction without `crudMeta` increment |
| `features/sync/crudMeta.ts` | Read the attempt-counting code; confirm increment happens only on `markAttempted`, not on auth-retry |
| `tests/` (or manual) | Reproduce: insert local CRUD → kill backend → wait for access-token expiry → resume backend → confirm upload succeeds without attempt count > 0 |

## Out of scope

- General PowerSync retry-policy redesign.
- Splitting the queue between user-data ops and system ops.

## Open questions

- Should the Failed list show *why* an op was dropped (401 burnout vs.
  400 permanent)? Today the toaster + Failed list show error details
  (`features/sync/crudMeta.ts:100-128`); confirm during audit.
