---
title: Sync Center reimagine (PR 2 of Sync Center rework)
date: 2026-06-14
status: proposed
---

# Sync Center reimagine

PR 2 of the two-PR Sync Center rework. PR 1 ([retry hygiene
spec](2026-06-14-sync-retry-hygiene-design.md)) shipped the bug fixes. This PR
replaces the modal `SyncSheet` with a full-screen `/sync` route, adds two new
local tables that turn the surface into a first-class diagnostic tool, and
ships the theming, copy, and accessibility polish that PR 1 deferred.

## Motivation

The current `SyncSheet` is a centred `Dialog` mounted from
`app/(main)/_layout.tsx`. It answers exactly one question well ("am I
synced?") and almost everything else poorly:

- **No view of pending writes.** `useSyncData` computes a `pendingChanges`
  array (table, op, recordId, fields) but only the count is rendered. Users
  with offline work can't see what's waiting to upload.
- **No view of stuck writes.** When a CRUD op repeatedly 4xx's, the PowerSync
  queue retries forever silently. No surface tells the user, "this thing
  isn't going to succeed without your intervention."
- **No diagnostic history.** Errors flash in a banner and disappear; there is
  no way to see the last N attempts, statuses, or refresh events. Support
  cases are unreproducible.
- **Theming is broken.** `SyncStatusCard.tsx` uses hardcoded hex values
  (`#10B981`, `#F59E0B`, `#EF4444`, `#3B82F6`, `#6B7280`) instead of
  `useThemeColor`. Dark mode renders the wrong palette.
- **Raw technical errors leak into the UI.** Banner messages show the
  PowerSync SDK error text and HTTP status codes. End users see strings like
  `Upload error: Failed to fetch ... status=400 body={"score":"invalid choice
  id"}`.
- **Tap target is 36 × 36.** Below the Apple HIG / Material 44 pt minimum.
- **Accessibility gaps.** The icon's red badge isn't separately announced;
  rows distinguish state with colour only; the route has no focus target for
  screen-reader landing.
- **`StreamList` is dev-only.** Useful diagnostic data is hidden from anyone
  troubleshooting in a production build.

Brainstorming chose ambition level C ("full reimagine"); the cumulative
effect is a single surface that supports diagnosis (Events log, Stuck lane),
recovery (per-item Retry, Reconnect), and reassurance (clear empty states,
friendly copy).

## Scope

**In scope**

- New `app/(main)/sync.tsx` route + `screens/main/SyncCenterScreen.tsx`
  composing five sections: Status / Queue / Stuck / Events / Advanced.
- Two new PowerSync local tables: `sync_events_local` (200-row ring buffer of
  every sync attempt + auth refresh) and `ps_crud_meta_local` (per-op
  failure tracking → drives the Stuck lane).
- Translation layer (`humanizeSyncError`) and copy registry
  (`features/sync/copy.ts`).
- Theming overhaul: hex → `useThemeColor`.
- 44 pt tap target on the header icon + badge accessibility label.
- Focus management on the route title + icon-prefix encoding on Queue / Stuck
  rows so state isn't color-only.
- Atomic removal of `SyncSheet`, `SyncSheetContext`, and `SyncSheetProvider`
  once the route is wired.
- Promote `StreamList` from dev-only to a collapsed-by-default
  `AdvancedSection`.

**Out of scope (deferred or never)**

- **Dismiss on Stuck rows.** Implementing it correctly requires switching
  `uploadData` from `getNextCrudTransaction()` to `getCrudBatch()` for
  per-op completion, plus an `abandoned_uploads_local` table that snapshots
  the payload before drop. Big change with data-loss risk; revisit only if
  `sync_events_local` telemetry shows it's needed.
- CRUD 4xx auto-classification as "permanently failed" — `ps_crud_meta_local`
  surfaces them in the Stuck lane today; promoting them out of the queue is
  the same architectural question as Dismiss.
- Sync history graph, storage usage chart, network-quality indicator. These
  are visible-future ideas but YAGNI for this PR.
- i18n. The copy registry is built so a future i18n PR is a one-place swap;
  shipping i18n itself is its own project.
- Server-side changes. PowerSync rules, backend endpoints, and the auth
  refresh flow are untouched.
- Feature flagging or shipping behind a remote toggle. The swap is atomic.

## Architecture

The route lives at `/sync` inside the existing `(main)` stack. The header
icon (`features/sync/components/SyncCenter.tsx`) becomes a navigator —
`onPress` calls `router.push("/sync")` instead of opening a Dialog. The
Dialog, its provider, and its context module are deleted in the same change.

Two new PowerSync-managed SQLite tables sit next to `attachments_local`:

| Table | Role |
|---|---|
| `sync_events_local` | Ring buffer of the last 200 sync events. Append-only at the API level; a trim runs after every insert. Powers the Events section and is the data the user exports for support. |
| `ps_crud_meta_local` | Sidecar to PowerSync's internal `ps_crud`, keyed by `op_id`. Tracks per-op `attempt_count`, `first_failed_at`, `last_error`, `last_http_status`. Drives the Stuck section. |

PowerSync writes to `ps_crud` are unchanged. We do **not** intercept the
queue or change `transaction.complete()` semantics. All meta lives outside
the PowerSync-owned table.

A small surface of new helpers wraps the table writes:

- `features/sync/syncEvents.ts` — `appendSyncEvent(row): Promise<void>`
  (insert + retention trim in one transaction).
- `features/sync/crudMeta.ts` — `recordCrudAttempt(opId, result)`,
  `clearCrudMeta(opId)`, `resetCrudMeta(opId)` (manual retry).

Producers:

| Site | Events emitted | Crud-meta interaction |
|---|---|---|
| `powersync/Connector.ts` → `fetchOpWithAuthRetry` | `kind='upload'` per attempt; `kind='auth'` on forced refresh path | `recordCrudAttempt` on each non-2xx; `clearCrudMeta` after successful op |
| `powersync/Connector.ts` → `invalidateCredentials` | `kind='auth'` (SDK-triggered) | — |
| `features/attachments/attachments.queue.ts` → `processOne` | `kind='download'` per attempt | — |
| PowerSync `useStatus` connect transitions | `kind='connect'` | — |

Consumers (the new section components) read via `useQuery`:

- `useSyncEvents()` → `EventsSection`
- `useStuckCrudOps()` → `StuckSection` (join of `ps_crud_meta_local` and
  `ps_crud` on `op_id` filtered by attempt cap or age)
- `useAttachmentStatus()` (existing) → `StatusSection`, `QueueSection`,
  `StuckSection` (failed-attachments lane)
- `useSyncData()` (existing) → `StatusSection`, `QueueSection`

## UI layout

Single `ScrollView` (FlashList for the Events section, which can hit 200
rows). Sections render in this fixed order:

1. **Header bar** — back button, "Sync Center" title, "last sync · 3 min
   ago" subtitle (relative time).
2. **Status** — card with Connection / Sync activity / Pending uploads /
   Attachments rows, plus Reconnect (primary) and Force resync (secondary)
   buttons. The card subtitle is context-aware copy from the copy registry
   (`syncing` / `synced` / `offline` / `offline-with-pending` / `low-storage`
   / `connecting`).
3. **Queue** — list of in-flight uploads and downloads. Each row: direction
   arrow (↑ upload, ↓ download), table+op for uploads or resource id for
   downloads, attempt count for uploads, progress bar for downloads. Renders
   only when non-empty; otherwise the heading is suppressed and an inline
   "You're all caught up" empty state takes its place.
4. **Stuck** — red callout banner. Each row: failure summary line, last
   error humanized via `humanizeSyncError`, attempt count, "first failed N
   minutes/hours ago," "Show details" toggle revealing the raw payload + HTTP
   status. Single button per row: **Retry**. No Dismiss in this PR (see
   "Out of scope"). Stuck attachments live in the same section, sourced from
   `attachments_local WHERE state='failed' AND retry_count >= cap`.
5. **Events** — last 200 events from `sync_events_local`, newest first, in
   a monospace FlashList. Each row: time, glyph (✓/⚠/✗), event summary, HTTP
   status, duration. Footer button: **Export log** (shares the JSON via
   the OS share sheet for support tickets).
6. **Advanced** — collapsed disclosure. Body wraps the existing
   `StreamList` (promoted from `__DEV__` to prod) and adds a Storage row
   ("X MB used by N attachments, Y MB free").

Empty-state behaviour: Queue and Stuck collapse to a single-line message
when empty so the page stays short on the happy path. Events always renders
(even if empty, "No recent sync activity").

## Data model

### `sync_events_local`

```sql
CREATE TABLE IF NOT EXISTS sync_events_local (
  id          TEXT PRIMARY KEY,
  ts          TEXT NOT NULL,                 -- ISO 8601 (new Date().toISOString())
  kind        TEXT NOT NULL,                 -- 'upload'|'download'|'auth'|'connect'|'stream'
  target      TEXT,                          -- '<table>/<id>' | 'attachment/<id>' | NULL
  status      TEXT NOT NULL,                 -- 'started'|'ok'|'fail'
  http_status INTEGER,
  message     TEXT,
  duration_ms INTEGER,
  retry_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sync_events_ts ON sync_events_local (ts DESC);
```

`appendSyncEvent` inserts and trims in one `powersync.writeTransaction`:

```sql
INSERT INTO sync_events_local (...) VALUES (...);
DELETE FROM sync_events_local WHERE id IN (
  SELECT id FROM sync_events_local ORDER BY ts ASC
  LIMIT MAX(0, (SELECT COUNT(*) FROM sync_events_local) - 200)
);
```

The 200 cap lives in `features/sync/syncEvents.ts` as `SYNC_EVENT_CAP`. It
balances FlashList smoothness on entry-level Android against support-case
forensics (~6-12 hours of activity for a normal user).

### `ps_crud_meta_local`

```sql
CREATE TABLE IF NOT EXISTS ps_crud_meta_local (
  op_id            TEXT PRIMARY KEY,
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  first_failed_at  TEXT,
  last_attempt_at  TEXT NOT NULL,
  last_error       TEXT,
  last_http_status INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ps_crud_meta_stuck
  ON ps_crud_meta_local (attempt_count, first_failed_at);
```

`op_id` matches `ps_crud.id` (PowerSync's client cuid). Lifecycle:

- **Each failure** in `fetchOpWithAuthRetry`'s outer catch:
  `recordCrudAttempt(opId, { error, httpStatus })` —
  `INSERT OR REPLACE` on first failure (sets `first_failed_at`), `UPDATE
  attempt_count = attempt_count + 1, ...` on subsequent.
- **Successful upload** (transaction completes): `clearCrudMeta(opId)` for
  every op that was in the transaction.
- **Manual Retry** (Stuck row button): `resetCrudMeta(opId)` zeroes
  `attempt_count` and `first_failed_at`. PowerSync's own next cycle picks
  the op back up — no force-poke needed.

**Stuck classification** (read by `useStuckCrudOps`):

```sql
SELECT m.*, c.tx_id, c.data
FROM ps_crud_meta_local m
JOIN ps_crud c ON c.id = m.op_id
WHERE m.attempt_count >= 5
   OR datetime(m.first_failed_at) < datetime('now', '-24 hours')
ORDER BY m.first_failed_at ASC;
```

The cap (`STUCK_ATTEMPT_CAP = 5`) and age threshold (`STUCK_AGE_HOURS = 24`)
live in `features/sync/crudMeta.ts`. PowerSync's `ps_crud.data` blob holds
the payload that `StuckSection` reveals under "Show details."

Both tables are created in `powersync/system.ts`'s `setupPowerSync`
alongside `attachments_local`. They are NOT registered with the PowerSync
schema (`AppSchema.ts`) — they are local-only, never synced to the server.

## Error translation + copy

### `features/sync/humanizeSyncError.ts`

Pure function. Takes any of `UploadOpError | AttachmentFetchError | Error |
{ status: number } | string` and returns `{ message: string; hint?: string
}`.

Classification rules (in order):

| Match | message | hint |
|---|---|---|
| `status === 401` | "Your session needs to be renewed." | "Sign out and back in if this keeps happening." |
| `status === 403` | "You don't have permission to do this." | "Contact your school admin if you think this is a mistake." |
| `status === 404` (attachment) | "This file is no longer available on the server." | _none_ |
| `status === 404` (CRUD) | "The record we're trying to update no longer exists on the server." | _none_ |
| `status === 422` or `status === 400` | "The server didn't accept this update." | "Try again, or contact support if it keeps happening." |
| `status === 413` | "This upload is too large." | "Try removing or resizing the file." |
| `5xx` | "The server is having trouble right now." | "We'll keep retrying automatically." |
| Offline / network error / ENOTFOUND | "You're offline. Your work is saved on this device." | "We'll send it when you reconnect." |
| `ENOSPC` / "no space" | "Your device is low on space." | "Free up some storage to download new files." |
| Anything else | "Something went wrong syncing this." | "Tap Retry, or check the Events tab for details." |

The function is called by `StatusSection`, `StuckSection`, `ForceSyncButton`'s
toast, and the existing `retryAllFailedAttachments` toast in
`SyncCenterScreen`.

### `features/sync/copy.ts`

Single typed object literal exporting every user-facing string in the route.
Used by all five sections + the icon's accessibility label. Examples:

```ts
export const COPY = {
  routeTitle: "Sync Center",
  status: {
    syncing: "Sending your recent changes…",
    synced: "Your work is saved and synced to the cloud.",
    downloading: "Loading the latest data from your courses.",
    offline: "You're offline. We'll sync automatically when you reconnect.",
    offlineWithPending: (n: number) =>
      `You're offline. ${n} item${n === 1 ? "" : "s"} saved here will send when you're back online.`,
    lowStorage: "Your device is low on space. New downloads are paused until you free up storage.",
    connecting: "Reconnecting to the cloud…",
  },
  queue: {
    empty: "You're all caught up.",
    emptySubtitle: "Nothing is waiting to sync right now.",
  },
  stuck: {
    empty: "No problems to fix.",
    emptySubtitle: "If something gets stuck, you'll see it here.",
    showDetails: "Show details",
    hideDetails: "Hide details",
    retry: "Retry",
  },
  events: {
    empty: "No recent sync activity.",
    loadOlder: "Load older",
    export: "Export log",
  },
  advanced: {
    title: "Advanced",
    streamsHeading: "Sync streams",
    storageHeading: "Storage",
    storageRow: (used: string, free: string) =>
      `${used} used by attachments · ${free} free on device`,
  },
  iconA11y: {
    base: "Sync center",
    failedBadge: (n: number) => `${n} download${n === 1 ? "" : "s"} failed`,
  },
};
```

Future i18n is a single-file replacement.

## Theming + tap target + accessibility

- **`SyncStatusCard.tsx`** (now `StatusSection.tsx` after the rename): every
  hardcoded hex literal is replaced with `useThemeColor(...)`. The
  status-to-token mapping is: success → `success`, warning → `warning`,
  danger → `danger`, info-blue → `accent`, muted-grey → `muted`. Dark mode
  uses the same code path; the `heroui-native` theme provider already
  supplies the resolved tokens.
- **`SyncCenter.tsx`** icon: outer `Pressable` grows from `w-9 h-9` (36 pt)
  to `w-11 h-11` (44 pt). The icon glyph stays 24 px (the wrapper just gains
  padding). Visually identical at a glance; meets HIG / Material minimums.
- **Badge accessibility:** the `accessibilityLabel` on the icon is computed
  from `COPY.iconA11y.base` plus `COPY.iconA11y.failedBadge(failed)` when
  `failed > 0`. Screen-reader users hear the count without seeing the red
  dot.
- **Route focus management:** `SyncCenterScreen` renders the title with
  `accessibilityRole="header"` and `accessibilityElementsHidden` set false on
  the title, true on the back button — TalkBack / VoiceOver lands on the
  title when the route mounts.
- **Color-only state:** Queue and Stuck rows prefix the title text with a
  glyph (✓ synced / ↑ upload / ↓ download / ⚠ stuck) so users who can't
  distinguish hue still parse the row type.

## Migration / rollout

Atomic swap inside one PR, no feature flag, no fallback.

### File deltas

**New files**

| Path | Purpose |
|---|---|
| `app/(main)/sync.tsx` | Route entry — thin wrapper, mirrors `academic-records.tsx` |
| `screens/main/SyncCenterScreen.tsx` | Composes the five sections + header |
| `features/sync/components/StatusSection.tsx` | Connection + activity + buttons |
| `features/sync/components/QueueSection.tsx` | Pending uploads + downloads list |
| `features/sync/components/StuckSection.tsx` | Stuck CRUD + failed attachments with Retry |
| `features/sync/components/EventsSection.tsx` | `sync_events_local` FlashList + Export |
| `features/sync/components/AdvancedSection.tsx` | Collapsed Streams + Storage |
| `features/sync/humanizeSyncError.ts` | Error translation |
| `features/sync/copy.ts` | Typed copy registry |
| `features/sync/syncEvents.ts` | `appendSyncEvent` + retention helpers |
| `features/sync/crudMeta.ts` | `recordCrudAttempt` / `clearCrudMeta` / `resetCrudMeta` |
| `features/sync/useSyncEvents.ts` | `useQuery` hook for Events |
| `features/sync/useStuckCrudOps.ts` | `useQuery` hook joining `ps_crud_meta_local` + `ps_crud` |

**Modified files**

| Path | Change |
|---|---|
| `powersync/system.ts` | Create both new tables in `setupPowerSync` |
| `powersync/Connector.ts` | `fetchOpWithAuthRetry` emits events; `uploadData` calls `recordCrudAttempt` / `clearCrudMeta` |
| `features/attachments/attachments.queue.ts` | `processOne` emits download events |
| `features/sync/components/SyncCenter.tsx` | `onPress` → `router.push("/sync")`; drops `useSyncSheet`; grows to 44 pt; badge a11y label |
| `features/sync/components/SyncStatusCard.tsx` | Hex → `useThemeColor`; moves into `StatusSection` (refactor in place) |
| `features/sync/components/StreamList.tsx` | Drop `__DEV__` guard |
| `features/sync/components/ForceSyncButton.tsx` | Toast copy via `humanizeSyncError`; lives inside `StatusSection` |
| `app/(main)/_layout.tsx` | Register `<Stack.Screen name="sync" />`; remove `SyncSheetProvider` wrap + `<SyncSheet />` mount |

**Deleted files**

| Path | Why |
|---|---|
| `features/sync/SyncSheetContext.tsx` | Route replaces the open/close state |
| `features/sync/components/SyncSheet.tsx` | Dialog shell is the thing being replaced |

### Rollout sequence

Each step compiles, type-checks, and runs against the old Dialog until step
7. Step 7 is the cutover.

1. **Data layer.** Create the two new tables in `setupPowerSync`. Add
   `syncEvents.ts` + `crudMeta.ts` helpers. No UI consumers yet.
2. **Producers.** Wire `Connector` + `attachmentQueue` to emit events and
   record CRUD attempts. Verify via Drizzle Studio queries.
3. **Translation + copy.** Land `humanizeSyncError.ts` + `copy.ts`.
   Standalone; no UI consumers yet.
4. **Section components.** Build the five leaf components bottom-up. Each
   wires its own `useQuery` hook.
5. **Screen + route.** Create `SyncCenterScreen` + `app/(main)/sync.tsx` +
   the `_layout.tsx` Stack registration. Route is reachable via direct
   navigation but the icon still opens the Dialog.
6. **Icon swap.** `SyncCenter` icon's `onPress` switches to `router.push`.
   Drops `useSyncSheet`. Grows to 44 pt. Adds badge a11y label. The old
   Dialog still exists but becomes unreachable through the UI.
7. **Atomic delete.** Remove `SyncSheetProvider`, `<SyncSheet />`,
   `SyncSheetContext.tsx`, `SyncSheet.tsx`. This is the cutover.
8. **Accessibility pass.** Focus target on route title, icon prefixes on
   Queue/Stuck rows, manual TalkBack/VoiceOver walk.

## Risks

| Risk | Mitigation |
|---|---|
| Hidden consumer of `useSyncSheet` outside the two known sites | Grep `useSyncSheet\|SyncSheetProvider\|SyncSheetContext` before step 7 — confirm only `SyncCenter`, `SyncSheet`, `SyncSheetContext`, and `_layout.tsx` are matches |
| `sync_events_local` writes contend with PowerSync upload loop | Helpers use `powersync.execute` (same surface as `attachments.watcher.ts`); writes are short, indexed, and outside any tight loop |
| Stuck section join is slow | `idx_ps_crud_meta_stuck` covers the WHERE; expected row count is 0-20 in steady state; FlashList virtualizes if it ever grows beyond a screen |
| Route entry while disconnected → blank state | `StatusSection` consumes the same `useSyncData` shape today's `SyncStatusCard` does; the offline rendering already works |
| FlashList in EventsSection re-renders on every new event | Event inserts are infrequent (a few per second at peak); FlashList's keyed diff is cheap on rows of <200 |
| `humanizeSyncError` swallows a useful technical detail | Original error remains in `sync_events_local.message` and in the console log; "Show details" toggle on Stuck rows surfaces the payload too |
| Export log includes sensitive content (record IDs, payloads) | The export is user-initiated and lands in the OS share sheet — same trust boundary as taking a screenshot of the screen. Document in the Export button label that the log includes recent sync activity |

## Verification

Manual smoke tests on a dev build. No automated test infrastructure exists
for the touched code paths in this repo (see PR 1 spec).

1. **Route reachability.** Tap the header icon. Confirm navigation to
   `/sync`. Back button returns to the previous screen.
2. **Status section.** Cycle through online/offline (airplane mode) and
   confirm the subtitle copy matches the state. Tap Reconnect; confirm the
   spinner appears and the Status updates after the SDK reconnects.
3. **Queue section.** Create a write while online (e.g. submit an answer);
   confirm a row appears briefly before the upload completes, then the
   "all caught up" empty state returns.
4. **Stuck section.** Force a CRUD 4xx by writing a row the server will
   reject (Drizzle Studio: set an invalid `passing_score_type`). Wait until
   `attempt_count` ≥ 5 in `ps_crud_meta_local`. Confirm:
   - Row appears in Stuck section with humanized error + raw details under
     "Show details."
   - Retry resets `attempt_count` to 0; PowerSync re-attempts on next cycle.
5. **Events section.** Trigger varied activity (write + read + force
   reconnect). Confirm events appear newest-first with correct glyph /
   status / duration. Tap Export; confirm OS share sheet opens with JSON.
6. **Advanced section.** Tap the disclosure; confirm the existing
   `StreamList` content renders. Storage row shows non-zero values.
7. **Icon a11y.** Enable VoiceOver / TalkBack. Confirm the icon announces
   "Sync center" base, and "N downloads failed" when the badge is visible.
8. **Tap target.** With the iOS Accessibility Inspector or Android's
   "Show taps" overlay, confirm the icon's tappable area is 44 × 44.
9. **Theming.** Switch to dark mode (or toggle `ThemeToggleButton`).
   Confirm Status section uses dark-mode tokens, not hex.
10. **No dialog left behind.** After step 7 of the rollout, search the diff
    for any remaining `SyncSheet`, `useSyncSheet`, `SyncSheetProvider`
    reference. Should be zero hits.

## Out of scope (deferred to future PRs)

- **Dismiss on Stuck rows.** Needs `getCrudBatch()` refactor +
  `abandoned_uploads_local`. Revisit when telemetry shows it's needed.
- **CRUD 4xx auto-classification.** Today the Stuck lane surfaces them; a
  future PR could decide to drop them from `ps_crud` automatically.
- **Sync history graph / storage chart / network-quality indicator.**
- **Stream-milestone events** (e.g. "initial sync of `student_attempts` complete"). The watcher does not emit `kind='stream'` events in this PR; revisit if support cases need that granularity.
- **`kind='connect'` events from `useStatus` transitions.** Listed in the producer table during brainstorming but deferred: wiring requires a top-level `useEffect` on PowerSync's connection-status hook, which is best added inside `PowerSyncProvider` rather than the sync feature. Bookmark for a follow-up; the Events log still surfaces auth and upload/download activity in the meantime.
- **i18n.** Copy registry makes it trivial; shipping i18n is its own
  project.
- **Server-side changes.** None required.

## References

- PR 1 spec: [2026-06-14-sync-retry-hygiene-design.md](2026-06-14-sync-retry-hygiene-design.md)
- PR 1 plan: [../plans/2026-06-14-sync-retry-hygiene.md](../plans/2026-06-14-sync-retry-hygiene.md)
- PR 1 smoke handoff: [../handoffs/2026-06-14-sync-retry-hygiene-smoke.md](../handoffs/2026-06-14-sync-retry-hygiene-smoke.md)
- PowerSync local-table pattern: `powersync/system.ts:46-65` (`attachments_local`)
- Route-as-thin-wrapper pattern: `app/(main)/profile/academic-records.tsx`
- Existing FlashList usage: `@shopify/flash-list` dep already present at
  `package.json:45`
