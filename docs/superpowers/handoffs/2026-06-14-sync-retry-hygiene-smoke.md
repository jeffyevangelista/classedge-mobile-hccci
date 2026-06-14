# Sync Retry Hygiene — Deferred Smoke Tests

> **Status:** PR 1 code complete (8 files in working tree, uncommitted). Automated
> verification (typecheck, grep checks, structural counts) passed. The four
> on-device smoke tests below are deferred to a future session — capture what
> they're verifying, the exact recipes, and the expected log signatures.

**Plan:** [docs/superpowers/plans/2026-06-14-sync-retry-hygiene.md](../plans/2026-06-14-sync-retry-hygiene.md) (Task 6 in the plan is the canonical reference; this doc adds the concrete recipes refined during execution.)

**Spec:** [docs/superpowers/specs/2026-06-14-sync-retry-hygiene-design.md](../specs/2026-06-14-sync-retry-hygiene-design.md)

## What's already verified (no rerun needed)

- `SyncBanner.tsx` deleted, zero in-code references repo-wide.
- `useAttachmentSyncStatus.ts` deleted, zero in-code references repo-wide.
- `SyncCenter.tsx`, `SyncStatusCard.tsx`, `SyncSheet.tsx` all use the merged `useAttachmentStatus`.
- No `.pending` field access on attachment status anywhere (`SCORE_TEXT_CLASS.pending` at `AssessmentAttempts.tsx:269` is an unrelated style-map key).
- Watcher predicate `datetime(updated_at) < datetime('now', '-30 seconds')` is in place at `attachments.watcher.ts:57`.
- `await silentRefresh({ force: true })` lands at `Connector.ts:127` (CRUD 401 path) and `attachments.queue.ts:204` (attachment 401 path).
- `Connector.ts`: 3 `fetchAndLog` references (def + 2 internal helper calls) and 6 `fetchOpWithAuthRetry` references (def + 5 call sites).
- `npm run typecheck` clean except the 2 pre-existing baseline errors:
  - `features/classroom/components/CreateClassroomActivityForm.tsx:184:22` (route type mismatch)
  - `features/classroom/components/StudentScoreItem.tsx:119:7` (`hasImage` used-before-decl)

## Setup (all four device smoke tests share this)

```bash
npm run start:dev     # terminal 1
npm run ios           # terminal 2 (or :android)
```

Sign in as a test student (or teacher) account. Have **React Native Debugger**
open for Zustand state mutation, and **Drizzle Studio** open for direct SQLite
writes against `attachments_local`.

## Token-mutation recipe (used by smoke 1 and smoke 2)

The new code paths fire on HTTP **401**, not on expiry detection. Triggering a
genuine 401 only needs an unverifiable signature — no need to shorten server
TTLs. The garbage-token approach is deterministic, self-reverting (the next
foreground poll or smoke-triggered `silentRefresh` restores a valid token), and
has zero blast radius.

```js
// In React Native Debugger console — clobber access token, refresh token intact.
useStore.getState().setAccessToken("eyJhbGc.invalid.signature");
```

Server will return 401 on the next API call, which is the path under test.

### Negative-case variant (proves the refresh-failure pass-through)

```js
// Kill both — silentRefresh returns false (no refresh token), retry skipped.
useStore.getState().setAccessToken("eyJhbGc.invalid.signature");
useStore.setState({ refreshToken: null, expiresAt: null });
```

## Smoke 1 — CRUD 401 → forced refresh

**Verifies:** `Connector.uploadData` → `fetchOpWithAuthRetry` triggers
`silentRefresh({ force: true })` on a 401 and retries the same op once with the
rotated token.

**Recipe**

1. Sign in.
2. Run the **Token-mutation recipe** above (positive case).
3. Trigger any write that hits `Connector.uploadData`: submit an assessment
   attempt, mark an announcement read, change a profile field — anything that
   writes a PowerSync-synced row.

**Expected logs**

```
[Connector] response: { ..., status: 401 }
[TokenRefresh] Tokens refreshed silently
[Connector] response: { ..., label: "... (retry-after-refresh)", status: 2xx }
```

**Failure signatures**

- No `(retry-after-refresh)` line → the helper didn't catch the 401. Check
  that `UploadOpError.status === 401` is being thrown (i.e. `fetchAndLog`
  classified the response correctly).
- Two consecutive 401s → refresh succeeded but `useStore.getState().accessToken`
  didn't pick up the rotated value, or the rebuilt headers reused the old token.

### Negative case

Run the **Negative-case variant** of the token-mutation recipe, then trigger a
write. **Expected**: 401 → no `[TokenRefresh] Tokens refreshed silently` log →
PowerSync re-queues the transaction (look for `[Connector] Upload failed, will
retry automatically:`). No infinite loop.

## Smoke 2 — Attachment 401 → awaited refresh

**Verifies:** `AttachmentQueue.processOne`'s 401 branch now awaits
`silentRefresh({ force: true })` instead of sleeping 1 s, and the retry runs
with the rotated token.

**Recipe**

1. Sign in. Confirm at least one attachment is queued (open any screen with
   student photos or activity files; pull-to-refresh).
2. Run the **Token-mutation recipe** (positive case).
3. Force a queue tick. Easiest path: open Drizzle Studio and `INSERT` a new
   row into `attachments_local` with `state='queued'`, or `UPDATE` an existing
   row's `updated_at` to `datetime('now')` to make the watcher pick it back up.
   Alternatively, navigate to a screen that pulls fresh attachments.

**Expected logs**

```
metaUrl https://.../mobile_attachment/<id>/
[attachments] failed <resource>/<id>: Metadata fetch failed: 401   ← initial 401
[TokenRefresh] Tokens refreshed silently                            ← refresh fired
                                                                    ← (no 1 s gap)
state transitions to 'synced' for the same row                      ← retry succeeded
```

**Failure signatures**

- ~1 s gap between the 401 and the retry → the old `setTimeout(1000)` is still
  in place; the swap didn't land. Check `attachments.queue.ts:204`.
- Retry runs but immediately 401s again → `useStore.getState().accessToken` was
  still empty when the retry started. `silentRefresh` returned `false` (offline,
  dead refresh token) — that's the negative-case path, not a bug.

### Negative case

Run the **Negative-case variant** of the token-mutation recipe, then trigger an
attachment fetch. **Expected**: row ends `failed`, `retry_count` incremented by
1, `error` column contains the 401 message. No infinite loop. Subsequent ticks
do NOT re-queue the row immediately (watcher cooldown — see smoke 3).

## Smoke 3 — Watcher 30 s auto-heal cooldown

**Verifies:** `attachments.watcher.ts`'s auto-heal `UPDATE` now requires
`updated_at` to be at least 30 s old before re-arming a `failed` row to
`queued`. Push-driven retries via `enqueuePushAttachments` are exempt.

**Recipe — passive auto-heal cooldown**

1. In Drizzle Studio, pick one or two `attachments_local` rows and run:

```sql
UPDATE attachments_local
SET state = 'failed', retry_count = 1, updated_at = datetime('now')
WHERE id IN ('<id-1>', '<id-2>');
```

2. Trigger a watcher tick by touching any tracked table. Easiest:

```sql
UPDATE accounts_profile SET student_photo = student_photo WHERE rowid = 1;
```

(Tracked tables are listed in `features/attachments/attachments.config.ts`'s
`ATTACHMENT_COLUMNS` — any of those tables works.)

3. **Within 30 s:** confirm the targeted rows stay `state = 'failed'`.
4. **After 30 s:** run another tracked-table touch to trigger a second tick.
   Confirm the rows now flip to `state = 'queued'` and the worker re-attempts.

**Failure signatures**

- Rows flip to `queued` immediately on step 2 → the cooldown predicate isn't
  matching. Likely cause: `updated_at` wasn't stored as ISO 8601 or the
  `datetime()` wrapping was dropped. Check `attachments.watcher.ts:57`.
- Rows never flip to `queued` even after 30 s → the predicate is over-strict.
  Check that both sides are wrapped in `datetime()`.

**Recipe — push-driven retry stays immediate (regression check)**

1. Run the failure-prep SQL from step 1 above again on a fresh row.
2. From a dev-only button or `useStore` hack, call:

```ts
import { enqueuePushAttachments } from "@/features/attachments/attachments.api";

await enqueuePushAttachments(
  [{ id: "<the-failed-row-id>", resource: "<matching-resource>" }],
  0,  // priority 0
);
```

(`resource` must match an `ATTACHMENT_COLUMNS[].resource` value from
`attachments.config.ts`.)

3. **Expected:** row flips to `queued` immediately — no 30 s wait.

**Failure signature**

- Row stays `failed` after `enqueuePushAttachments` → the push code path
  accidentally inherits the watcher's cooldown. Check that the `UPDATE` in
  `attachments.api.ts:79-99` (which handles existing rows) is unchanged.

## Smoke 4 — UI parity (hook consolidation)

**Verifies:** Merging `useAttachmentSyncStatus` into `useAttachmentStatus` and
renaming `pending` → `queued` didn't regress any visible behavior.

**Recipe**

1. Cold-start the app, sign in.
2. **SyncCenter icon** (in `TabsHeader`):
   - Online + synced: green cloud-check.
   - Offline: red cloud-slash.
   - Active sync: amber cloud-arrow with a pulse animation.
   - Failed attachments > 0: amber cloud-warning + red badge with the count.
   - Connecting: rotating arrows-clockwise spinner.
3. Tap the icon. **SyncSheet** opens. Confirm these rows render:
   - Connection (Connected / Connecting / Disconnected)
   - Sync Activity (Uploading / Downloading / All synced / Pending N / Waiting)
   - Attachments (`N of M downloaded` or `All N downloaded` or `N failed · M of K downloaded`)
   - Last Synced (timestamp string or "Never")
   - Pending Changes (count)
4. **Failure alert** — in Drizzle Studio, mark a row `state='failed'`. The sheet
   should render the red "N attachment failed to download" alert with a
   "Retry all" button. Tap it; confirm the row flips to `queued` and the alert
   disappears once it succeeds.
5. **Low-storage alert** — if you can shrink free disk below 100 MB (or stub
   `attachmentQueue.isLowStorage()` to return `true`), confirm the amber
   "Low device storage" warning still renders.

**Failure signatures**

- Console error about an undefined field on `AttachmentStatus` → a consumer is
  reading a field that was dropped in the merge. Grep for the field name.
- Counters render `NaN` or 0 unexpectedly → the SQL `GROUP BY state` returned a
  state string the new hook doesn't recognize. Add a console log around the
  `for (const row of data)` loop in `useAttachmentStatus.ts`.

## When to come back to this

Run these before opening the PR (so the PR description can reference
"smoke-tested locally"). If you'd rather merge first and verify in QA, that's
fine — the PR is correct by automated checks; the smoke tests are the
behavior-level confirmation.

After PR 1 lands and is verified, PR 2 (full-screen Sync Center reimagine)
resumes from the brainstorming approval point: Section 1 (architecture) was
approved; Sections 2-5 (UI layout, data tables, copy/a11y, migration) are next.
