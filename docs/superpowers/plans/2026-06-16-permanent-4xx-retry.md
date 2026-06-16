# Permanent 4xx Retry Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No auto-commit:** Per user preference, this plan never stages or commits. After each task passes its checks, stop and let the user inspect/commit.

**Goal:** Classify per-op upload failures into permanent / stuck / transient at the Connector, drop permanent and stuck ops from PowerSync's queue so the queue no longer wedges on a single permanent 4xx, and surface drops to the user via a heroui-native danger toast at the moment of drop plus a durable Sync Center "Failed" section. Spec: [docs/superpowers/specs/2026-06-16-permanent-4xx-retry-design.md](../specs/2026-06-16-permanent-4xx-retry-design.md).

**Architecture:** Reuses the existing `ps_crud_meta_local` and `sync_events_local` tables — no new tables, no new event bus. The Connector marks dropped ops in `ps_crud_meta_local` (adds `dropped_at` and `target` columns), appends a `sync_events_local` row with the new `"dropped"` status, then calls `transaction.complete()` so PowerSync removes the op from its queue. A top-level `<DroppedOpToaster>` watches `sync_events_local` reactively and fires a danger toast on each new `"dropped"` row. A new `<FailedSection>` in Sync Center queries `ps_crud_meta_local WHERE dropped_at IS NOT NULL` and renders View + Dismiss-only entries.

**Tech Stack:** React Native + Expo, `@powersync/react-native` (reactive `useQuery`, local SQLite), TypeScript, heroui-native (Button, toast, theming), NativeWind, Biome (lint + format).

**Repo conventions honored:**
- Client typecheck: `npm run typecheck` (= `tsc --noEmit`). Client lint: `npm run lint` (= `biome check .`).
- No automated tests in this repo — verification is manual smoke testing per the matrix at the end of this plan.
- Staging and committing left to the user. Plan ends each task at a clean working tree ready for review.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `powersync/system.ts` | **Modify** | Add the two `ALTER TABLE ps_crud_meta_local ADD COLUMN` calls for `dropped_at` and `target`, idempotent via try/catch. |
| `features/sync/permanentStatuses.ts` | **Create** | `PERMANENT_STATUSES` set + `isPermanentStatus(status)` helper. Single-purpose pure module. |
| `features/sync/syncLabels.ts` | **Create** | `featureLabelFromTarget(target)` — maps `${table}/${id}` → human label. |
| `features/sync/syncEvents.ts` | **Modify** | `SyncEventStatus` union gains `"dropped"`. No other change. |
| `features/sync/crudMeta.ts` | **Modify** | Adds `readCrudMeta`, `markCrudOpDropped`, `dismissFailedOp`. Existing helpers untouched. |
| `powersync/Connector.ts` | **Modify** | Restructure the per-op catch block to classify failures and drop permanent / stuck ops instead of throwing. After-loop logic filters `succeededIds` for `clearCrudMeta`. |
| `features/sync/useStuckCrudOps.ts` | **Modify** | WHERE clause gains `AND m.dropped_at IS NULL`. |
| `features/sync/copy.ts` | **Modify** | New `failed` block with heading, empty state, Dismiss label, etc. |
| `features/sync/useFailedCrudOps.ts` | **Create** | Reactive `useQuery` returning Failed rows ordered by `dropped_at DESC`. |
| `features/sync/components/FailedSection.tsx` | **Create** | Mirror of `StuckSection.tsx`. Renders each Failed row with feature label, humanized error, HTTP status, dropped-at timestamp, Dismiss button. |
| `screens/main/SyncCenterScreen.tsx` | **Modify** | Mount `<FailedSection />` above `<StuckSection />`. |
| `features/sync/components/DroppedOpToaster.tsx` | **Create** | Null-rendering top-level component. Watches `sync_events_local` for new `"dropped"` rows and fires toasts. |
| `app/(main)/_layout.tsx` | **Modify** | Mount `<DroppedOpToaster />` once in the auth-gated Stack layout. |

Nothing else is touched. The Connector's existing 401-refresh path, attachment cache, and PowerSync upload queue semantics are unchanged.

---

## Task 1 — Verification of open spec assumptions

**Repo:** `client-mobile`
**Why first:** The spec lists four open verification items. Resolve them before touching code so the plan doesn't drift on a wrong premise.

**Files:** read-only.

- [ ] **Step 1: Confirm Sync Center mounts `StuckSection` at the expected file**

Run from the repo root:

```
grep -rn "StuckSection" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile --include="*.tsx" --include="*.ts"
```

Expected mount: `screens/main/SyncCenterScreen.tsx` includes both `import StuckSection from "@/features/sync/components/StuckSection";` and `<StuckSection />` inside the `<ScrollView>` body. If the import or render moved, record the new path — Task 12 will mount `FailedSection` next to it.

- [ ] **Step 2: Confirm app-root layout for `<DroppedOpToaster />`**

Read `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/(main)/_layout.tsx`. Confirm it is the auth-gated Stack layout (the file wraps `(tabs)`, `profile`, `course`, etc. under a single `<Stack>`). This is where Task 14 mounts the toaster.

If the layout has been split since the spec was written, prefer mounting the toaster as close to the `<Stack>` open tag as possible so it lives only while authenticated and unmounts on sign-out.

- [ ] **Step 3: Confirm the local-DB read API in use**

Run:

```
grep -rn "powersync.getAll\|powersync.getOptional" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile --include="*.ts" --include="*.tsx" | head -10
```

The spec mentioned `getOptional`; the codebase actually uses `getAll<T>(sql, params)` (verified in `features/attachments/attachments.watcher.ts:19,84`, `features/attachments/attachments.queue.ts:89`, `providers/PowerSyncProvider.tsx:45`). Use `getAll<T>(...)` and read `result[0] ?? null` in Task 6's `readCrudMeta`.

- [ ] **Step 4: Confirm `useStuckCrudOps` query shape**

Read `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/useStuckCrudOps.ts`. The current `WHERE` clause is `m.attempt_count >= ? OR datetime(m.first_failed_at) < datetime('now', ?)`. Task 8 will add `AND m.dropped_at IS NULL` and wrap the existing two clauses in parentheses to preserve precedence:

```
WHERE m.dropped_at IS NULL
  AND (m.attempt_count >= ?
       OR datetime(m.first_failed_at) < datetime('now', ?))
```

- [ ] **Step 5: Checkpoint for user review**

Working tree unchanged. Report findings from Steps 1–3 to the user. If any are blocking (e.g., the layout file split), treat them as prep before continuing.

---

## Task 2 — Schema migration: add `dropped_at` and `target` columns

**Files:**
- Modify: `powersync/system.ts`

- [ ] **Step 1: Read the existing CREATE TABLE block**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/powersync/system.ts`. Find the existing block (currently around line 93):

```ts
await powersync.execute(`
  CREATE TABLE IF NOT EXISTS ps_crud_meta_local (
    op_id            TEXT PRIMARY KEY,
    attempt_count    INTEGER NOT NULL DEFAULT 0,
    first_failed_at  TEXT,
    last_attempt_at  TEXT NOT NULL,
    last_error       TEXT,
    last_http_status INTEGER
  );
`);
await powersync.execute(
  `CREATE INDEX IF NOT EXISTS idx_ps_crud_meta_stuck ON ps_crud_meta_local (attempt_count, first_failed_at);`,
);
```

- [ ] **Step 2: Append two idempotent ALTER TABLE statements immediately after**

After the `CREATE INDEX` line, insert:

```ts
// Phase D (permanent 4xx retry handling): add two columns to track dropped
// ops. ALTER TABLE … ADD COLUMN is idempotent at the SQL level only on
// first install; on re-install SQLite errors with "duplicate column name",
// which we swallow. Any other error is rethrown.
const tryAddColumn = async (column: string) => {
  try {
    await powersync.execute(
      `ALTER TABLE ps_crud_meta_local ADD COLUMN ${column} TEXT;`,
    );
  } catch (err) {
    if (!String(err).toLowerCase().includes("duplicate column")) throw err;
  }
};
await tryAddColumn("dropped_at");
await tryAddColumn("target");
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
npm run typecheck
```

Expected: only the pre-existing 3 errors (unrelated to sync). No new errors.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: clean for `powersync/system.ts`.

- [ ] **Step 5: Runtime sanity (optional but recommended)**

If the dev client is currently running, force-reload it (`r` in Metro). The new ALTER TABLE statements run at PowerSync init. Inspect Metro logs for any "duplicate column" warnings (expected on devices where the table already exists — these are swallowed, no UI surface).

If you have a SQLite inspector tooled up, confirm `ps_crud_meta_local` now has both `dropped_at TEXT` and `target TEXT` columns.

- [ ] **Step 6: Checkpoint for user review**

One file modified. Stop. The user will inspect and commit.

---

## Task 3 — New: `features/sync/permanentStatuses.ts`

**Files:**
- Create: `features/sync/permanentStatuses.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * HTTP status codes that the Connector treats as permanently failed —
 * retrying the exact same payload cannot change the outcome. On first
 * occurrence, the op is dropped from PowerSync's CRUD queue, marked in
 * ps_crud_meta_local, and surfaced via a Sync Center Failed entry plus a
 * danger toast.
 *
 * 401 is intentionally absent — it's handled by Connector's
 * fetchOpWithAuthRetry silent-refresh path before reaching the classify
 * code.
 *
 * 409 is intentionally absent (treated as transient) — IdempotentLocalIdUpsertMixin
 * returns 409 on legitimate cross-user local_id collisions (which are
 * permanent), but 409 also fires on transient races. Safer to retry then
 * fall into the existing STUCK_ATTEMPT_CAP path.
 */
export const PERMANENT_STATUSES: ReadonlySet<number> = new Set([
  400, 403, 404, 410, 413, 415, 422,
]);

export function isPermanentStatus(status: number | null): boolean {
  return status != null && PERMANENT_STATUSES.has(status);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean for the new file (only the pre-existing 3 unrelated errors remain).

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

One new file. Stop.

---

## Task 4 — New: `features/sync/syncLabels.ts`

**Files:**
- Create: `features/sync/syncLabels.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * Map a Connector `target` string ("${table}/${id}") to a human-readable
 * feature label. Used by the dropped-op toast and the Failed section in
 * Sync Center. Unknown tables fall back to the raw table name rather than
 * crashing or showing `undefined` — visible enough that the gap is obvious
 * and we add an entry, but never a hard error.
 */

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

export function featureLabelFromTarget(target: string | null | undefined): string {
  if (!target) return "Sync";
  const table = target.split("/")[0];
  return TABLE_LABELS[table] ?? table;
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 3: Checkpoint for user review**

One new file. Stop.

---

## Task 5 — Extend `SyncEventStatus` with `"dropped"`

**Files:**
- Modify: `features/sync/syncEvents.ts`

- [ ] **Step 1: Replace the type definition**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/syncEvents.ts`. Find:

```ts
export type SyncEventStatus = "started" | "ok" | "fail";
```

Replace with:

```ts
export type SyncEventStatus = "started" | "ok" | "fail" | "dropped";
```

No other change to this file. Existing call sites continue to work; new emit sites in Task 7 pass `"dropped"`.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If any switch/exhaustive check fires because a consumer was matching only the old three values, that's a real coverage gap — surface it to the user before papering over. (None expected based on a `grep "SyncEventStatus"` across the repo.)

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

One file modified. Stop.

---

## Task 6 — Add `readCrudMeta`, `markCrudOpDropped`, `dismissFailedOp` in `crudMeta.ts`

**Files:**
- Modify: `features/sync/crudMeta.ts`

- [ ] **Step 1: Append the three new functions to the existing file**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/crudMeta.ts`. Append (after the existing `resetCrudMeta`):

```ts
/**
 * Snapshot of one ps_crud_meta_local row. Used by the Connector to read
 * attempt_count before deciding whether to drop a stuck op.
 */
export type CrudMetaRow = {
  attempt_count: number;
  dropped_at: string | null;
};

export async function readCrudMeta(opId: string): Promise<CrudMetaRow | null> {
  try {
    const rows = await powersync.getAll<CrudMetaRow>(
      `SELECT attempt_count, dropped_at FROM ps_crud_meta_local WHERE op_id = ?`,
      [opId],
    );
    return rows[0] ?? null;
  } catch (err) {
    console.warn("[crudMeta] readCrudMeta failed", err);
    return null;
  }
}

/**
 * Mark a CRUD op as permanently dropped from PowerSync's queue. INSERTs a
 * fresh meta row if one doesn't exist (defensive — the Connector usually
 * called recordCrudAttempt first, but markCrudOpDropped must be safe to call
 * standalone). UPDATEs an existing row's last_error / last_http_status /
 * target / dropped_at fields. attempt_count is left untouched on conflict so
 * the historical retry count survives for the Failed section to show.
 */
export async function markCrudOpDropped(
  opId: string,
  detail: { target: string | null; error: string; httpStatus: number | null },
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await powersync.execute(
      `INSERT INTO ps_crud_meta_local
         (op_id, attempt_count, first_failed_at, last_attempt_at, last_error, last_http_status, target, dropped_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(op_id) DO UPDATE SET
         last_error       = excluded.last_error,
         last_http_status = excluded.last_http_status,
         target           = excluded.target,
         dropped_at       = excluded.dropped_at`,
      [opId, now, now, detail.error, detail.httpStatus, detail.target, now],
    );
  } catch (err) {
    console.warn("[crudMeta] markCrudOpDropped failed", err);
  }
}

/**
 * User-tapped Dismiss on a Failed entry. Plain DELETE — no interaction with
 * PowerSync's queue (the op left the queue when transaction.complete() ran).
 */
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

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

One file modified. Stop.

---

## Task 7 — Modify `Connector.uploadData` to classify and drop

**Files:**
- Modify: `powersync/Connector.ts`

**Why this task is the heaviest:** this is the entire behavioural change. Every other task either feeds this one (utilities, helpers) or surfaces its output (UI). Take care.

- [ ] **Step 1: Read the current per-op catch block**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/powersync/Connector.ts`. Locate the `uploadData` method (around line 176) and inside it the per-op `try`/`catch` block (around line 312).

The current catch block:

```ts
} catch (opErr) {
  const httpStatus =
    opErr instanceof UploadOpError ? opErr.status : null;
  const message =
    opErr instanceof Error ? opErr.message : String(opErr);
  await appendSyncEvent({
    kind: "upload",
    target,
    status: "fail",
    httpStatus,
    message,
    durationMs: Date.now() - started,
  });
  await recordCrudAttempt(op.id, { error: message, httpStatus });
  throw opErr;
}
```

- [ ] **Step 2: Add new imports at the top**

Append to the existing imports near the top of `Connector.ts`:

```ts
import { STUCK_ATTEMPT_CAP, markCrudOpDropped, readCrudMeta } from "@/features/sync/crudMeta";
import { isPermanentStatus } from "@/features/sync/permanentStatuses";
```

`recordCrudAttempt`, `clearCrudMeta`, and `appendSyncEvent` are already imported — leave them.

- [ ] **Step 3: Add a `droppedIds` accumulator next to `opIds`**

Find the existing declaration inside `uploadData` (around line 200):

```ts
const opIds: string[] = [];
```

Add immediately after it:

```ts
const droppedIds: string[] = [];
```

- [ ] **Step 4: Replace the per-op catch block**

Replace the entire catch block from Step 1 with:

```ts
} catch (opErr) {
  const httpStatus =
    opErr instanceof UploadOpError ? opErr.status : null;
  const message =
    opErr instanceof Error ? opErr.message : String(opErr);

  // Record the attempt first so `readCrudMeta` below sees the just-incremented
  // count. Required for the stuck-cap classification path.
  await recordCrudAttempt(op.id, { error: message, httpStatus });

  const meta = await readCrudMeta(op.id);
  const attemptCount = meta?.attempt_count ?? 1;
  const shouldDrop =
    isPermanentStatus(httpStatus) || attemptCount >= STUCK_ATTEMPT_CAP;

  if (shouldDrop) {
    await markCrudOpDropped(op.id, {
      target,
      error: message,
      httpStatus,
    });
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

  await appendSyncEvent({
    kind: "upload",
    target,
    status: "fail",
    httpStatus,
    message,
    durationMs: Date.now() - started,
  });
  throw opErr;
}
```

- [ ] **Step 5: Replace the after-loop cleanup**

Find the existing post-loop code (the lines right after the `for (const op of transaction.crud) { … }` block):

```ts
// Mark as complete so it's removed from the local queue
await transaction.complete();
await clearCrudMeta(opIds);
```

Replace with:

```ts
// Mark as complete so the processed ops (succeeded or dropped) are
// removed from the local queue. Dropped meta rows survive because we
// filter them out of the clearCrudMeta call below — the Sync Center
// "Failed" section reads them via useFailedCrudOps.
await transaction.complete();
const succeededIds = opIds.filter((id) => !droppedIds.includes(id));
await clearCrudMeta(succeededIds);
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: clean (only the pre-existing 3 unrelated errors). If you get an import-cycle warning involving `crudMeta.ts`, surface it — `Connector.ts` already imports `recordCrudAttempt`/`clearCrudMeta` from there, so adding two more named imports from the same module should not trip a new cycle.

- [ ] **Step 7: Lint**

```bash
npm run lint
```

Expected: clean for `Connector.ts`.

- [ ] **Step 8: Checkpoint for user review**

One file modified. Stop. The behaviour change is in place but invisible until the UI tasks land — the user can still verify by triggering an upload and watching `ps_crud_meta_local` directly (SQLite inspector or a debug log added temporarily).

---

## Task 8 — Exclude dropped rows from `useStuckCrudOps`

**Files:**
- Modify: `features/sync/useStuckCrudOps.ts`

- [ ] **Step 1: Replace the SQL**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/useStuckCrudOps.ts`. Find the existing query:

```ts
return useQuery<StuckCrudOp>(
  `SELECT m.op_id,
          m.attempt_count,
          m.first_failed_at,
          m.last_attempt_at,
          m.last_error,
          m.last_http_status,
          c.data,
          c.tx_id
   FROM ps_crud_meta_local m
   JOIN ps_crud c ON c.id = m.op_id
   WHERE m.attempt_count >= ?
      OR datetime(m.first_failed_at) < datetime('now', ?)
   ORDER BY m.first_failed_at ASC`,
  [STUCK_ATTEMPT_CAP, `-${STUCK_AGE_HOURS} hours`],
);
```

Replace with:

```ts
return useQuery<StuckCrudOp>(
  `SELECT m.op_id,
          m.attempt_count,
          m.first_failed_at,
          m.last_attempt_at,
          m.last_error,
          m.last_http_status,
          c.data,
          c.tx_id
   FROM ps_crud_meta_local m
   JOIN ps_crud c ON c.id = m.op_id
   WHERE m.dropped_at IS NULL
     AND (m.attempt_count >= ?
          OR datetime(m.first_failed_at) < datetime('now', ?))
   ORDER BY m.first_failed_at ASC`,
  [STUCK_ATTEMPT_CAP, `-${STUCK_AGE_HOURS} hours`],
);
```

Two changes only: the `WHERE m.dropped_at IS NULL AND (…)` wrap. No type or signature changes.

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 3: Checkpoint for user review**

One file modified. Stop.

---

## Task 9 — Add `failed` strings to `features/sync/copy.ts`

**Files:**
- Modify: `features/sync/copy.ts`

- [ ] **Step 1: Insert a new `failed` block**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/copy.ts`. Locate the existing `stuck: { … }` block (around line 31). Immediately after the closing brace of `stuck`, before `events:`, insert:

```ts
  failed: {
    heading: "Failed",
    needsAttention: "won't retry",
    empty: "Nothing has been permanently dropped.",
    emptySubtitle: "If an upload can't recover, we'll list it here.",
    showDetails: "Show details",
    hideDetails: "Hide details",
    dismiss: "Dismiss",
    httpLabel: (status: number | null) => (status != null ? `HTTP ${status}` : "no response"),
    droppedAt: (relative: string) => `Dropped ${relative}`,
  },
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 3: Checkpoint for user review**

One file modified. Stop.

---

## Task 10 — New: `features/sync/useFailedCrudOps.ts`

**Files:**
- Create: `features/sync/useFailedCrudOps.ts`

- [ ] **Step 1: Create the file**

```ts
import { useQuery } from "@powersync/react-native";

export type FailedCrudOp = {
  op_id: string;
  target: string | null;
  last_error: string | null;
  last_http_status: number | null;
  attempt_count: number;
  dropped_at: string;
};

/**
 * Live-streaming query of CRUD ops that have been permanently dropped from
 * PowerSync's queue. Sorted newest-first so the most recent failure is at
 * the top of the Failed section.
 */
export function useFailedCrudOps() {
  return useQuery<FailedCrudOp>(
    `SELECT op_id,
            target,
            last_error,
            last_http_status,
            attempt_count,
            dropped_at
     FROM ps_crud_meta_local
     WHERE dropped_at IS NOT NULL
     ORDER BY dropped_at DESC`,
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 3: Checkpoint for user review**

One new file. Stop.

---

## Task 11 — New: `features/sync/components/FailedSection.tsx`

**Files:**
- Create: `features/sync/components/FailedSection.tsx`

The visual structure mirrors `StuckSection.tsx`. The differences: the row uses `dismissFailedOp` instead of `resetCrudMeta`, the badge says "won't retry" instead of "needs attention", the action button is `Dismiss` instead of `Retry`, and the row includes the `target`-derived feature label.

- [ ] **Step 1: Create the file**

```tsx
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, useThemeColor, useToast } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useFailedCrudOps, type FailedCrudOp } from "../useFailedCrudOps";
import { dismissFailedOp } from "../crudMeta";
import { humanizeSyncError } from "../humanizeSyncError";
import { featureLabelFromTarget } from "../syncLabels";
import { SYNC_COPY } from "../copy";
import { formatRelative } from "@/utils/getRelativeTime";

const FailedRow = ({ row }: { row: FailedCrudOp }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const humanized = humanizeSyncError({
    status: row.last_http_status,
    message: row.last_error ?? "",
  });
  const label = featureLabelFromTarget(row.target);
  const droppedRelative = formatRelative(new Date(row.dropped_at));

  const handleDismiss = useCallback(async () => {
    await dismissFailedOp(row.op_id);
    toast.show({
      variant: "default",
      label: "Dismissed",
      description: `${label} removed from the Failed list.`,
    });
  }, [row.op_id, label, toast]);

  return (
    <View className="rounded-xl border border-danger bg-danger-soft p-3 mb-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <AppText weight="semibold" className="text-sm text-danger">
            {label} · {humanized.message}
          </AppText>
          {humanized.hint && (
            <AppText className="text-xs text-danger mt-0.5 opacity-80">
              {humanized.hint}
            </AppText>
          )}
          <AppText className="text-xs text-muted mt-1">
            {SYNC_COPY.failed.httpLabel(row.last_http_status)} ·{" "}
            {SYNC_COPY.failed.droppedAt(droppedRelative)}
          </AppText>
        </View>
        <Button variant="ghost" size="sm" onPress={handleDismiss}>
          <Button.Label>{SYNC_COPY.failed.dismiss}</Button.Label>
        </Button>
      </View>

      <Pressable
        onPress={() => setShowDetails((v) => !v)}
        className="mt-2"
        accessibilityRole="button"
        accessibilityLabel={
          showDetails ? SYNC_COPY.failed.hideDetails : SYNC_COPY.failed.showDetails
        }
      >
        <AppText className="text-xs text-danger underline">
          {showDetails ? SYNC_COPY.failed.hideDetails : SYNC_COPY.failed.showDetails}
        </AppText>
      </Pressable>

      {showDetails && (
        <View className="mt-2 bg-surface rounded-md p-2">
          <AppText
            className="text-[10px] text-foreground"
            style={{ fontFamily: "monospace" }}
          >
            op_id: {row.op_id}
            {"\n"}target: {row.target ?? "(none)"}
            {"\n"}HTTP: {row.last_http_status ?? "—"}
            {"\n"}attempts: {row.attempt_count}
            {"\n"}error: {row.last_error ?? "(no message)"}
          </AppText>
        </View>
      )}
    </View>
  );
};

const FailedSection = () => {
  const { data: rows = [] } = useFailedCrudOps();
  const accentColor = useThemeColor("accent");

  if (rows.length === 0) {
    return (
      <View className="px-4 py-4">
        <AppText className="text-xs uppercase tracking-wider text-muted mb-2">
          {SYNC_COPY.failed.heading}
        </AppText>
        <View className="rounded-xl border border-border bg-surface p-4 items-center">
          <Icon name="CheckCircleIcon" size={24} color={accentColor} />
          <AppText weight="semibold" className="text-sm text-foreground mt-2">
            {SYNC_COPY.failed.empty}
          </AppText>
          <AppText className="text-xs text-muted mt-1 text-center">
            {SYNC_COPY.failed.emptySubtitle}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.failed.heading} · {rows.length}
        </AppText>
        <AppText className="text-xs text-danger">
          {SYNC_COPY.failed.needsAttention}
        </AppText>
      </View>
      {rows.map((row) => (
        <FailedRow key={row.op_id} row={row} />
      ))}
    </View>
  );
};

export default FailedSection;
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 3: Checkpoint for user review**

One new file. Stop.

---

## Task 12 — Mount `<FailedSection />` in Sync Center

**Files:**
- Modify: `screens/main/SyncCenterScreen.tsx`

- [ ] **Step 1: Add the import and render**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/screens/main/SyncCenterScreen.tsx`.

Add the import alongside the existing section imports (after `StuckSection`):

```ts
import FailedSection from "@/features/sync/components/FailedSection";
```

In the render, place `<FailedSection />` immediately **above** `<StuckSection />` so the more-urgent surface is visually higher (consistent with the "most actionable first" ordering in the Sync Center reimagine spec):

```tsx
<StatusSection />
<QueueSection />
<FailedSection />
<StuckSection />
<EventsSection />
<AdvancedSection />
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 3: Checkpoint for user review**

One file modified. Stop.

---

## Task 13 — New: `features/sync/components/DroppedOpToaster.tsx`

**Files:**
- Create: `features/sync/components/DroppedOpToaster.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useRef } from "react";
import { useQuery } from "@powersync/react-native";
import { useToast } from "heroui-native";
import { featureLabelFromTarget } from "../syncLabels";

type DroppedEvent = {
  target: string | null;
  message: string | null;
  http_status: number | null;
  ts: string;
};

/**
 * Top-level null-rendering component. Watches sync_events_local for new rows
 * with `status = 'dropped'` since mount, and fires a heroui-native danger
 * toast for each one. The cold-start filter (`ts > mountTime`) intentionally
 * suppresses replays of old events when the app launches — the user's
 * durable record is the Sync Center Failed section.
 *
 * Why a ref for `toast`: heroui-native's `toast.show()` / `toast.hide()`
 * close over the `toasts` state from the render where the callback was
 * created. If we captured `toast` in the closure of the `useEffect`, the
 * effect (which runs after data updates) would be holding a stale `toast`
 * by the time we want to call show(). The ref always points at the latest
 * toast object so show() reaches a fresh closure. Same pattern as
 * useProfilePhotoActionSheet.
 */
export function DroppedOpToaster() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const lastSeenRef = useRef<string>(new Date().toISOString());

  const { data } = useQuery<DroppedEvent>(
    `SELECT target, message, http_status, ts
     FROM sync_events_local
     WHERE status = 'dropped' AND ts > ?
     ORDER BY ts ASC`,
    [lastSeenRef.current],
  );

  useEffect(() => {
    if (!data?.length) return;
    for (const row of data) {
      const description =
        row.http_status != null
          ? `${row.message ?? "Upload failed"} (HTTP ${row.http_status})`
          : row.message ?? "Upload failed";
      toastRef.current.show({
        label: featureLabelFromTarget(row.target),
        description,
        variant: "danger",
      });
    }
    lastSeenRef.current = data[data.length - 1].ts;
  }, [data]);

  return null;
}

export default DroppedOpToaster;
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 3: Checkpoint for user review**

One new file. Stop.

---

## Task 14 — Mount `<DroppedOpToaster />` in the auth-gated layout

**Files:**
- Modify: `app/(main)/_layout.tsx`

- [ ] **Step 1: Read the current file**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/(main)/_layout.tsx`. The current shape returns a single `<Stack>` element. We need to render `<DroppedOpToaster />` as a sibling so it lives for the duration of the auth-gated tree.

- [ ] **Step 2: Add the import and wrap the return in a fragment**

Add to the imports:

```ts
import { DroppedOpToaster } from "@/features/sync/components/DroppedOpToaster";
```

Change the return to:

```tsx
return (
  <>
    <DroppedOpToaster />
    <Stack screenOptions={{ ...headerOptions, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* ... all existing Stack.Screen entries unchanged ... */}
      <Stack.Screen
        name="camera"
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  </>
);
```

`DroppedOpToaster` returns null, so its placement doesn't affect layout.

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

One file modified. Stop.

---

## Task 15 — End-to-end manual smoke test

**Files:** none modified.

Run after a Metro reload (`r` in the Metro terminal). No native rebuild required for these changes (all JS-side).

Connect to a dev backend (cloudflared tunnel against local Django, per the project's standard dev setup).

- [ ] **Step 1: Happy path (regression)**

Sign in → Profile tab → tap header avatar → drill into Profile Information → tap hero avatar → Choose from library → pick → crop → Done.

Expected:
- Avatar swaps; upload completes; Sync Center is empty in both Failed and Stuck sections.
- No danger toast.

- [ ] **Step 2: Permanent 4xx — drops on first attempt**

Temporarily edit `Connector.ts` line where it builds `instanceUrl`:

```ts
const instanceUrl = `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`;
```

Replace with:

```ts
const instanceUrl = `${env.EXPO_PUBLIC_API_URL}/${op.table}/9999999/`; // FORCE 404 for smoke test
```

Save. Trigger a photo change.

Expected within ~1s:
- Danger toast: label `Profile photo`, description `… (HTTP 404)`.
- Sync Center → Failed section shows the op with feature label, error, HTTP 404, dropped-at timestamp.

Revert the `instanceUrl` change. Trigger another photo change.

Expected:
- New upload succeeds; queue is **not** wedged by the previous failure.

Tap Dismiss on the Failed entry.

Expected: row disappears immediately, "Dismissed" toast confirms.

- [ ] **Step 3: Transient → stuck → drop**

Stop the dev backend (kill `manage.py runserver` or stop the cloudflared tunnel). Trigger a photo change.

Expected:
- Avatar swaps optimistically.
- Sync Center → Stuck section shows the op; `attempt_count` increments visibly on each retry (you may need to leave the app open and watch).
- After 5 attempts, the op crosses into Failed. A single danger toast fires at the cross-over. Stuck section no longer shows the op (the `AND dropped_at IS NULL` filter excludes it).

Re-start the backend before attempt 5.

Expected: the in-flight op succeeds, both Stuck and Failed sections empty. Self-heal confirmed.

- [ ] **Step 4: 401 carve-out**

Force a 401 (easiest: edit your local JWT in storage to be expired, OR temporarily change the access-token signing key on the server). Trigger an upload.

Expected: existing `fetchOpWithAuthRetry` silently refreshes and retries; upload completes; neither Stuck nor Failed shows anything. 401 is not in `PERMANENT_STATUSES`.

- [ ] **Step 5: Cross-feature regression**

Grade an activity submission (classroom flow) that triggers a multipart upload.

Expected: no behavior change. Op completes normally.

- [ ] **Step 6: Cold-start de-spam**

Trigger a permanent drop (re-apply the Step 2 hack, change photo, then revert). Immediately force-quit the app. Reopen.

Expected:
- No danger toast on launch.
- Sync Center → Failed section still shows the op (durable record).

- [ ] **Step 7: Theme + a11y**

Open Sync Center with at least one Failed entry. Toggle device theme between light and dark.

Expected: labels, danger styling, Dismiss button all re-theme correctly. (Heroui-native theme tokens drive the cascade.)

- [ ] **Step 8: Checkpoint for user review**

Manual test plan complete. Capture any unexpected findings as follow-ups. Working tree unchanged from Task 14 (modulo the temporary Step 2 hack which must be reverted before stopping).

---

## After-the-fact cleanup considerations (out of scope, captured for the user)

- The `featureLabelFromTarget` table mapping is hand-maintained. Adding a new table to PowerSync without updating the map is a silent gap — the label falls back to the raw table name. Worth a comment near the map noting "update here when adding a new uploadable table." A future enhancement could derive the map automatically from `attachments.config.ts` for the tables that have attachments.
- The Failed section uses the same `humanizeSyncError` helper as Stuck. If real-world failure modes call for different copy on the Failed path (e.g., emphasis on "this won't auto-retry"), extend the helper or branch in `FailedRow`.
- One-toast-per-drop can become noisy if many ops drop in the same cycle (e.g., a server-wide outage that hits a transient cap simultaneously). If observed, batch into a single "N items failed" toast — defer until real evidence.
- The Connector now reads `ps_crud_meta_local` once per failed op (`readCrudMeta`). That's a SQLite point lookup on a primary key — sub-millisecond. Worth noting but not optimizing.
