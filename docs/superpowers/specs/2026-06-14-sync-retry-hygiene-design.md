---
title: Sync retry hygiene (PR 1 of Sync Center rework)
date: 2026-06-14
status: proposed
---

# Sync retry hygiene

This is **PR 1** of a two-PR effort. It ships only the retry-path bug fixes and
adjacent cleanups — **no UI changes**. The Sync Center reimagine (route, new
sections, new local tables) lands in PR 2 against the cleaner baseline this PR
produces.

## Motivation

Reading the current Sync Center surfaced four error-path bugs and two pieces of
adjacent debt:

1. **CRUD 401 retries with a stale token.** `Connector.uploadData` catches every
   non-2xx and re-throws so PowerSync re-queues, but it never asks the auth
   layer to rotate the token. The next retry uses the same expired token until
   something else (foreground poll, axios interceptor) happens to refresh.
2. **Attachment 401 retry sleeps and hopes.** `AttachmentQueue.processOne` waits
   1 s after a 401 and re-reads `accessToken`, assuming some other code path
   called `silentRefresh` in that window. Nothing here calls it, so the retry
   often runs with the same expired token.
3. **Watcher auto-heal has no backoff.** Every PowerSync change tick (debounced
   250 ms) re-arms every FAILED attachment with `retry_count < AUTO_RETRY_CAP`
   back to QUEUED. During an outage that burns the retry budget in seconds and
   bursts a request per row at the server.
4. **`SyncBanner` is dead code.** Imported nowhere. The "offline + pending
   changes" signal it would have shown never reaches the UI.
5. **Two near-duplicate attachment-status hooks.** `useAttachmentStatus` and
   `useAttachmentSyncStatus` both `SELECT state, COUNT(*) ... GROUP BY state`
   from `attachments_local` and return overlapping shapes. They're used in
   different files for the same purpose.

All five are independent of the Sync Center UI rework. Shipping them first means
PR 2 lands on a baseline where the Events log and Stuck lane reflect the real
state of sync rather than the symptoms of these bugs.

## Scope

**In scope**

- CRUD 401 → `silentRefresh({ force: true })` once, then retry the failing op
- Attachment 401 → `await silentRefresh({ force: true })` (replace 1 s sleep)
- Watcher auto-heal → require `updated_at` is at least 30 s old before re-arming
- Delete `features/sync/components/SyncBanner.tsx`
- Consolidate `useAttachmentStatus` + `useAttachmentSyncStatus` into one hook;
  update the three call sites

**Out of scope (PR 2)**

- Full-screen `/sync` route and the new section layout
- `sync_events_local` ring buffer and any per-op event logging
- `ps_crud_meta_local` sidecar and the Stuck Items lane
- CRUD 4xx "permanent fail" classification (the symmetric of attachment 404
  handling)
- Icon health-light, theme/copy/accessibility polish, Reconnect button rewording

## Design

### 1. Connector CRUD 401 → forced refresh

**File:** `powersync/Connector.ts`

`uploadData` has four `fetchAndLog` call sites today (PUT-multipart, PUT-json,
PATCH-multipart, PATCH-json, DELETE). Extract a helper that wraps every one of
them with a single 401 handler, then replace each call site with the helper.

```ts
async function fetchOpWithAuthRetry(
  label: string,
  url: string,
  init: RequestInit,
  rebuildAuthHeader: (token: string) => Record<string, string>,
): Promise<Response> {
  try {
    return await fetchAndLog(label, url, init);
  } catch (err) {
    if (!(err instanceof UploadOpError) || err.status !== 401) throw err;

    const refreshed = await silentRefresh({ force: true });
    if (!refreshed) throw err; // refresh failed/offline → re-queue normally

    const refreshedToken = useStore.getState().accessToken;
    if (!refreshedToken) throw err;

    return await fetchAndLog(`${label} (retry-after-refresh)`, url, {
      ...init,
      headers: rebuildAuthHeader(refreshedToken),
    });
  }
}
```

Each switch arm passes its own `rebuildAuthHeader` so the JSON and multipart
header shapes (which differ today — JSON includes `Content-Type`, multipart
omits it so the runtime sets the boundary) stay correct on retry. Example for
the JSON PUT arm:

```ts
await fetchOpWithAuthRetry(
  `PUT-json ${op.table} ${op.id}`,
  instanceUrl,
  { method: "PUT", headers, body: JSON.stringify(record) },
  (token) => ({ ...headers, Authorization: `Bearer ${token}` }),
);
```

Important properties:

- Uses `silentRefresh` from `features/auth/useTokenRefresh.ts`, which dedup's
  concurrent callers via `inflightRefresh`. Safe to fire even if the foreground
  poll or axios interceptor is already refreshing.
- Returns `false` cleanly on offline / no refresh token / failed refresh — in
  that case we re-throw the original 401 and PowerSync re-queues normally.
- Retries the op **once**. A second 401 after a forced refresh means token
  rotation didn't take or the server still rejects it — that's not a loop we
  want.
- The multipart `FormData` body is reusable across calls in React Native
  (no stream consumption), so passing the same `init.body` to the retry works.

### 2. Attachment queue 401 → awaited refresh

**File:** `features/attachments/attachments.queue.ts`

Today `processOne` has a 401 branch (`queue.ts:194-235`) that does:

```ts
await new Promise((r) => setTimeout(r, 1000));
const refreshedToken = useStore.getState().accessToken;
```

Replace the sleep with an awaited forced refresh — that's the only line that
changes:

```ts
await silentRefresh({ force: true });
const refreshedToken = useStore.getState().accessToken;
```

The existing `if (refreshedToken && refreshedToken !== "")` guard below stays
exactly as it is. If the forced refresh failed (returned `false`), the store
either still holds the old empty/expired token or `signOut` has cleared it —
both fall through to the existing `markFailed` / `markPermanentlyFailed` path
at the bottom of the outer catch. No new branches required.

The `this.retried` set still guards against an infinite loop on the same row
inside one `processOne` invocation.

### 3. Watcher auto-heal backoff

**File:** `features/attachments/attachments.watcher.ts`

The auto-heal `UPDATE` at lines 46-57 currently fires on every scan for every
FAILED row with retry budget. Add a 30-second cooldown:

```diff
 await powersync.execute(
   `UPDATE attachments_local
    SET state = ?, error = NULL, updated_at = ?
-   WHERE id = ? AND state = ? AND retry_count < ?`,
+   WHERE id = ? AND state = ? AND retry_count < ?
+     AND datetime(updated_at) < datetime('now', '-30 seconds')`,
   [
     ATTACHMENT_STATES.QUEUED,
     now,
     id,
     ATTACHMENT_STATES.FAILED,
     AUTO_RETRY_CAP,
   ],
 );
```

The `datetime(...)` wrapper on both sides is required because `updated_at` is
stored as ISO 8601 (`new Date().toISOString()`) while `datetime('now', ...)`
returns SQLite's `YYYY-MM-DD HH:MM:SS` format. Lexicographic comparison of the
two raw strings is wrong (`T` > space). Wrapping with `datetime()` normalizes
both sides into SQLite's internal numeric Julian representation, which is
correct.

**Push-driven retry stays forceful.** This change touches only the passive
watcher path. `enqueuePushAttachments` in `attachments.api.ts:79-99` keeps its
explicit FAILED → QUEUED flip, so a push tap immediately retries regardless of
the 30 s cooldown. That's intentional — the user just expressed intent.

The 30 s value matches a typical mobile network reconnect window. We can tune
later if telemetry shows it's wrong.

### 4. Delete `SyncBanner`

**File:** `features/sync/components/SyncBanner.tsx` (delete)

`grep -r SyncBanner` shows it's imported only in old design docs, never in app
code. Delete the file. No further changes needed.

### 5. Consolidate attachment-status hooks

**Files:**
- Keep: `features/attachments/hooks/useAttachmentStatus.ts`
- Delete: `features/attachments/hooks/useAttachmentSyncStatus.ts`
- Update call sites: `SyncCenter.tsx`, `SyncStatusCard.tsx`

Merge the union of fields into `useAttachmentStatus`:

```ts
export type AttachmentStatus = {
  queued: number;          // was "pending" — rename for consistency with the schema state
  downloading: number;
  synced: number;
  failed: number;
  total: number;           // queued + downloading + synced + failed
  inFlight: number;        // queued + downloading
  isDownloading: boolean;  // inFlight > 0
  progress: number;        // synced / total (1 when total == 0)
  lowStorage: boolean;     // from attachmentQueue.isLowStorage()
};
```

The "pending" → "queued" rename matches `ATTACHMENT_STATES.QUEUED`. Update the
three call sites:

- `SyncSheet.tsx:45` — currently reads `status.lowStorage` and `status.failed`. No
  rename needed.
- `SyncCenter.tsx:33` — switch import from `useAttachmentSyncStatus` to
  `useAttachmentStatus`. Field names used (`isDownloading`, `failed`) are
  already on the merged shape.
- `SyncStatusCard.tsx:165` — switch import. Field names used (`total`, `synced`,
  `inFlight`, `failed`) are already on the merged shape.

The `lowStorage` field subscribes to `attachmentQueue.onChange`. That's a tiny
add for callers that didn't previously need it — but the work is debounced via
React's setState, so it's cheap.

## Risks

| Risk | Mitigation |
|---|---|
| `silentRefresh` from `Connector.uploadData` recurses if upload itself is what triggers refresh | `silentRefresh` doesn't call upload; only fetches the refresh endpoint. No recursion path. |
| Forced refresh after a 401 that wasn't really an auth error (e.g. server returned 401 for "unauthorized for this resource") loops once with no benefit | Bounded: we retry once, then re-throw and PowerSync re-queues. One extra refresh call per spurious 401. Acceptable. |
| Watcher backoff predicate breaks if `updated_at` is ever stored in another format | `markFailed`, `markSynced`, `markDownloading`, and all INSERT/UPDATE statements in the attachments feature use `new Date().toISOString()`. Confirmed via grep before shipping. |
| Hook consolidation breaks an off-screen consumer | Three call sites total — all in `features/sync/`. Grep-confirmed. |
| Deleting `SyncBanner` removes a feature someone forgot to wire up | Reviewed git blame on the file. Last touch was the original PowerSync rollout; never imported. Spec captures this for the record. |

## Verification

Manual smoke tests on dev:

1. **CRUD 401 refresh** — sign in, let the access token expire (or manually
   shorten its lifetime in store), make a write that hits `Connector.uploadData`,
   confirm Connector logs show a single forced refresh and a successful retry
   with the rotated token.
2. **Attachment 401 refresh** — same trick; trigger an attachment download with
   an expired token. Logs should show `silentRefresh` awaited, not a 1 s sleep.
3. **Watcher backoff** — manually mark several `attachments_local` rows FAILED
   with `updated_at = now`. Trigger a PowerSync change. Confirm the rows are
   NOT re-armed for at least 30 s, then ARE re-armed on the next scan after
   30 s elapse.
4. **Push-driven retry stays immediate** — confirm `enqueuePushAttachments`
   path still flips FAILED → QUEUED right away regardless of timestamp.
5. **Hook consolidation** — open SyncCenter and Sync Sheet, confirm all
   pre-existing badges, status rows, and counters render identically.
6. **Type-check + lint** clean.

## Out-of-scope (deferred to PR 2)

For traceability — these gaps are real but live in PR 2:

- Full-screen `/sync` route replacing the Dialog modal
- 44pt icon tap target + dark-mode theming via `useThemeColor`
- Surfacing `pendingChanges` from `useSyncData` (today only the count is shown)
- Per-item retry / dismiss for stuck items
- Events log for support diagnostics
- Reconnect button rewording, copy review, accessibility audit
- Promoting `StreamList` out of dev-only
