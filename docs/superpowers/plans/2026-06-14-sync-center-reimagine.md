# Sync Center Reimagine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No auto-commit:** Per user preference, this plan never stages or commits. After each task passes its checks, stop and let the user inspect/commit.

**Goal:** Replace the modal `SyncSheet` with a full-screen `/sync` route that adds visibility for pending uploads, stuck operations, and a 200-row sync event log; ship the theming, copy, and accessibility polish PR 1 deferred. Spec: [docs/superpowers/specs/2026-06-14-sync-center-reimagine-design.md](../specs/2026-06-14-sync-center-reimagine-design.md).

**Architecture:** Two new PowerSync-managed local tables (`sync_events_local` ring buffer, `ps_crud_meta_local` stuck-op sidecar) feed `useQuery` hooks read by five new section components composed inside a `SyncCenterScreen`. The header icon switches from opening a Dialog to navigating to the new route. Producers (Connector CRUD, attachment queue, silent refresh) emit events bottom-up; sections compose top-down. The old Dialog stays functional until step 16 of the plan; the cutover is a single atomic delete.

**Tech Stack:** React Native, TypeScript, Expo Router, `@powersync/react-native`, `@shopify/flash-list`, `@paralleldrive/cuid2`, `expo-file-system`, `expo-sharing` (already a transitive of Expo), Biome (lint + format).

**Repo conventions honored:**

- Typecheck via `npm run typecheck` (= `tsc --noEmit`).
- Lint via `npm run lint` (= `biome check .`). **Never `npm run lint:fix`** — in PR 1 a stray `lint:fix` run auto-formatted 193 unrelated files. If Biome reports a fix, apply it by editing the touched file manually, not via `--write`.
- No automated tests in this repo. Each task's verification is typecheck + lint scope + manual inspection.
- Staging and committing left to the user. Plan ends each task at a clean working tree ready for review.

**Baseline pre-existing typecheck errors (NOT regressions):**

- `features/classroom/components/CreateClassroomActivityForm.tsx:184:22` — route type mismatch.
- `features/classroom/components/StudentScoreItem.tsx:119:7` — `hasImage` used before declaration (TS2448 + TS2454).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `powersync/system.ts` | **Modify** | `setupPowerSync` creates `sync_events_local` and `ps_crud_meta_local` alongside `attachments_local`. |
| `features/sync/syncEvents.ts` | **Create** | `appendSyncEvent` helper. Insert + 200-row trim in one transaction. Defines `SYNC_EVENT_CAP` and the event-row types. |
| `features/sync/crudMeta.ts` | **Create** | `recordCrudAttempt`, `clearCrudMeta`, `resetCrudMeta`. Defines `STUCK_ATTEMPT_CAP` and `STUCK_AGE_HOURS`. |
| `features/sync/humanizeSyncError.ts` | **Create** | `humanizeSyncError(err) → { message, hint? }` translation. |
| `features/sync/copy.ts` | **Create** | Single typed copy registry for the route. |
| `features/sync/useSyncEvents.ts` | **Create** | `useQuery` hook for `EventsSection`. |
| `features/sync/useStuckCrudOps.ts` | **Create** | `useQuery` hook joining `ps_crud_meta_local` with `ps_crud` for `StuckSection`. |
| `features/sync/components/StatusSection.tsx` | **Create** | Connection/activity/buttons + context-aware subtitle. Subsumes `SyncStatusCard`. |
| `features/sync/components/QueueSection.tsx` | **Create** | Pending uploads + in-flight downloads list. |
| `features/sync/components/StuckSection.tsx` | **Create** | Failed-permanently CRUD + failed attachments with Retry + Show details. |
| `features/sync/components/EventsSection.tsx` | **Create** | FlashList over `sync_events_local` + Export. |
| `features/sync/components/AdvancedSection.tsx` | **Create** | Collapsed disclosure wrapping `StreamList` + storage row. |
| `screens/main/SyncCenterScreen.tsx` | **Create** | Composes sections + back-button header. |
| `app/(main)/sync.tsx` | **Create** | Thin route wrapper. |
| `powersync/Connector.ts` | **Modify** | `fetchOpWithAuthRetry` emits events; `uploadData` records/clears CRUD meta. |
| `features/attachments/attachments.queue.ts` | **Modify** | `processOne` emits download events. |
| `features/auth/useTokenRefresh.ts` | **Modify** | `silentRefresh` emits auth events on success/failure. |
| `features/sync/components/SyncCenter.tsx` | **Modify** | `onPress` → `router.push("/sync")`; drops `useSyncSheet`; 36→44 pt; badge a11y label. |
| `features/sync/components/StreamList.tsx` | **Modify** | Drop `__DEV__` guard. |
| `features/sync/components/ForceSyncButton.tsx` | **Modify** | Toast copy via `humanizeSyncError`. |
| `app/(main)/_layout.tsx` | **Modify** | Register `<Stack.Screen name="sync" />`; remove `SyncSheetProvider` + `<SyncSheet />`. |
| `features/sync/SyncSheetContext.tsx` | **Delete** | Replaced by route navigation. |
| `features/sync/components/SyncSheet.tsx` | **Delete** | Replaced by the route. |
| `features/sync/components/SyncStatusCard.tsx` | **Delete** | Logic moves into `StatusSection`. |

---

## Task 1 — Create the two new local tables

**Files:**
- Modify: `powersync/system.ts`

**Why first:** Every other task depends on these tables existing. They are local-only (not in `AppSchema.ts`), so the only place to create them is `setupPowerSync`.

- [ ] **Step 1: Add the two `CREATE TABLE IF NOT EXISTS` statements**

Open `powersync/system.ts`. Find `setupPowerSync` (around line 46). After the existing `attachments_local` `CREATE TABLE` and its index, **before** the `const connector = new Connector();` line, insert:

```ts
  await powersync.execute(`
    CREATE TABLE IF NOT EXISTS sync_events_local (
      id          TEXT PRIMARY KEY,
      ts          TEXT NOT NULL,
      kind        TEXT NOT NULL,
      target      TEXT,
      status      TEXT NOT NULL,
      http_status INTEGER,
      message     TEXT,
      duration_ms INTEGER,
      retry_count INTEGER
    );
  `);
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_sync_events_ts ON sync_events_local (ts DESC);`,
  );

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

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: only the two pre-existing baseline errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean for `powersync/`.

- [ ] **Step 4: Smoke-verify the tables actually got created**

This step is optional but useful: run a dev build (`npm run start:dev` + `npm run ios`), sign in, then open Drizzle Studio and confirm `sync_events_local` and `ps_crud_meta_local` appear in the schema list with the expected columns. If you're skipping the device check, move on.

- [ ] **Step 5: Checkpoint for user review**

Stop. User inspects + commits.

---

## Task 2 — `syncEvents.ts` helper

**Files:**
- Create: `features/sync/syncEvents.ts`

**Why:** Centralizes the insert-and-trim transaction so producers don't reinvent it. Defines the event shape used by Task 3 (`Connector`), Task 6 (`queue`), and Task 7 (`silentRefresh`).

- [ ] **Step 1: Create the helper file**

Create `features/sync/syncEvents.ts`:

```ts
import { createId } from "@paralleldrive/cuid2";
import { powersync } from "@/powersync/system";

export const SYNC_EVENT_CAP = 200;

export type SyncEventKind =
  | "upload"
  | "download"
  | "auth"
  | "connect"
  | "stream";

export type SyncEventStatus = "started" | "ok" | "fail";

export type SyncEventInput = {
  kind: SyncEventKind;
  target?: string | null;
  status: SyncEventStatus;
  httpStatus?: number | null;
  message?: string | null;
  durationMs?: number | null;
  retryCount?: number | null;
};

export type SyncEventRow = {
  id: string;
  ts: string;
  kind: SyncEventKind;
  target: string | null;
  status: SyncEventStatus;
  http_status: number | null;
  message: string | null;
  duration_ms: number | null;
  retry_count: number | null;
};

/**
 * Append one row to `sync_events_local` and trim to `SYNC_EVENT_CAP` newest
 * rows in a single write transaction. Telemetry failures are swallowed so
 * the calling sync path is never broken by a logging error.
 */
export async function appendSyncEvent(input: SyncEventInput): Promise<void> {
  const id = createId();
  const ts = new Date().toISOString();
  try {
    await powersync.writeTransaction(async (tx) => {
      await tx.execute(
        `INSERT INTO sync_events_local
          (id, ts, kind, target, status, http_status, message, duration_ms, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ts,
          input.kind,
          input.target ?? null,
          input.status,
          input.httpStatus ?? null,
          input.message ?? null,
          input.durationMs ?? null,
          input.retryCount ?? null,
        ],
      );
      await tx.execute(
        `DELETE FROM sync_events_local WHERE id IN (
           SELECT id FROM sync_events_local ORDER BY ts ASC
           LIMIT MAX(0, (SELECT COUNT(*) FROM sync_events_local) - ?)
         )`,
        [SYNC_EVENT_CAP],
      );
    });
  } catch (err) {
    console.warn("[syncEvents] appendSyncEvent failed", err);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: only the two pre-existing baseline errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

Stop.

---

## Task 3 — `crudMeta.ts` helper

**Files:**
- Create: `features/sync/crudMeta.ts`

**Why:** Centralizes the meta writes that Task 5 (`Connector`) emits and Task 11 (`StuckSection`) reads.

- [ ] **Step 1: Create the helper file**

Create `features/sync/crudMeta.ts`:

```ts
import { powersync } from "@/powersync/system";

export const STUCK_ATTEMPT_CAP = 5;
export const STUCK_AGE_HOURS = 24;

export type CrudAttemptResult = {
  error: string;
  httpStatus: number | null;
};

/**
 * Record one CRUD upload attempt against `ps_crud_meta_local`. INSERTs on
 * first failure (sets `first_failed_at`), bumps `attempt_count` on
 * subsequent failures. Idempotent — safe to call from any failure path.
 */
export async function recordCrudAttempt(
  opId: string,
  result: CrudAttemptResult,
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await powersync.execute(
      `INSERT INTO ps_crud_meta_local
         (op_id, attempt_count, first_failed_at, last_attempt_at, last_error, last_http_status)
       VALUES (?, 1, ?, ?, ?, ?)
       ON CONFLICT(op_id) DO UPDATE SET
         attempt_count    = attempt_count + 1,
         last_attempt_at  = excluded.last_attempt_at,
         last_error       = excluded.last_error,
         last_http_status = excluded.last_http_status`,
      [opId, now, now, result.error, result.httpStatus],
    );
  } catch (err) {
    console.warn("[crudMeta] recordCrudAttempt failed", err);
  }
}

/**
 * Drop meta rows for ops that just completed successfully. Called from the
 * Connector's transaction-complete path with the full set of ops in the
 * transaction.
 */
export async function clearCrudMeta(opIds: string[]): Promise<void> {
  if (opIds.length === 0) return;
  const placeholders = opIds.map(() => "?").join(",");
  try {
    await powersync.execute(
      `DELETE FROM ps_crud_meta_local WHERE op_id IN (${placeholders})`,
      opIds,
    );
  } catch (err) {
    console.warn("[crudMeta] clearCrudMeta failed", err);
  }
}

/**
 * Manual retry from the Stuck section: zero `attempt_count` and clear the
 * failure-history fields. PowerSync's next upload cycle re-attempts the op.
 */
export async function resetCrudMeta(opId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await powersync.execute(
      `UPDATE ps_crud_meta_local
       SET attempt_count    = 0,
           first_failed_at  = NULL,
           last_error       = NULL,
           last_http_status = NULL,
           last_attempt_at  = ?
       WHERE op_id = ?`,
      [now, opId],
    );
  } catch (err) {
    console.warn("[crudMeta] resetCrudMeta failed", err);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

Stop.

---

## Task 4 — `humanizeSyncError.ts` + `copy.ts`

**Files:**
- Create: `features/sync/humanizeSyncError.ts`
- Create: `features/sync/copy.ts`

**Why:** Both are standalone, no other code depends on them yet. Landing them together avoids a "translation file with no consumers" intermediate state.

- [ ] **Step 1: Create the copy registry**

Create `features/sync/copy.ts`:

```ts
/**
 * Single source of truth for every user-facing string in the Sync Center
 * route. Future i18n is a one-place swap.
 */
export const SYNC_COPY = {
  routeTitle: "Sync Center",
  lastSyncedNever: "Never synced",
  lastSyncedRelative: (relative: string) => `Last sync · ${relative}`,

  status: {
    syncing: "Sending your recent changes…",
    synced: "Your work is saved and synced to the cloud.",
    downloading: "Loading the latest data from your courses.",
    offline: "You're offline. We'll sync automatically when you reconnect.",
    offlineWithPending: (n: number) =>
      `You're offline. ${n} item${n === 1 ? "" : "s"} saved here will send when you're back online.`,
    lowStorage:
      "Your device is low on space. New downloads are paused until you free up storage.",
    connecting: "Reconnecting to the cloud…",
    reconnect: "Reconnect",
  },

  queue: {
    heading: "Queue",
    empty: "You're all caught up.",
    emptySubtitle: "Nothing is waiting to sync right now.",
    uploadRow: (table: string, op: string) => `↑ ${table} · ${op}`,
    downloadRow: (resource: string) => `↓ ${resource}`,
  },

  stuck: {
    heading: "Stuck",
    needsAttention: "needs attention",
    empty: "No problems to fix.",
    emptySubtitle: "If something gets stuck, you'll see it here.",
    showDetails: "Show details",
    hideDetails: "Hide details",
    retry: "Retry",
    attempts: (n: number) => `${n} attempt${n === 1 ? "" : "s"}`,
    firstFailed: (relative: string) => `First failed ${relative}`,
  },

  events: {
    heading: "Events",
    subheading: "Last 200 sync events",
    empty: "No recent sync activity.",
    loadOlder: "Load older",
    export: "Export log",
  },

  advanced: {
    heading: "Advanced",
    streamsHeading: "Sync streams",
    storageHeading: "Storage",
    storageRow: (usedMb: string, freeMb: string) =>
      `${usedMb} MB used by attachments · ${freeMb} MB free on device`,
    streamSyncedBadge: "synced",
    streamPendingBadge: "pending",
  },

  iconA11y: {
    base: "Sync center",
    failedBadge: (n: number) =>
      `, ${n} download${n === 1 ? "" : "s"} failed`,
  },
} as const;
```

- [ ] **Step 2: Create the translation helper**

Create `features/sync/humanizeSyncError.ts`:

```ts
import { AttachmentFetchError } from "@/features/attachments/attachments.fetcher";
import { UploadOpError } from "@/powersync/Connector";

export type HumanizedSyncError = {
  /** One sentence the user can read at a glance. */
  message: string;
  /** Optional next-action hint. */
  hint?: string;
};

type StatusLike = { status?: number | null };

const hasStatus = (err: unknown): err is StatusLike =>
  typeof err === "object" && err !== null && "status" in err;

const isNetworkError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("enotfound") ||
    m.includes("offline")
  );
};

const isOutOfSpace = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("enospc") || m.includes("no space");
};

/**
 * Translate any sync-path error into a user-facing message and optional hint.
 * The original error is NOT discarded — it stays in `sync_events_local` and
 * in console logs for diagnostics.
 */
export function humanizeSyncError(err: unknown): HumanizedSyncError {
  if (isOutOfSpace(err)) {
    return {
      message: "Your device is low on space.",
      hint: "Free up some storage to download new files.",
    };
  }

  if (isNetworkError(err)) {
    return {
      message: "You're offline. Your work is saved on this device.",
      hint: "We'll send it when you reconnect.",
    };
  }

  const status =
    err instanceof UploadOpError
      ? err.status
      : err instanceof AttachmentFetchError
        ? err.status
        : hasStatus(err)
          ? (err.status ?? null)
          : null;

  if (status === 401) {
    return {
      message: "Your session needs to be renewed.",
      hint: "Sign out and back in if this keeps happening.",
    };
  }
  if (status === 403) {
    return {
      message: "You don't have permission to do this.",
      hint: "Contact your school admin if you think this is a mistake.",
    };
  }
  if (status === 404) {
    if (err instanceof AttachmentFetchError) {
      return { message: "This file is no longer available on the server." };
    }
    return {
      message:
        "The record we're trying to update no longer exists on the server.",
    };
  }
  if (status === 413) {
    return {
      message: "This upload is too large.",
      hint: "Try removing or resizing the file.",
    };
  }
  if (status === 400 || status === 422) {
    return {
      message: "The server didn't accept this update.",
      hint: "Try again, or contact support if it keeps happening.",
    };
  }
  if (status !== null && status >= 500) {
    return {
      message: "The server is having trouble right now.",
      hint: "We'll keep retrying automatically.",
    };
  }

  return {
    message: "Something went wrong syncing this.",
    hint: "Tap Retry, or check the Events tab for details.",
  };
}
```

- [ ] **Step 3: Export `UploadOpError` from `Connector.ts`**

Open `powersync/Connector.ts`. Find the existing `class UploadOpError extends Error` declaration (around line 53). Change `class` to `export class`:

```ts
export class UploadOpError extends Error {
```

Nothing else changes in `Connector.ts` for this step — we're just letting `humanizeSyncError.ts` import it.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors. The `export class UploadOpError` re-export does not affect any other consumer (the class isn't currently imported anywhere outside its file).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Checkpoint for user review**

Stop.

---

## Task 5 — Wire `Connector` to emit events + record meta

**Files:**
- Modify: `powersync/Connector.ts`

**Why:** This is the producer that fills `sync_events_local` with upload events and `ps_crud_meta_local` with attempt counts. After this task, the Connector is observable.

- [ ] **Step 1: Add imports**

Open `powersync/Connector.ts`. At the top of the file, alongside existing imports, add:

```ts
import { appendSyncEvent } from "@/features/sync/syncEvents";
import { clearCrudMeta, recordCrudAttempt } from "@/features/sync/crudMeta";
```

Keep all other imports as they are.

- [ ] **Step 2: Wrap each op in `uploadData` with timing + event emission**

Open `Connector.uploadData` (around line 140). The current shape is:

```ts
try {
  for (const op of transaction.crud) {
    // ... setup ...
    switch (op.op) {
      case UpdateType.PUT: /* ... */ break;
      case UpdateType.PATCH: /* ... */ break;
      case UpdateType.DELETE: /* ... */ break;
    }
  }
  await transaction.complete();
} catch (error) {
  console.error("Upload failed, will retry automatically:", error);
  throw error;
}
```

Change it to track per-op timing, emit events, and record/clear meta. Collect op ids during the loop; clear meta after the transaction completes successfully. **Important:** the per-op `try/catch` is inside the loop; the OUTER `try/catch` stays as-is to keep PowerSync's transaction-replay behavior intact.

```ts
const opIds: string[] = [];
try {
  for (const op of transaction.crud) {
    opIds.push(op.id);
    const started = Date.now();
    const target = `${op.table}/${op.id}`;
    try {
      // ... existing switch block runs here, unchanged ...
      switch (op.op) {
        case UpdateType.PUT:
          // ... existing PUT-multipart / PUT-json branches ...
          break;
        case UpdateType.PATCH:
          // ... existing PATCH branches ...
          break;
        case UpdateType.DELETE:
          // ... existing DELETE branch ...
          break;
      }
      await appendSyncEvent({
        kind: "upload",
        target,
        status: "ok",
        durationMs: Date.now() - started,
      });
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
  }
  await transaction.complete();
  await clearCrudMeta(opIds);
} catch (error) {
  console.error("Upload failed, will retry automatically:", error);
  throw error;
}
```

The intent is: leave the switch block byte-identical, but wrap each iteration in a try/catch that fires the event + meta on the way out.

- [ ] **Step 3: Verify the existing switch logic is byte-identical**

Run: `git diff -- powersync/Connector.ts | grep -E "^-.*(fetchOpWithAuthRetry|fetchAndLog|UpdateType\.|case )" | head -40`
Expected: empty (the switch arms should not appear in the diff except via context).

If any line inside the switch shows up in `-` lines, you've accidentally edited it. Revert and re-edit.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Checkpoint for user review**

Stop.

---

## Task 6 — Wire `attachments.queue` to emit download events

**Files:**
- Modify: `features/attachments/attachments.queue.ts`

**Why:** Mirror image of Task 5 on the download side. After this task, `EventsSection` will see both upload and download activity.

- [ ] **Step 1: Add the import**

Open `features/attachments/attachments.queue.ts`. Alongside existing imports, add:

```ts
import { appendSyncEvent } from "@/features/sync/syncEvents";
```

- [ ] **Step 2: Time the fetch in `processOne` and emit events**

Open `processOne` (around line 171). Find the top of the `try { ... }` block (after `this.inFlight.add(row.id); try {`). Add a `started` timestamp at the very top of the try block:

```ts
const target = `attachment/${row.id}`;
const started = Date.now();
```

Then wrap the first happy-path success (after `markSynced` succeeds, before the `clearAttachmentProgress` and `this.retried.delete`) with an `appendSyncEvent`:

Find:

```ts
      const { localUri, sizeBytes } = await fetchAttachment(
        row.resource,
        row.id,
        token,
        (downloaded, total) =>
          setAttachmentProgress(row.id, downloaded, total),
      );
      await this.markSynced(row.id, localUri, sizeBytes);
      clearAttachmentProgress(row.id);
      this.retried.delete(row.id);
```

Insert an event call between `markSynced` and `clearAttachmentProgress`:

```ts
      const { localUri, sizeBytes } = await fetchAttachment(
        row.resource,
        row.id,
        token,
        (downloaded, total) =>
          setAttachmentProgress(row.id, downloaded, total),
      );
      await this.markSynced(row.id, localUri, sizeBytes);
      await appendSyncEvent({
        kind: "download",
        target,
        status: "ok",
        durationMs: Date.now() - started,
      });
      clearAttachmentProgress(row.id);
      this.retried.delete(row.id);
```

- [ ] **Step 3: Emit `ok` from the 401-retry success path too**

Inside the 401-handling block, find the inner `try { ... } catch (retryErr) { ... }`. After the inner `markSynced(row.id, localUri, sizeBytes)` call, before `clearAttachmentProgress(row.id)`, insert the same event:

```ts
            await this.markSynced(row.id, localUri, sizeBytes);
            await appendSyncEvent({
              kind: "download",
              target,
              status: "ok",
              durationMs: Date.now() - started,
              retryCount: 1,
            });
            clearAttachmentProgress(row.id);
            this.retried.delete(row.id);
            return;
```

- [ ] **Step 4: Emit `fail` from the outer catch**

In the outer `} catch (e) { ... }` block, find the final `markFailed` / `markPermanentlyFailed` decision (the part after the 401 handling, around the `if (e instanceof AttachmentFetchError && !e.retriable)` check). Insert a single `appendSyncEvent` call just before that block:

```ts
      const msg =
        e instanceof AttachmentFetchError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      console.warn(`[attachments] failed ${row.resource}/${row.id}: ${msg}`);
      await appendSyncEvent({
        kind: "download",
        target,
        status: "fail",
        httpStatus:
          e instanceof AttachmentFetchError ? e.status : null,
        message: msg,
        durationMs: Date.now() - started,
      });
      if (e instanceof AttachmentFetchError && !e.retriable) {
        await this.markPermanentlyFailed(row.id, msg);
      } else {
        await this.markFailed(row.id, msg);
      }
      clearAttachmentProgress(row.id);
```

The 401-retry-failed branch (inside the inner catch) already passes through this outer catch via re-throw, so no separate event call is needed there.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Checkpoint for user review**

Stop.

---

## Task 7 — Wire `silentRefresh` to emit auth events

**Files:**
- Modify: `features/auth/useTokenRefresh.ts`

**Why:** Auth refresh is cross-cutting (fired by Connector, attachment queue, foreground poll, AppState, axios interceptor). Adding the event emission once at the bottom of `silentRefresh` covers every caller. Without this, the Events log shows the "401" entry but not the "refreshed silently" follow-up.

- [ ] **Step 1: Add the import**

Open `features/auth/useTokenRefresh.ts`. Alongside existing imports, add:

```ts
import { appendSyncEvent } from "@/features/sync/syncEvents";
```

- [ ] **Step 2: Emit an event on the success path inside `silentRefresh`**

Find the success branch (around line 81 in the current file — the line is `console.log("[TokenRefresh] Tokens refreshed silently");`). After that log line, before `return true;`, add:

```ts
        console.log("[TokenRefresh] Tokens refreshed silently");
        await appendSyncEvent({
          kind: "auth",
          status: "ok",
          message: "Tokens refreshed silently",
        });
        return true;
```

- [ ] **Step 3: Emit an event on the failure branch**

Inside the `catch (error: any)` block (around line 83-101), after the `captureAuthError("silent_refresh_failed", ...)` line, add:

```ts
        captureAuthError("silent_refresh_failed", error, { status });
        await appendSyncEvent({
          kind: "auth",
          status: "fail",
          httpStatus: typeof status === "number" ? status : null,
          message:
            error instanceof Error ? error.message : "Silent refresh failed",
        });
```

Keep the rest of the catch (the 401 → signOut handling) unchanged.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Checkpoint for user review**

Stop.

---

## Task 8 — `useSyncEvents` + `useStuckCrudOps` hooks

**Files:**
- Create: `features/sync/useSyncEvents.ts`
- Create: `features/sync/useStuckCrudOps.ts`

**Why:** Both are tiny `useQuery` wrappers; merging the task keeps the file count manageable and lets Sections 9-12 import their data layer in one go.

- [ ] **Step 1: Create `useSyncEvents`**

Create `features/sync/useSyncEvents.ts`:

```ts
import { useQuery } from "@powersync/react-native";
import type { SyncEventRow } from "./syncEvents";

/**
 * Live-streaming query over the last 200 sync events, newest first.
 */
export function useSyncEvents() {
  return useQuery<SyncEventRow>(
    `SELECT id, ts, kind, target, status, http_status, message, duration_ms, retry_count
     FROM sync_events_local
     ORDER BY ts DESC`,
  );
}
```

- [ ] **Step 2: Create `useStuckCrudOps`**

Create `features/sync/useStuckCrudOps.ts`:

```ts
import { useQuery } from "@powersync/react-native";
import { STUCK_AGE_HOURS, STUCK_ATTEMPT_CAP } from "./crudMeta";

export type StuckCrudOp = {
  op_id: string;
  attempt_count: number;
  first_failed_at: string | null;
  last_attempt_at: string;
  last_error: string | null;
  last_http_status: number | null;
  /** From the PowerSync-internal `ps_crud` table (op payload as JSON string). */
  data: string;
  tx_id: number | null;
};

/**
 * Live-streaming query of CRUD ops considered "stuck": either too many
 * attempts or stuck for too long. Joined with PowerSync's internal `ps_crud`
 * to surface the op payload.
 */
export function useStuckCrudOps() {
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
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Checkpoint for user review**

Stop.

---

## Task 9 — `StatusSection.tsx`

**Files:**
- Create: `features/sync/components/StatusSection.tsx`

**Why:** First leaf component. Subsumes the existing `SyncStatusCard.tsx` logic but with theme tokens and context-aware copy. Old `SyncStatusCard.tsx` stays in place for now; we delete it in Task 16 after the Dialog goes away.

- [ ] **Step 1: Create the section component**

Create `features/sync/components/StatusSection.tsx`:

```ts
import { useMemo } from "react";
import { View } from "react-native";
import { Spinner, useThemeColor } from "heroui-native";
import { formatRelative } from "@/utils/getRelativeTime";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { useSyncData } from "../useSyncData";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { SYNC_COPY } from "../copy";
import ForceSyncButton from "./ForceSyncButton";

const StatusRow = ({
  label,
  value,
  icon,
  iconColor,
  showSpinner,
}: {
  label: string;
  value: string;
  icon?: IconName;
  iconColor?: string;
  showSpinner?: boolean;
}) => (
  <View className="flex-row items-center justify-between py-1.5">
    <AppText className="text-sm text-muted">{label}</AppText>
    <View className="flex-row items-center gap-1.5 flex-shrink">
      {showSpinner ? (
        <Spinner size="sm" />
      ) : icon ? (
        <Icon name={icon} size={16} color={iconColor} />
      ) : null}
      <AppText
        className="text-sm text-foreground"
        style={iconColor ? { color: iconColor } : undefined}
        numberOfLines={1}
      >
        {value}
      </AppText>
    </View>
  </View>
);

const StatusSection = () => {
  const {
    connected,
    connecting,
    uploading,
    downloading,
    unsyncedCount,
    lastSyncedAt,
  } = useSyncData();
  const attachments = useAttachmentStatus();

  const successColor = useThemeColor("success");
  const warningColor = useThemeColor("warning");
  const dangerColor = useThemeColor("danger");
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");

  // Context-aware subtitle copy.
  const subtitle = useMemo(() => {
    if (attachments.lowStorage) return SYNC_COPY.status.lowStorage;
    if (connecting) return SYNC_COPY.status.connecting;
    if (!connected) {
      return unsyncedCount > 0
        ? SYNC_COPY.status.offlineWithPending(unsyncedCount)
        : SYNC_COPY.status.offline;
    }
    if (uploading) return SYNC_COPY.status.syncing;
    if (downloading) return SYNC_COPY.status.downloading;
    return SYNC_COPY.status.synced;
  }, [
    attachments.lowStorage,
    connecting,
    connected,
    unsyncedCount,
    uploading,
    downloading,
  ]);

  const connectionConfig = connecting
    ? { value: "Connecting…", color: warningColor, icon: undefined }
    : connected
      ? { value: "Connected", color: successColor, icon: "CloudCheckIcon" as IconName }
      : { value: "Offline", color: dangerColor, icon: "CloudSlashIcon" as IconName };

  const activityConfig = uploading
    ? { value: "Uploading…", color: accentColor, icon: "CloudArrowUpIcon" as IconName }
    : downloading
      ? { value: "Downloading…", color: accentColor, icon: "CloudArrowDownIcon" as IconName }
      : unsyncedCount > 0
        ? { value: `${unsyncedCount} pending`, color: warningColor, icon: "WarningCircleIcon" as IconName }
        : { value: "All synced", color: successColor, icon: "CheckCircleIcon" as IconName };

  return (
    <View className="px-4 py-4">
      <AppText className="text-xs uppercase tracking-wider text-muted mb-2">
        Status
      </AppText>

      <View className="rounded-xl border border-border bg-surface p-3">
        <AppText className="text-sm text-foreground mb-2">{subtitle}</AppText>

        <StatusRow
          label="Connection"
          value={connectionConfig.value}
          icon={connectionConfig.icon}
          iconColor={connectionConfig.color}
          showSpinner={connecting}
        />
        <StatusRow
          label="Sync activity"
          value={activityConfig.value}
          icon={activityConfig.icon}
          iconColor={activityConfig.color}
          showSpinner={!!uploading || !!downloading}
        />
        <StatusRow
          label="Pending uploads"
          value={String(unsyncedCount)}
        />
        <StatusRow
          label="Attachments"
          value={
            attachments.total === 0
              ? "—"
              : `${attachments.synced} / ${attachments.total}`
          }
          icon={
            attachments.failed > 0
              ? "WarningCircleIcon"
              : attachments.isDownloading
                ? "CloudArrowDownIcon"
                : "CheckCircleIcon"
          }
          iconColor={
            attachments.failed > 0
              ? warningColor
              : attachments.isDownloading
                ? accentColor
                : successColor
          }
        />
        <StatusRow
          label="Last sync"
          value={lastSyncedAt ? formatRelative(lastSyncedAt) : SYNC_COPY.lastSyncedNever}
          iconColor={mutedColor}
        />
      </View>

      <View className="flex-row gap-2 mt-3">
        <ForceSyncButton />
      </View>
    </View>
  );
};

export default StatusSection;
```

- [ ] **Step 2: Create `formatRelative` if it doesn't exist**

Run: `ls utils/getRelativeTime.ts 2>/dev/null && echo "exists" || echo "missing"`

If the file is missing, create `utils/getRelativeTime.ts`:

```ts
/**
 * Format a date as a short relative string ("3 min ago", "2 hr ago", "Just now").
 * Falls back to a locale date string for >24 h gaps.
 */
export function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 30_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return date.toLocaleString();
}
```

If it already exists, ensure it exports a `formatRelative(date: Date): string`. If the existing function is named differently, update the import in `StatusSection.tsx` to match the existing name.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Checkpoint for user review**

Stop.

---

## Task 10 — `QueueSection.tsx`

**Files:**
- Create: `features/sync/components/QueueSection.tsx`

- [ ] **Step 1: Create the component**

Create `features/sync/components/QueueSection.tsx`:

```ts
import { View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useSyncData } from "../useSyncData";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { SYNC_COPY } from "../copy";

const QueueSection = () => {
  const { pendingChanges } = useSyncData();
  const attachments = useAttachmentStatus();
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");

  const hasUploads = pendingChanges.length > 0;
  const hasDownloads = attachments.inFlight > 0;
  const empty = !hasUploads && !hasDownloads;

  if (empty) {
    return (
      <View className="px-4 py-4">
        <AppText className="text-xs uppercase tracking-wider text-muted mb-2">
          {SYNC_COPY.queue.heading}
        </AppText>
        <View className="rounded-xl border border-border bg-surface p-4 items-center">
          <Icon name="CheckCircleIcon" size={24} color={accentColor} />
          <AppText
            weight="semibold"
            className="text-sm text-foreground mt-2"
          >
            {SYNC_COPY.queue.empty}
          </AppText>
          <AppText className="text-xs text-muted mt-1 text-center">
            {SYNC_COPY.queue.emptySubtitle}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.queue.heading}
        </AppText>
        <AppText className="text-xs text-muted">
          {pendingChanges.length + attachments.inFlight}
        </AppText>
      </View>

      <View className="rounded-xl border border-border bg-surface overflow-hidden">
        {pendingChanges.map((change) =>
          change == null ? null : (
            <View
              key={change.rowId}
              className="flex-row items-center justify-between px-3 py-2.5 border-b border-border"
            >
              <View className="flex-1">
                <AppText weight="semibold" className="text-sm text-foreground">
                  {SYNC_COPY.queue.uploadRow(change.table, change.operation)}
                </AppText>
                <AppText className="text-xs text-muted mt-0.5">
                  {change.recordId}
                </AppText>
              </View>
              <AppText className="text-xs text-muted" style={{ color: mutedColor }}>
                queued
              </AppText>
            </View>
          ),
        )}

        {attachments.inFlight > 0 && (
          <View className="flex-row items-center justify-between px-3 py-2.5">
            <View className="flex-1">
              <AppText weight="semibold" className="text-sm text-foreground">
                {SYNC_COPY.queue.downloadRow(`${attachments.inFlight} files`)}
              </AppText>
              <AppText className="text-xs text-muted mt-0.5">
                {attachments.synced} of {attachments.total} downloaded
              </AppText>
            </View>
            <View
              className="rounded-full bg-accent-soft px-2 py-0.5"
            >
              <AppText
                weight="semibold"
                className="text-[10px] text-accent"
              >
                {Math.round(attachments.progress * 100)}%
              </AppText>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default QueueSection;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

Stop.

---

## Task 11 — `StuckSection.tsx`

**Files:**
- Create: `features/sync/components/StuckSection.tsx`

- [ ] **Step 1: Create the component**

Create `features/sync/components/StuckSection.tsx`:

```ts
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, useThemeColor, useToast } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useStuckCrudOps, type StuckCrudOp } from "../useStuckCrudOps";
import { resetCrudMeta } from "../crudMeta";
import { humanizeSyncError } from "../humanizeSyncError";
import { SYNC_COPY } from "../copy";
import { formatRelative } from "@/utils/getRelativeTime";

const StuckRow = ({ row }: { row: StuckCrudOp }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();
  const dangerColor = useThemeColor("danger");
  const mutedColor = useThemeColor("muted");

  const humanized = humanizeSyncError({
    status: row.last_http_status,
    message: row.last_error ?? "",
  });

  const handleRetry = useCallback(async () => {
    try {
      await resetCrudMeta(row.op_id);
      toast.show({
        variant: "success",
        label: "Retry queued",
        description: "We'll try this again on the next sync cycle.",
      });
    } catch (err) {
      const { message } = humanizeSyncError(err);
      toast.show({
        variant: "danger",
        label: "Couldn't retry",
        description: message,
      });
    }
  }, [row.op_id, toast]);

  return (
    <View className="rounded-xl border border-danger bg-danger-soft p-3 mb-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <AppText weight="semibold" className="text-sm text-danger">
            ⚠ {humanized.message}
          </AppText>
          {humanized.hint && (
            <AppText className="text-xs text-danger mt-0.5 opacity-80">
              {humanized.hint}
            </AppText>
          )}
          <AppText className="text-xs text-muted mt-1">
            {SYNC_COPY.stuck.attempts(row.attempt_count)}
            {row.first_failed_at &&
              ` · ${SYNC_COPY.stuck.firstFailed(formatRelative(new Date(row.first_failed_at)))}`}
          </AppText>
        </View>
        <Button variant="danger" size="sm" onPress={handleRetry}>
          <Button.Label>{SYNC_COPY.stuck.retry}</Button.Label>
        </Button>
      </View>

      <Pressable
        onPress={() => setShowDetails((v) => !v)}
        className="mt-2"
        accessibilityRole="button"
        accessibilityLabel={
          showDetails ? SYNC_COPY.stuck.hideDetails : SYNC_COPY.stuck.showDetails
        }
      >
        <AppText className="text-xs text-danger underline">
          {showDetails ? SYNC_COPY.stuck.hideDetails : SYNC_COPY.stuck.showDetails}
        </AppText>
      </Pressable>

      {showDetails && (
        <View className="mt-2 bg-surface rounded-md p-2">
          <AppText
            className="text-[10px] text-foreground"
            style={{ fontFamily: "monospace" }}
          >
            op_id: {row.op_id}
            {"\n"}HTTP: {row.last_http_status ?? "—"}
            {"\n"}error: {row.last_error ?? "(no message)"}
            {"\n"}payload: {row.data}
          </AppText>
        </View>
      )}
    </View>
  );
};

const StuckSection = () => {
  const { data: rows = [] } = useStuckCrudOps();
  const accentColor = useThemeColor("accent");

  if (rows.length === 0) {
    return (
      <View className="px-4 py-4">
        <AppText className="text-xs uppercase tracking-wider text-muted mb-2">
          {SYNC_COPY.stuck.heading}
        </AppText>
        <View className="rounded-xl border border-border bg-surface p-4 items-center">
          <Icon name="CheckCircleIcon" size={24} color={accentColor} />
          <AppText weight="semibold" className="text-sm text-foreground mt-2">
            {SYNC_COPY.stuck.empty}
          </AppText>
          <AppText className="text-xs text-muted mt-1 text-center">
            {SYNC_COPY.stuck.emptySubtitle}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.stuck.heading} · {rows.length}
        </AppText>
        <AppText className="text-xs text-danger">
          {SYNC_COPY.stuck.needsAttention}
        </AppText>
      </View>
      {rows.map((row) => (
        <StuckRow key={row.op_id} row={row} />
      ))}
    </View>
  );
};

export default StuckSection;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

Stop.

---

## Task 12 — `EventsSection.tsx`

**Files:**
- Create: `features/sync/components/EventsSection.tsx`

- [ ] **Step 1: Create the component**

Create `features/sync/components/EventsSection.tsx`:

```ts
import { useCallback } from "react";
import { Pressable, Share, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useSyncEvents } from "../useSyncEvents";
import { SYNC_COPY } from "../copy";
import type { SyncEventRow } from "../syncEvents";
import { formatRelative } from "@/utils/getRelativeTime";

const glyphFor = (status: SyncEventRow["status"]): string =>
  status === "ok" ? "✓" : status === "fail" ? "✗" : "•";

const EventRow = ({ event }: { event: SyncEventRow }) => {
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");
  const mutedColor = useThemeColor("muted");

  const color =
    event.status === "ok"
      ? successColor
      : event.status === "fail"
        ? dangerColor
        : mutedColor;

  return (
    <View className="flex-row items-start px-3 py-1.5 border-b border-border">
      <AppText
        className="text-[10px] text-muted w-16"
        style={{ fontFamily: "monospace" }}
      >
        {formatRelative(new Date(event.ts))}
      </AppText>
      <AppText
        className="text-[11px] w-4 text-center"
        style={{ color, fontFamily: "monospace" }}
      >
        {glyphFor(event.status)}
      </AppText>
      <View className="flex-1 ml-1">
        <AppText
          className="text-[11px] text-foreground"
          style={{ fontFamily: "monospace" }}
          numberOfLines={1}
        >
          {event.kind} {event.target ?? ""}
        </AppText>
        {(event.http_status != null || event.message) && (
          <AppText
            className="text-[10px] text-muted"
            style={{ fontFamily: "monospace" }}
            numberOfLines={1}
          >
            {event.http_status != null ? `HTTP ${event.http_status}` : ""}
            {event.http_status != null && event.message ? " · " : ""}
            {event.message ?? ""}
          </AppText>
        )}
      </View>
      {event.duration_ms != null && (
        <AppText
          className="text-[10px] text-muted ml-2"
          style={{ fontFamily: "monospace" }}
        >
          {event.duration_ms} ms
        </AppText>
      )}
    </View>
  );
};

const EventsSection = () => {
  const { data: events = [] } = useSyncEvents();
  const accentColor = useThemeColor("accent");

  const handleExport = useCallback(async () => {
    try {
      await Share.share({
        title: "Sync log",
        message: JSON.stringify(events, null, 2),
      });
    } catch (err) {
      console.warn("[EventsSection] export failed", err);
    }
  }, [events]);

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.events.heading}
        </AppText>
        <Pressable
          onPress={handleExport}
          accessibilityRole="button"
          accessibilityLabel={SYNC_COPY.events.export}
        >
          <AppText
            weight="semibold"
            className="text-xs text-accent"
            style={{ color: accentColor }}
          >
            {SYNC_COPY.events.export}
          </AppText>
        </Pressable>
      </View>

      {events.length === 0 ? (
        <View className="rounded-xl border border-border bg-surface p-4 items-center">
          <Icon name="ClockIcon" size={24} color={accentColor} />
          <AppText className="text-sm text-foreground mt-2">
            {SYNC_COPY.events.empty}
          </AppText>
        </View>
      ) : (
        <View
          className="rounded-xl border border-border bg-surface overflow-hidden"
          style={{ height: Math.min(events.length * 40, 320) }}
        >
          <FlashList
            data={events}
            keyExtractor={(e) => e.id}
            renderItem={({ item }) => <EventRow event={item} />}
            estimatedItemSize={40}
          />
        </View>
      )}
    </View>
  );
};

export default EventsSection;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

Stop.

---

## Task 13 — `AdvancedSection.tsx`

**Files:**
- Create: `features/sync/components/AdvancedSection.tsx`
- Modify: `features/sync/components/StreamList.tsx`

**Why:** Promotes `StreamList` from `__DEV__`-only to a collapsed-by-default disclosure. Adds the storage row.

- [ ] **Step 1: Drop the `__DEV__` guard from `StreamList`**

Open `features/sync/components/StreamList.tsx`. Find this block near the top of the component (around line 9):

```ts
  if (Constants.expoConfig?.extra?.appVariant !== "development") return null;
```

Delete the line. Also remove the now-unused `Constants` import at the top of the file if it has no other usage:

```ts
import Constants from "expo-constants";
```

(Check with `grep -n "Constants" features/sync/components/StreamList.tsx` after the edit; if zero matches, remove the import.)

- [ ] **Step 2: Create `AdvancedSection.tsx`**

Create `features/sync/components/AdvancedSection.tsx`:

```ts
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useThemeColor } from "heroui-native";
import { useQuery } from "@powersync/react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import StreamList from "./StreamList";
import { SYNC_COPY } from "../copy";

const bytesToMb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);

const StorageRow = () => {
  const { data: usage } = useQuery<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total, COUNT(*) AS count
     FROM attachments_local WHERE state = 'synced'`,
  );
  const [freeBytes, setFreeBytes] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    FileSystem.getFreeDiskStorageAsync()
      .then((free) => {
        if (!cancelled) setFreeBytes(free);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const usedMb = bytesToMb(usage?.[0]?.total ?? 0);
  const freeMb = freeBytes != null ? bytesToMb(freeBytes) : "—";

  return (
    <View className="px-3 py-2">
      <AppText className="text-xs uppercase tracking-wider text-muted mb-1">
        {SYNC_COPY.advanced.storageHeading}
      </AppText>
      <AppText className="text-sm text-foreground">
        {SYNC_COPY.advanced.storageRow(usedMb, freeMb)}
      </AppText>
    </View>
  );
};

const AdvancedSection = () => {
  const [open, setOpen] = useState(false);
  const mutedColor = useThemeColor("muted");

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <View className="px-4 py-4">
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={SYNC_COPY.advanced.heading}
        className="flex-row items-center gap-2"
      >
        <Icon
          name={open ? "CaretDownIcon" : "CaretRightIcon"}
          size={14}
          color={mutedColor}
        />
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.advanced.heading}
        </AppText>
      </Pressable>

      {open && (
        <View className="mt-3 rounded-xl border border-border bg-surface overflow-hidden">
          <View className="px-3 py-2">
            <AppText className="text-xs uppercase tracking-wider text-muted mb-1">
              {SYNC_COPY.advanced.streamsHeading}
            </AppText>
            <StreamList />
          </View>
          <View className="border-t border-border" />
          <StorageRow />
        </View>
      )}
    </View>
  );
};

export default AdvancedSection;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Checkpoint for user review**

Stop.

---

## Task 14 — `SyncCenterScreen.tsx` + route registration

**Files:**
- Create: `screens/main/SyncCenterScreen.tsx`
- Create: `app/(main)/sync.tsx`
- Modify: `app/(main)/_layout.tsx`

**Why:** Composes the five sections and registers the route. After this task, the screen is reachable via direct navigation (e.g. `/sync`), but the icon still opens the Dialog — that swap is Task 15.

- [ ] **Step 1: Create the screen**

Create `screens/main/SyncCenterScreen.tsx`:

```ts
import { ScrollView, View } from "react-native";
import StatusSection from "@/features/sync/components/StatusSection";
import QueueSection from "@/features/sync/components/QueueSection";
import StuckSection from "@/features/sync/components/StuckSection";
import EventsSection from "@/features/sync/components/EventsSection";
import AdvancedSection from "@/features/sync/components/AdvancedSection";

const SyncCenterScreen = () => {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View accessible accessibilityRole="header" />
      <StatusSection />
      <QueueSection />
      <StuckSection />
      <EventsSection />
      <AdvancedSection />
    </ScrollView>
  );
};

export default SyncCenterScreen;
```

- [ ] **Step 2: Create the route wrapper**

Create `app/(main)/sync.tsx`:

```ts
import SyncCenterScreen from "@/screens/main/SyncCenterScreen";

const SyncRoute = () => {
  return <SyncCenterScreen />;
};

export default SyncRoute;
```

- [ ] **Step 3: Register the route in `_layout.tsx`**

Open `app/(main)/_layout.tsx`. Inside the `<Stack>` block, add the route registration alongside the other `<Stack.Screen>` entries. Place it after the `name="(tabs)"` line:

```tsx
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          options={{ ...emptyTitleHeader, headerTitle: "Sync Center" }}
          name="sync"
        />
        <Stack.Screen name="profile" />
```

Do NOT touch `SyncSheetProvider` or `<SyncSheet />` yet — Task 16 handles the atomic delete.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Smoke-verify the route is reachable (optional)**

In a dev build, navigate directly to `/sync` via the Expo Router URL bar or by adding a temporary `<Button onPress={() => router.push("/sync")} />` somewhere. Confirm the screen renders without crashing. Remove the temporary button before committing.

- [ ] **Step 7: Checkpoint for user review**

Stop.

---

## Task 15 — Icon swap (navigate + 44 pt + badge a11y)

**Files:**
- Modify: `features/sync/components/SyncCenter.tsx`

**Why:** Switches the icon from opening the Dialog to navigating to the new route. Grows the tap target to 44 pt. Adds an accessibility label that announces the badge count.

- [ ] **Step 1: Swap imports**

Open `features/sync/components/SyncCenter.tsx`. Replace the `useSyncSheet` import with `useRouter` from `expo-router`:

```ts
// Remove:
import { useSyncSheet } from "../SyncSheetContext";

// Add:
import { useRouter } from "expo-router";
import { SYNC_COPY } from "../copy";
```

- [ ] **Step 2: Switch the press handler**

Find the line in the component body:

```ts
  const { openSyncSheet } = useSyncSheet();
```

Replace with:

```ts
  const router = useRouter();
  const handlePress = () => router.push("/sync");
```

Find the `<Pressable>` near the bottom that has `onPress={openSyncSheet}` and change it to:

```tsx
    <Pressable
      onPress={handlePress}
```

- [ ] **Step 3: Grow tap target to 44 pt**

Find the Pressable's className:

```tsx
      className="w-9 h-9 rounded-full justify-center items-center"
```

Change to:

```tsx
      className="w-11 h-11 rounded-full justify-center items-center"
```

The icon glyph stays at `size={24}`; the wrapper just gains padding.

- [ ] **Step 4: Compose the accessibility label from the copy registry**

Find the existing `accessibilityLabel` computation (a `useMemo` returning strings like `"Sync center, offline"`). Replace the whole `useMemo` block with one that uses `SYNC_COPY.iconA11y`:

```ts
  const accessibilityLabel = useMemo(() => {
    let label = SYNC_COPY.iconA11y.base;
    if (!connected) label += ", offline";
    else if (downloading || attachmentsDownloading) label += ", downloading";
    else if (uploading) label += ", uploading";
    else label += ", synced";
    if (attachmentsFailed > 0) {
      label += SYNC_COPY.iconA11y.failedBadge(attachmentsFailed);
    }
    return label;
  }, [
    connected,
    downloading,
    attachmentsDownloading,
    uploading,
    attachmentsFailed,
  ]);
```

- [ ] **Step 5: Confirm no other consumers of `useSyncSheet` are reachable from here**

Run: `grep -rn "useSyncSheet" --include="*.ts" --include="*.tsx" .`

Expected matches: `SyncSheetContext.tsx`, `SyncSheet.tsx`, and `_layout.tsx` only. (No remaining consumer in `SyncCenter.tsx` since we just removed it.)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 8: Smoke-verify the icon navigates (optional)**

In a dev build, tap the header icon — it should push the `/sync` route. The Dialog is now unreachable through the UI, but its code still exists (deleted in Task 16).

- [ ] **Step 9: Checkpoint for user review**

Stop.

---

## Task 16 — Atomic delete of the old Dialog

**Files:**
- Delete: `features/sync/SyncSheetContext.tsx`
- Delete: `features/sync/components/SyncSheet.tsx`
- Delete: `features/sync/components/SyncStatusCard.tsx`
- Modify: `app/(main)/_layout.tsx`
- Modify: `features/sync/components/ForceSyncButton.tsx`

**Why:** Cutover. Removes the modal surface entirely and routes the `ForceSyncButton`'s toast through the new translation layer.

- [ ] **Step 1: Remove the provider + mount from `_layout.tsx`**

Open `app/(main)/_layout.tsx`. Remove these imports:

```ts
import { SyncSheetProvider } from "@/features/sync/SyncSheetContext";
import SyncSheet from "@/features/sync/components/SyncSheet";
```

Remove the `<SyncSheetProvider>` and `<SyncSheet />` from the JSX. The new shape:

```tsx
return (
  <Stack screenOptions={{ ...headerOptions, headerShown: false }}>
    <Stack.Screen name="(tabs)" />
    <Stack.Screen
      options={{ ...emptyTitleHeader, headerTitle: "Sync Center" }}
      name="sync"
    />
    {/* ... all other Stack.Screen entries unchanged ... */}
  </Stack>
);
```

- [ ] **Step 2: Delete the three files**

```bash
rm /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/SyncSheetContext.tsx
rm /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/components/SyncSheet.tsx
rm /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/components/SyncStatusCard.tsx
```

- [ ] **Step 3: Route `ForceSyncButton`'s error toast through `humanizeSyncError`**

Open `features/sync/components/ForceSyncButton.tsx`. Find the catch block (around line 33-46):

```ts
    } catch (error) {
      console.error("Force sync failed:", error);
      const message =
        error instanceof Error ? error.message : "Please try again.";
      toast.show({
        variant: "danger",
        label: "Sync failed",
        description: message,
      });
    }
```

Replace with:

```ts
    } catch (error) {
      console.error("Force sync failed:", error);
      const humanized = humanizeSyncError(error);
      toast.show({
        variant: "danger",
        label: "Sync failed",
        description: humanized.hint
          ? `${humanized.message} ${humanized.hint}`
          : humanized.message,
      });
    }
```

Add the import at the top:

```ts
import { humanizeSyncError } from "@/features/sync/humanizeSyncError";
```

- [ ] **Step 4: Confirm zero remaining references to the deleted modules**

Run:
```
grep -rn "SyncSheetContext\|SyncSheetProvider\|useSyncSheet\|SyncSheet\b\|SyncStatusCard" --include="*.ts" --include="*.tsx" . | grep -v docs/
```

Expected: empty.

If any reference appears outside `docs/`, it means a consumer was missed. Stop and inspect before continuing.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors. Anything else means a stale import.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Checkpoint for user review**

Stop. This is the cutover commit; expect the user to spend extra time inspecting.

---

## Task 17 — Accessibility pass

**Files:**
- Modify: `screens/main/SyncCenterScreen.tsx`
- Modify: `features/sync/components/QueueSection.tsx` (icon prefix already in copy, verify rendering)
- Modify: `features/sync/components/StuckSection.tsx` (verify glyph prefix)

**Why:** The previous tasks already added most of the a11y polish (44 pt target, badge label, glyph prefixes via copy registry). This task closes out the focus-target-on-title item and adds one verification step.

- [ ] **Step 1: Add accessibility-focused header to `SyncCenterScreen`**

Open `screens/main/SyncCenterScreen.tsx`. Replace the placeholder:

```tsx
      <View accessible accessibilityRole="header" />
```

with a real screen-reader landing target sitting just above the first content section:

```tsx
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel="Sync Center"
        accessibilityElementsHidden={false}
        importantForAccessibility="yes"
        style={{ height: 0 }}
      />
```

The zero-height `View` is invisible but receives initial screen-reader focus when the route mounts, so TalkBack / VoiceOver land on the screen name rather than the first interactive element.

- [ ] **Step 2: Verify glyph prefixes are present in Queue / Stuck row text**

`QueueSection`'s upload rows use `SYNC_COPY.queue.uploadRow(table, op)` which starts with `↑`. Confirm via grep:

```
grep -n "↑\|↓" features/sync/copy.ts
```

Expected: 2 matches (upload row glyph + download row glyph).

`StuckSection`'s row title hardcodes `⚠`. Confirm via:

```
grep -n "⚠" features/sync/components/StuckSection.tsx
```

Expected: at least 1 match.

These glyph prefixes are the color-blind affordance — verify they survived earlier edits.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: only baseline errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Smoke-verify with screen reader (optional but recommended)**

On a dev build, enable VoiceOver (iOS) or TalkBack (Android). Tap into the route from the home tab. Expected first announcement: "Sync Center, header". Swipe right — should land on the Status section heading next.

- [ ] **Step 6: Checkpoint for user review**

Stop.

---

## Final manual smoke verification

Once all 17 tasks pass, run the spec's verification checklist (Section "Verification" in the design doc) on a dev build before opening the PR.

Critical items not covered by typecheck/lint:

- **Route reachability** from the header icon (Task 15).
- **Empty / non-empty rendering** for Queue, Stuck, Events.
- **Retry path** on a Stuck row actually resets `attempt_count` and the row disappears after the next PowerSync upload cycle.
- **Export log** opens the share sheet with JSON.
- **Theme switch** (dark mode) — no hardcoded hex anywhere; Status / Queue / Stuck / Events all re-color.
- **VoiceOver / TalkBack landing** on the route title.

---

## Out of scope (deferred to future PRs)

- **Dismiss on Stuck rows** — requires `getCrudBatch()` refactor + `abandoned_uploads_local`.
- **Force resync button** — the spec mockup showed Reconnect + Force resync side-by-side, but the existing `ForceSyncButton` already covers the reconnect semantic. A destructive "wipe local cache + re-sync from scratch" action needs its own confirmation flow and is deferred.
- **CRUD 4xx auto-classification** — surfaces today via Stuck lane; auto-drop is future work.
- **Sync history graph / storage chart / network-quality indicator.**
- **i18n** — copy registry makes it trivial; shipping i18n is its own project.
- **Stream-milestone events** — watcher does not emit `kind='stream'` events.
