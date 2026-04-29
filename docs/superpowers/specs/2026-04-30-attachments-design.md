# PowerSync Attachments — Design

**Status:** Draft
**Date:** 2026-04-30
**Owner:** Mobile team

## Background

The mobile app stores file references (photos, course materials, student submissions) as relative paths in PowerSync-synced columns. Currently:

- Files are not cached locally — every render re-fetches from the server.
- Uploads work via an ad-hoc multipart hack inside `Connector.uploadData` that detects local `file://` URIs and POSTs them.
- There is no offline access, no retry surface, no progress feedback, and no central place to inspect failed downloads.

This design adds an offline-first attachment download queue while leaving the existing upload path in `Connector` untouched.

## Goals

- Eagerly download every in-scope attachment as soon as its row syncs into local SQLite.
- Make `module_module.file` (PDFs, ≤10 MB each) a lower priority than photos and submissions, so the perceived first-launch experience prioritizes visual assets.
- Provide a retry surface so the user can manually re-attempt failed downloads (e.g., after freeing storage).
- Halt cleanly when device storage is low; do **not** auto-evict cached attachments.
- Continue serving cached files when offline; never block UI on network.

## Non-goals

- Migrating uploads through the queue. Uploads remain in `Connector` (the existing multipart flow). Future work may unify them; this design does not.
- Automatic cache eviction or LRU. The user controls cleanup; the queue only halts new downloads when storage is critically low.
- The deprecated `mobile_attachment` table. It is excluded from sync and not tracked.
- Web/desktop platforms. Mobile only.

## Scope of attachments

| Server column | Direction | Resource segment | Priority |
|---|---|---|---|
| `accounts_profile.student_photo` | Download | `profile` | 1 |
| `subject_subject.subject_photo` | Download | `subjectPhoto` | 1 |
| `activity_studentactivity.file` | Download (queue) + Upload (Connector) | `student_activity_files` | 1 |
| `activity_retakerecorddetail.upload_file` | Download (queue) + Upload (Connector) | `uploadDocuments` | 1 |
| `module_module.file` | Download | `module` | 2 |

For "Both" rows, only the download side is handled by the queue. Upload continues to flow through `Connector.uploadData` when a `file://` URI is present.

## Server contract

For each resource above, the download endpoint is:

```
GET ${API_URL}/api/<resource>/<id>/
Authorization: Bearer <accessToken>
```

The `<id>` is extracted from the column's stored value, which has the shape `/media/<id>/` (or similar — only the last non-empty path segment is used).

The response is JSON:

```json
{
  "id": "<server-id>",
  "binaryFile": "<base64-encoded contents>",
  "file": "<absolute URL to the file>",
  "<resource-fk>": <integer>,
  "<other-resource-fk>": null
}
```

The queue follows the `file` URL to download bytes (no auth required on that URL, per the example response). `binaryFile` is **not** used; reading it would mean a 33%-larger payload and a JS-thread base64 decode for files up to 10 MB. If the `file` URL fetch fails for a reason other than auth/network, the queue falls back to decoding `binaryFile` from the original response (kept in memory only for that retry).

## Architecture

```
┌─ Watcher ───────────────────────────────────────────┐
│  Subscribes to PowerSync table changes for the      │
│  five tracked tables. On change (and on app start), │
│  scans rows, extracts ids from configured columns,  │
│  upserts into attachments_local with priority.      │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─ attachments_local (local-only SQLite) ─────────────┐
│  id           TEXT PRIMARY KEY  -- server-side id   │
│  resource     TEXT NOT NULL                         │
│  source_table TEXT NOT NULL                         │
│  source_col   TEXT NOT NULL                         │
│  priority     INTEGER NOT NULL                      │
│  state        TEXT NOT NULL  -- QUEUED|DOWNLOADING| │
│                              -- SYNCED|FAILED        │
│  local_uri    TEXT                                  │
│  size_bytes   INTEGER                               │
│  error        TEXT                                  │
│  retry_count  INTEGER NOT NULL DEFAULT 0            │
│  updated_at   TEXT NOT NULL                         │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─ Worker ────────────────────────────────────────────┐
│  Loop: pick highest-priority QUEUED row, fetch via  │
│  attachments.fetcher, write to                      │
│  documentDirectory/attachments/<id>.<ext>, mark     │
│  SYNCED. Concurrency cap = 3. On error, mark        │
│  FAILED with message and retry_count++.             │
└─────────────────────────────────────────────────────┘

UI surfaces:
  useAttachment(path)         → local URI | undefined
  useFailedAttachments()      → list for retry UI
  retryAttachment(id)         → state FAILED → QUEUED
  <AttachmentImage path>      → expo-image with placeholder
```

The attachments table lives **inside the PowerSync database** but is not part of `AppSchema` — it's created via raw `CREATE TABLE IF NOT EXISTS` at app start so PowerSync sync rules ignore it. `disconnectAndClear()` wipes it along with everything else, which is the desired behavior on logout.

## Module layout

```
features/attachments/
  attachments.config.ts        Column → { resource, priority } map
  attachments.schema.ts        Local table create + Drizzle definition
  attachments.fetcher.ts       Pure fn: (resource, id, token) → local file path
  attachments.watcher.ts       Hooks PowerSync table change events
  attachments.queue.ts         Worker loop, concurrency, retry, state mgmt
  attachments.api.ts           Public functions: retry, getStatus, etc.
  hooks/
    useAttachment.ts           (path) → { uri, state, error, retry }
    useFailedAttachments.ts    Subscription to FAILED rows for retry UI
    useAttachmentStatus.ts     Aggregate status (low storage, count pending)
  components/
    AttachmentImage.tsx        expo-image with skeleton + retry-on-error
```

`attachments.fetcher.ts` is intentionally pure (no React, no global state) so it's unit-testable with a mocked fetch + FileSystem.

## Lifecycle

| Event | Behavior |
|---|---|
| App start, authenticated, PowerSync connected | Watcher scans tracked tables, upserts new rows into `attachments_local` with `state=QUEUED`. Worker starts and drains. |
| New row arrives via sync | Table-change listener fires; watcher enqueues if path is non-empty and id is not already SYNCED. |
| `file://` URI seen in column | Skipped — that's a pending upload, handled by `Connector`. |
| Worker pulls a QUEUED row | Marks `DOWNLOADING`, calls `fetcher`, on success marks `SYNCED` and writes `local_uri`. |
| Fetcher receives 401 | Triggers `useTokenRefresh` flow; row stays `DOWNLOADING` until next loop tick, then retries with refreshed token. |
| Fetcher network/5xx error | State `FAILED`, `error` populated, `retry_count++`. No automatic retry within session. |
| Free disk < 100 MB | Worker pauses; `useAttachmentStatus` reports `lowStorage=true`. SyncSheet shows banner. |
| User taps retry on a FAILED row | `state=QUEUED`, worker picks it up. |
| Logout / `disconnectAndClear()` | Local table is dropped along with the rest; on next login it's recreated empty. |

## Error handling

- **401 Unauthorized**: refresh token via existing `useTokenRefresh`, then retry once. If refresh fails, mark `FAILED` so the user can retry post-login.
- **404 Not Found**: mark `FAILED` with explicit "Not found" message; don't auto-retry. The row in PowerSync may be stale.
- **5xx / network**: mark `FAILED`. User retry only.
- **Malformed JSON**: mark `FAILED`, log to console in dev. Probably a server bug — visible via SyncSheet.
- **Disk write failure (storage full mid-write)**: mark `FAILED`, free any partial bytes, halt worker, set `lowStorage=true`.

## Hook API

```ts
// Returns local URI when available, undefined while pending.
// Subscribes to changes — flips from undefined → uri reactively.
useAttachment(path: string | null | undefined): {
  uri: string | undefined;
  state: 'queued' | 'downloading' | 'synced' | 'failed' | 'unknown';
  error?: string;
  retry: () => void;
};
```

`<AttachmentImage path={user.studentPhoto} fallback={...} />` consumes this hook and shows a skeleton while pending, the image when synced, and an error UI with retry button when failed.

## Concurrency, priority, fairness

- **Concurrency cap**: 3 simultaneous downloads (configurable via `attachments.config.ts`). Prevents thundering-herd on initial sync.
- **Priority**: priority-1 rows are picked over priority-2. The cap is global, not per-priority — at full saturation, p1 monopolizes until drained, then p2 starts.
- **No stale lock**: when a row is `DOWNLOADING`, an `updated_at` timestamp lets us reset zombie rows on app restart (anything `DOWNLOADING` from a previous session is reset to `QUEUED`).

## Testing

**Unit (jest + mocks)**
- `attachments.fetcher`: mock `fetch` and `expo-file-system`; verify URL construction, auth header, success/failure paths, file-URL fallback to `binaryFile`.
- `attachments.queue`: mock fetcher; verify priority ordering, concurrency cap, retry transitions, low-storage pause.
- `attachments.config`: id extraction from various path shapes (`/media/abc/`, `/media/abc.jpg`, `abc`, `file://...` skip).

**Integration (manual smoke)**
- Fresh install: log in, observe priority-1 attachments populating before priority-2.
- Offline before sync: log in, immediately go offline, observe queue persists; come back online and resumes.
- Mid-sync offline: kill network during a download, verify FAILED row + retry button works after reconnect.
- Storage full: simulator setting; verify pause + banner.

## Open questions

None blocking. Two notes for future work:

1. **Upload unification**: once download queue is stable, evaluate moving the `Connector` multipart hack into the queue so retries and progress UI are consistent across both directions.
2. **Lazy fallback for module_module.file**: the spec says eager-all with priority 2. If first-sync time becomes a complaint for teachers with many materials, swap priority-2 to lazy-on-view per the original "Hybrid" option.
