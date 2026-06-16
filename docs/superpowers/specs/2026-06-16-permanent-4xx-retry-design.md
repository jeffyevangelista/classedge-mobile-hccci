# Permanent 4xx Retry Handling

**Date:** 2026-06-16
**Status:** Design — pending implementation plan
**Touches (client):** `powersync/Connector.ts`, `powersync/system.ts`, `features/sync/crudMeta.ts`, `features/sync/syncEvents.ts`, `features/sync/useStuckCrudOps.ts`, the Sync Center screen that mounts `StuckSection`, the app-root layout. New: `features/sync/permanentStatuses.ts`, `features/sync/syncLabels.ts`, `features/sync/useFailedCrudOps.ts`, `features/sync/components/FailedSection.tsx`, `features/sync/components/DroppedOpToaster.tsx`.

## Goal

Stop the PowerSync upload queue from wedging on a permanent server reject. Today `Connector.uploadData()` re-queues *any* non-2xx response indefinitely, so a single op that returns a permanent 4xx (e.g., 400 from a malformed payload after a model change, 403 from a permission shift, 404 from a stale target id) blocks every CRUD op behind it from ever uploading. The fix classifies failures at the per-op catch site, drops permanent ones from PowerSync's queue, surfaces them to the user via a danger toast at the moment of drop *and* a durable "Failed" entry in Sync Center, and lets the user dismiss them when reviewed.

The user-facing affordance is intentionally minimal — View + Dismiss only. A 4xx means the request itself was wrong; a generic retry button would mostly produce a second "still failed" toast. The user investigates from the originating feature and re-takes the action there.

## Non-goals

- **No automatic retry of dropped ops.** Once an op is dropped from PowerSync's queue, it is gone — re-triggering the action via the original UI path is the user's recourse. The Failed entry is a receipt, not a re-fire button.
- **No deep-linking from Failed entries to the originating screen.** A per-table route map is a stale-link risk and adds maintenance burden. Defer until real-world feedback shows navigation friction is hurting users.
- **No exponential backoff.** Out of scope. The current per-cycle re-attempt cadence is preserved for transient failures; `STUCK_ATTEMPT_CAP` (5) provides the eventual-give-up safety net.
- **No per-feature local rollback hooks.** The natural PowerSync sync stream is the rollback — the server's authoritative state reasserts itself on the next download, the optimistic UI reverts, and the toast + Failed entry tell the user why.
- **No new dependencies.** Reuses `ps_crud_meta_local`, `sync_events_local`, heroui-native toast, the existing Sync Center scaffolding.
- **No batched "N items failed" toast.** First pass fires one toast per dropped op. If stack noise becomes a UX issue, batching is a follow-up.

## Architecture overview

The Connector classifies every per-op failure into three buckets, and **sync_events_local is the single source of truth** that the UI watches for both the toast and the Failed list.

```
                 [op fetch in Connector.uploadData]
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        HTTP 2xx          HTTP 4xx perm        Other failure
        (success)         {400, 403, 404,      (5xx, 408, 409,
              │            410, 413, 415,       429, network)
              │            422}                       │
              │                 │                     │
        append syncEvent  recordCrudAttempt        recordCrudAttempt
        status=ok            ↓                        ↓
              │            markCrudOpDropped     attempt_count
              │            (sets dropped_at)     >= STUCK_ATTEMPT_CAP?
              │            appendSyncEvent           │
              │            status=dropped       yes ─┴─ no
              │                 │                │       │
              │            continue loop       drop    throw
              │                                  │     (tx re-queues)
              │                                  │
              └──────────────────────────────────┘
                                │
                       transaction.complete()
                                │
                       clearCrudMeta(succeededIds)
                       (dropped meta rows survive)
```

**UI bridge.** A top-level `<DroppedOpToaster>` subscribes to `sync_events_local WHERE status = 'dropped' AND ts > <mountTime>` via PowerSync's reactive query. New rows fire a heroui-native danger toast. Sync Center's new `<FailedSection>` queries `ps_crud_meta_local WHERE dropped_at IS NOT NULL ORDER BY dropped_at DESC` and renders each row with feature label, error, HTTP status, timestamp, and a Dismiss button that `DELETE`s the meta row.

## What changes — client

### 1. New: `features/sync/permanentStatuses.ts`

```ts
export const PERMANENT_STATUSES = new Set<number>([
  400, 403, 404, 410, 413, 415, 422,
]);

export function isPermanentStatus(status: number | null): boolean {
  return status != null && PERMANENT_STATUSES.has(status);
}
```

401 is intentionally absent — it's handled by `fetchOpWithAuthRetry`'s silent-refresh path before reaching the classify code. 409 is intentionally transient because `IdempotentLocalIdUpsertMixin` returns 409 on legitimate cross-user `local_id` collisions, which are permanent, but 409 also fires on transient races; safer to retry then stuck.

### 2. New: `features/sync/syncLabels.ts`

```ts
const TABLE_LABELS: Record<string, string> = {
  accounts_profile: "Profile photo",
  activity_studentactivity: "Activity submission",
  subject_subject: "Subject photo",
  module_module: "Module file",
  activity_activity: "Activity",
  activity_questionchoice: "Question choice image",
  activity_activityquestion: "Question instruction",
  activity_retakerecorddetail: "Retake upload",
};

export function featureLabelFromTarget(target: string | null): string {
  if (!target) return "Sync";
  const table = target.split("/")[0];
  return TABLE_LABELS[table] ?? table;
}
```

Unknown tables get the raw table name as a fallback rather than crashing or showing `undefined`.

### 3. New: `features/sync/useFailedCrudOps.ts`

Mirrors `useStuckCrudOps.ts`. Returns an array of `{ id, target, error, httpStatus, droppedAt }` via PowerSync reactive `useQuery`:

```sql
SELECT op_id, last_error, last_http_status, dropped_at
FROM ps_crud_meta_local
WHERE dropped_at IS NOT NULL
ORDER BY dropped_at DESC
```

The `target` is not currently stored in `ps_crud_meta_local` — see §"What changes — client #5" for the `target` column addition.

### 4. New: `features/sync/components/FailedSection.tsx`

Visual mirror of `StuckSection.tsx`. Renders each Failed op:

- Feature label via `featureLabelFromTarget(target)`.
- Error message + HTTP status (`"<error>" · HTTP <status>`).
- "Dropped <relative time> ago" timestamp.
- Dismiss button → `DELETE FROM ps_crud_meta_local WHERE op_id = ?` via a small `dismissFailedOp(opId)` helper appended to `features/sync/crudMeta.ts`.

Empty state: don't render the section header when the list is empty.

### 5. New: `features/sync/components/DroppedOpToaster.tsx`

Null-rendering component. Mounted once at the app-root layout.

```tsx
export function DroppedOpToaster() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const lastSeenRef = useRef<string>(new Date().toISOString());

  const { data } = useQuery<{ target: string | null; message: string | null; http_status: number | null; ts: string }>(
    `SELECT target, message, http_status, ts FROM sync_events_local
     WHERE status = 'dropped' AND ts > ? ORDER BY ts ASC`,
    [lastSeenRef.current],
  );

  useEffect(() => {
    if (!data?.length) return;
    for (const row of data) {
      toastRef.current.show({
        label: featureLabelFromTarget(row.target),
        description: row.http_status != null
          ? `${row.message ?? "Upload failed"} (HTTP ${row.http_status})`
          : row.message ?? "Upload failed",
        variant: "danger",
      });
    }
    lastSeenRef.current = data[data.length - 1].ts;
  }, [data]);

  return null;
}
```

`lastSeenRef` is initialized at mount-time so old `"dropped"` events on cold start do not replay as toasts — the durable Sync Center record is the user's recourse for failures that happened before they last opened the app. `toastRef` uses the same stale-closure workaround the profile-photo orchestrator uses (heroui-native's `toast.hide` closes over the `toasts` state at render time, so a captured `toast` object goes stale the moment `show()` triggers a state update).

### 6. Modified: `powersync/Connector.ts`

Per-op catch block restructured. The current shape:

```ts
} catch (opErr) {
  const httpStatus = opErr instanceof UploadOpError ? opErr.status : null;
  const message = opErr instanceof Error ? opErr.message : String(opErr);
  await appendSyncEvent({ kind: "upload", target, status: "fail", httpStatus, message, durationMs });
  await recordCrudAttempt(op.id, { error: message, httpStatus });
  throw opErr;
}
```

becomes:

```ts
} catch (opErr) {
  const httpStatus = opErr instanceof UploadOpError ? opErr.status : null;
  const message = opErr instanceof Error ? opErr.message : String(opErr);
  await recordCrudAttempt(op.id, { error: message, httpStatus });

  const meta = await readCrudMeta(op.id);
  const shouldDrop =
    isPermanentStatus(httpStatus) ||
    (meta?.attempt_count ?? 0) >= STUCK_ATTEMPT_CAP;

  if (shouldDrop) {
    await markCrudOpDropped(op.id, { target, error: message, httpStatus });
    await appendSyncEvent({
      kind: "upload",
      target,
      status: "dropped",
      httpStatus,
      message,
      durationMs: Date.now() - started,
    });
    droppedIds.push(op.id);
    continue;
  }

  await appendSyncEvent({ kind: "upload", target, status: "fail", httpStatus, message, durationMs: Date.now() - started });
  throw opErr;
}
```

After the loop:

```ts
await transaction.complete();
const succeededIds = opIds.filter((id) => !droppedIds.includes(id));
await clearCrudMeta(succeededIds);
```

`droppedIds` is declared as a `string[]` next to `opIds` at the top of `uploadData`.

### 7. Modified: `powersync/system.ts` — schema migration

Immediately after the existing `CREATE TABLE IF NOT EXISTS ps_crud_meta_local …` block (currently around line 93):

```ts
try {
  await powersync.execute(
    `ALTER TABLE ps_crud_meta_local ADD COLUMN dropped_at TEXT;`,
  );
} catch (err) {
  // "duplicate column name" on re-install — swallow.
  if (!String(err).includes("duplicate column")) throw err;
}
try {
  await powersync.execute(
    `ALTER TABLE ps_crud_meta_local ADD COLUMN target TEXT;`,
  );
} catch (err) {
  if (!String(err).includes("duplicate column")) throw err;
}
```

`target` is added so the Failed list can show the feature label without joining `sync_events_local`. `markCrudOpDropped` writes both fields.

### 8. Modified: `features/sync/crudMeta.ts`

Adds three functions:

```ts
export async function readCrudMeta(opId: string): Promise<{
  attempt_count: number;
  dropped_at: string | null;
} | null> {
  const result = await powersync.getOptional(
    `SELECT attempt_count, dropped_at FROM ps_crud_meta_local WHERE op_id = ?`,
    [opId],
  );
  return result as any;
}

export async function markCrudOpDropped(
  opId: string,
  detail: { target: string | null; error: string; httpStatus: number | null },
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await powersync.execute(
      `INSERT INTO ps_crud_meta_local
         (op_id, attempt_count, last_attempt_at, last_error, last_http_status, target, dropped_at)
       VALUES (?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT(op_id) DO UPDATE SET
         last_error       = excluded.last_error,
         last_http_status = excluded.last_http_status,
         target           = excluded.target,
         dropped_at       = excluded.dropped_at`,
      [opId, now, detail.error, detail.httpStatus, detail.target, now],
    );
  } catch (err) {
    console.warn("[crudMeta] markCrudOpDropped failed", err);
  }
}

export async function dismissFailedOp(opId: string): Promise<void> {
  try {
    await powersync.execute(
      `DELETE FROM ps_crud_meta_local WHERE op_id = ?`,
      [opId],
    );
  } catch (err) {
    console.warn("[crudMeta] dismissFailedOp failed", err);
  }
}
```

### 9. Modified: `features/sync/syncEvents.ts`

```ts
export type SyncEventStatus = "started" | "ok" | "fail" | "dropped";
```

That's the only change. Existing call sites continue to work; new emit sites pass `"dropped"`.

### 10. Modified: `features/sync/useStuckCrudOps.ts`

Its `WHERE` clause gains `AND dropped_at IS NULL` so an op that has crossed into Failed is no longer double-counted in Stuck.

### 11. Modified: Sync Center screen

Wherever `StuckSection` is mounted, mount `<FailedSection />` adjacent to it — Failed above Stuck so the more-urgent surface is visually higher (per the established "most actionable first" convention in the Sync Center reimagine spec).

### 12. Modified: app-root layout

`app/(main)/_layout.tsx` (or whichever file mounts the auth-gated provider tree) mounts `<DroppedOpToaster />` once. It returns null, so placement is style-neutral.

## Data flow — step by step

### Permanent 4xx drop

1. Connector fetches `PATCH /api/accounts_profile/14/`. Server returns 400 with `{"detail": "..."}`.
2. `UploadOpError(label, 400, body)` is thrown from `fetchAndLog`.
3. Per-op catch: `recordCrudAttempt` increments `attempt_count` to 1.
4. `isPermanentStatus(400)` returns true → `markCrudOpDropped` sets `dropped_at = now`, `target = "accounts_profile/14"`, `last_error` + `last_http_status` populated.
5. `appendSyncEvent({ status: "dropped", httpStatus: 400, message: "...", target: "accounts_profile/14" })`.
6. `droppedIds.push(op.id)`. Loop `continue`.
7. Loop completes. `transaction.complete()` removes the dropped op from PowerSync's queue. `clearCrudMeta(succeededIds)` does not include the dropped id, so the meta row survives.
8. `<DroppedOpToaster>` `useQuery` re-fires with the new event row. A danger toast appears: "Profile photo · Upload failed (HTTP 400)".
9. Sync Center "Failed" section now lists the op. User taps Dismiss → `dismissFailedOp(op.id)` `DELETE`s the meta row. Section updates immediately via reactive query.

### Transient → stuck → drop

1. Network is down. Each upload cycle, `fetchAndLog` rethrows a raw fetch error (typically `TypeError` on React Native, not an `UploadOpError`), so `httpStatus` resolves to `null` in the per-op catch.
2. Per-op catch: `recordCrudAttempt` bumps `attempt_count`. `isPermanentStatus(null)` is false. `attempt_count` checked.
3. For attempts 1–4: `attempt_count < STUCK_ATTEMPT_CAP` → `appendSyncEvent({ status: "fail" })`, `throw` → PowerSync re-queues tx.
4. On attempt 5: `attempt_count >= STUCK_ATTEMPT_CAP` → drop path runs. Op is gone from PowerSync's queue. Toast fires (once, on the cross-over). The toast description omits the HTTP status when it's `null`.

### Successful upload (no regression)

1. Per-op success path: `appendSyncEvent({ status: "ok" })`. Loop continues normally.
2. After loop: `transaction.complete()`, `clearCrudMeta(succeededIds)` deletes the meta row (no `dropped_at` to preserve).

## Error handling

| Failure | Behaviour |
|---|---|
| Multi-op tx, some drop / some succeed | Loop continues past drops; succeeded ops append `"ok"` events; `transaction.complete()` fires once; `clearCrudMeta(succeededIds)` preserves dropped meta. |
| Multi-op tx, some drop / one transient-fails | Transient throw aborts loop → tx re-queued. Dropped ops come back next cycle, reclassified permanent (or already-`dropped_at`), `markCrudOpDropped` idempotently refreshes. Eventually drains. |
| App killed mid-transaction | `transaction.complete()` never ran → PowerSync re-queues full tx on next launch. Same self-correcting behaviour as transient-mixed case. |
| Drop before `<DroppedOpToaster>` mounts | `ts > mountTime` filter skips it. Durable record in Sync Center is the recourse. Documented trade-off. |
| Multiple drops in same tick | `useQuery` returns the batch in one update; one toast per row (stacks). Batching is a follow-up. |
| Unknown table in `featureLabelFromTarget` | Falls back to raw table name. |
| Drop-then-succeed race | If a dropped op is re-attempted (because tx re-queued for another transient reason) and succeeds, `clearCrudMeta(succeededIds)` deletes it — Failed list loses the stale entry. Self-correcting. |
| `ALTER TABLE` on re-install | "duplicate column name" caught and swallowed; logs only on unexpected errors. |
| Dismiss while server thinks otherwise | Plain `DELETE` on local meta row, no interaction with the PowerSync queue. Safe. |

## Testing

No client unit test infrastructure. Manual smoke matrix:

**Happy path (regression).**

1. Online → change profile photo. Op uploads; avatar swaps via cached URL. Sync Center is empty in both Stuck and Failed.

**Permanent 4xx — drops on first attempt.**

2. Force a 404 by editing `Connector.ts` locally to PATCH a non-existent `accounts_profile/<bogus>/`, then trigger a photo change.
   - Sync Center "Failed" lists the op within ~1s with feature label "Profile photo", error message, HTTP 404, timestamp.
   - Danger toast fires within ~1s with the same label + HTTP 404.
   - A second photo change drains normally — the queue is not wedged.
3. Tap Dismiss on the Failed entry → row disappears immediately.

**Transient → eventually drops via attempt cap.**

4. Stop the dev server. Change profile photo while offline-from-the-server.
   - Stuck section incrementally shows attempt count rising.
   - At attempt 5, the row moves to Failed with the network error. One toast fires at the cross-over.
5. Re-start the server before attempt 5 → op succeeds, both sections empty. (Self-heal.)

**401 carve-out.**

6. Revoke the access token server-side. Trigger an upload. Existing `fetchOpWithAuthRetry` silently refreshes and retries — no Stuck, no Failed.

**Cross-feature regression.**

7. Grade an activity submission (classroom flow). Connector handles its multipart PATCH the same way. Expected: no behavior change.

**Cold-start de-spam.**

8. Trigger a permanent drop. Force-quit the app immediately. Reopen — toaster should not re-toast the old event. Sync Center Failed still shows it.

**Theme + a11y.**

9. Flip theme while Sync Center is open with Failed entries — labels, danger styling, Dismiss button re-theme correctly.

**Acceptance criteria.**

- A single permanent 4xx never wedges the queue — subsequent unrelated ops drain immediately.
- Every drop produces a durable Sync Center entry plus an in-app toast (if foregrounded).
- No regressions in the photo or classroom upload flows.
- Existing Stuck UI continues to work and no longer shows ops that have crossed into Failed.

## Open verification before implementation

1. Confirm the file that mounts `StuckSection` in Sync Center (likely `features/sync/components/SyncCenter.tsx` or a screen file) — the plan will add `<FailedSection />` next to it.
2. Confirm the app-root layout that should host `<DroppedOpToaster />` (likely `app/(main)/_layout.tsx` so it lives only when authenticated).
3. Verify PowerSync's `getOptional` API used in `readCrudMeta` exists on the installed `@powersync/react-native` version; if not, use `execute` + `rows._array[0]` instead.
4. Confirm `useStuckCrudOps.ts` query shape so the `AND dropped_at IS NULL` clause is a clean drop-in.
