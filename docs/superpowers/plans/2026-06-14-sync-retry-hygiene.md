# Sync Retry Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No auto-commit:** Per user preference, this plan never stages or commits. After each task passes its checks, stop and let the user inspect/commit.

**Goal:** Fix three retry-path bugs in PowerSync sync (CRUD 401 stale-token retries, attachment 401 sleep-and-hope, watcher auto-heal with no backoff), delete the dead `SyncBanner` component, and consolidate two near-duplicate attachment-status hooks. Spec: [docs/superpowers/specs/2026-06-14-sync-retry-hygiene-design.md](../specs/2026-06-14-sync-retry-hygiene-design.md).

**Architecture:** Five independent touchpoints in three files: a new `fetchOpWithAuthRetry` helper inside `powersync/Connector.ts` that wraps each `fetchAndLog` call site with a single 401-recovery path; a one-line swap in `features/attachments/attachments.queue.ts` (sleep → `await silentRefresh`); a one-clause addition to the auto-heal predicate in `features/attachments/attachments.watcher.ts`; deletion of `features/sync/components/SyncBanner.tsx`; and a merge of `useAttachmentSyncStatus` into `useAttachmentStatus` with two call-site import updates. No UI changes. No new files except a consolidated hook.

**Tech Stack:** React Native, TypeScript, `@powersync/react-native`, `expo-file-system`, Zustand store (`@/lib/store`), Biome (lint + format).

**Repo conventions honored:**
- Typecheck via `npm run typecheck` (= `tsc --noEmit`).
- Lint via `npm run lint` (= `biome check .`).
- No automated tests in this repo. Verification is manual smoke testing on a dev build, captured in the final task.
- Staging and committing left to the user. Plan ends each task at a clean working tree ready for review.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `features/sync/components/SyncBanner.tsx` | **Delete** | Dead component — never imported. |
| `features/attachments/hooks/useAttachmentSyncStatus.ts` | **Delete** | Near-duplicate of `useAttachmentStatus`; consumers move to the merged hook. |
| `features/attachments/hooks/useAttachmentStatus.ts` | **Modify** | Becomes the single source of truth: returns counts, derived fields, and `lowStorage`. |
| `features/sync/components/SyncCenter.tsx` | **Modify** | Switch import from `useAttachmentSyncStatus` → `useAttachmentStatus`. |
| `features/sync/components/SyncStatusCard.tsx` | **Modify** | Same import switch. |
| `features/attachments/attachments.watcher.ts` | **Modify** | Add 30 s cooldown clause to the auto-heal `UPDATE`. |
| `features/attachments/attachments.queue.ts` | **Modify** | Replace 1 s sleep in the 401 branch of `processOne` with `await silentRefresh({ force: true })`. |
| `powersync/Connector.ts` | **Modify** | Add `fetchOpWithAuthRetry` helper, replace the four `fetchAndLog` call sites in `uploadData` with it. |

Nothing else is touched.

---

## Task 1 — Delete `SyncBanner.tsx`

**Files:**
- Delete: `features/sync/components/SyncBanner.tsx`

**Why first:** Lowest risk. Pure deletion. Establishes a clean baseline for everything else.

- [ ] **Step 1: Verify the file is truly unreferenced**

Run: `grep -rn "SyncBanner" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile --include="*.ts" --include="*.tsx" | grep -v "docs/" | grep -v "SyncBanner.tsx:"`

Expected output: empty.

If anything appears outside the file itself, **stop** and read the file before deleting — something has changed since the spec.

- [ ] **Step 2: Delete the file**

```bash
rm /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/sync/components/SyncBanner.tsx
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: no new errors caused by the deletion. (Pre-existing repo errors, if any, are out of scope.)

- [ ] **Step 4: Lint**

Run: `npm run lint`

Expected: clean for `features/sync/`.

- [ ] **Step 5: Checkpoint for user review**

Working tree now has one deleted file. Stop. The user will inspect and commit.

---

## Task 2 — Consolidate attachment-status hooks

**Files:**
- Delete: `features/attachments/hooks/useAttachmentSyncStatus.ts`
- Modify: `features/attachments/hooks/useAttachmentStatus.ts`
- Modify: `features/sync/components/SyncCenter.tsx`
- Modify: `features/sync/components/SyncStatusCard.tsx`

**Why:** Both hooks run `SELECT state, COUNT(*) FROM attachments_local GROUP BY state` and return overlapping data. `useAttachmentStatus` adds `lowStorage`; `useAttachmentSyncStatus` adds `total`, `inFlight`, `isDownloading`, `progress`. Merging deletes 45 lines of near-duplicate code and avoids the bug-class where the two hooks drift apart.

The merged hook keeps the name `useAttachmentStatus` (it was older and used by the Sync Sheet, which is the higher-traffic surface). The field `pending` is renamed to `queued` to match `ATTACHMENT_STATES.QUEUED` and the schema column value.

- [ ] **Step 1: Rewrite `useAttachmentStatus.ts` with the merged shape**

Open `features/attachments/hooks/useAttachmentStatus.ts` and replace its full contents with:

```ts
import { useEffect, useState } from "react";
import { useQuery } from "@powersync/react-native";
import { attachmentQueue } from "../attachments.queue";

type CountRow = { state: string; n: number };

export type AttachmentStatus = {
  queued: number;
  downloading: number;
  synced: number;
  failed: number;
  total: number;
  inFlight: number;
  isDownloading: boolean;
  progress: number;
  lowStorage: boolean;
};

export function useAttachmentStatus(): AttachmentStatus {
  const { data } = useQuery<CountRow>(
    "SELECT state, COUNT(*) AS n FROM attachments_local GROUP BY state",
  );

  const [lowStorage, setLowStorage] = useState(attachmentQueue.isLowStorage());

  useEffect(() => {
    return attachmentQueue.onChange(() => {
      setLowStorage(attachmentQueue.isLowStorage());
    });
  }, []);

  const counts = { queued: 0, downloading: 0, synced: 0, failed: 0 };
  for (const row of data ?? []) {
    if (row.state === "queued") counts.queued = row.n;
    else if (row.state === "downloading") counts.downloading = row.n;
    else if (row.state === "synced") counts.synced = row.n;
    else if (row.state === "failed") counts.failed = row.n;
  }

  const total = counts.queued + counts.downloading + counts.synced + counts.failed;
  const inFlight = counts.queued + counts.downloading;

  return {
    ...counts,
    total,
    inFlight,
    isDownloading: inFlight > 0,
    progress: total > 0 ? counts.synced / total : 1,
    lowStorage,
  };
}
```

- [ ] **Step 2: Delete the duplicate hook**

```bash
rm /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/attachments/hooks/useAttachmentSyncStatus.ts
```

- [ ] **Step 3: Update `SyncCenter.tsx` import**

Open `features/sync/components/SyncCenter.tsx`. Find the import (around line 15):

```tsx
import { useAttachmentSyncStatus } from "@/features/attachments/hooks/useAttachmentSyncStatus";
```

Replace with:

```tsx
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
```

Find the destructure (around line 32):

```tsx
const { isDownloading: attachmentsDownloading, failed: attachmentsFailed } =
  useAttachmentSyncStatus();
```

Replace `useAttachmentSyncStatus()` with `useAttachmentStatus()`:

```tsx
const { isDownloading: attachmentsDownloading, failed: attachmentsFailed } =
  useAttachmentStatus();
```

No other changes — the destructured fields `isDownloading` and `failed` are already on the merged shape.

- [ ] **Step 4: Update `SyncStatusCard.tsx` import**

Open `features/sync/components/SyncStatusCard.tsx`. Find the import (around line 6):

```tsx
import { useAttachmentSyncStatus } from "@/features/attachments/hooks/useAttachmentSyncStatus";
```

Replace with:

```tsx
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
```

Find the call (around line 165):

```tsx
const attachments = useAttachmentSyncStatus();
```

Replace with:

```tsx
const attachments = useAttachmentStatus();
```

The destructured fields used downstream (`total`, `synced`, `inFlight`, `failed`) are unchanged — they're all on the merged shape.

- [ ] **Step 5: Verify no other consumers reference the deleted hook**

Run: `grep -rn "useAttachmentSyncStatus" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile --include="*.ts" --include="*.tsx" | grep -v "docs/"`

Expected output: empty.

- [ ] **Step 6: Verify the renamed field is not referenced anywhere**

The old `useAttachmentStatus` returned `pending` (now renamed to `queued`). Confirm no consumer reads `.pending` on an attachment status:

Run: `grep -rn "useAttachmentStatus" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile --include="*.ts" --include="*.tsx" -A 6 | grep -E "\.pending\b"`

Expected output: empty. (The current `SyncSheet.tsx` reads only `.lowStorage` and `.failed`, so this should be clean.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`

Expected: no new errors. TypeScript will flag any remaining `useAttachmentSyncStatus` reference or `.pending` field access.

- [ ] **Step 8: Lint**

Run: `npm run lint`

Expected: clean for `features/attachments/` and `features/sync/`.

- [ ] **Step 9: Checkpoint for user review**

Stop. User inspects + commits.

---

## Task 3 — Watcher 30 s auto-heal backoff

**Files:**
- Modify: `features/attachments/attachments.watcher.ts`

**Why:** Today every PowerSync change tick (debounced 250 ms) re-arms every FAILED attachment with `retry_count < AUTO_RETRY_CAP` back to QUEUED. During a real outage this burns the retry budget in seconds and bursts a request per row at the server. Adding a 30 s minimum age on `updated_at` gives transient failures a cooldown without blocking push-driven retries (which use a separate code path in `attachments.api.ts:79-99`).

The predicate has to use `datetime(updated_at)` because `updated_at` is stored as ISO 8601 (`new Date().toISOString()` → `2026-06-14T10:00:00.000Z`) while `datetime('now', '-30 seconds')` returns SQLite's `YYYY-MM-DD HH:MM:SS` format. Raw string comparison is wrong (`T` is greater than space lexicographically). Wrapping with `datetime()` normalizes both sides to SQLite's numeric Julian representation.

- [ ] **Step 1: Modify the auto-heal `UPDATE` in `scanColumn`**

Open `features/attachments/attachments.watcher.ts`. Find the auto-heal block (around lines 46-57):

```ts
    // Auto-heal: if this attachment was previously FAILED and we still have
    // retry budget, flip it back to QUEUED so a code/URL fix recovers without
    // user action. Manual retry resets retry_count to 0 to bypass the cap.
    await powersync.execute(
      `UPDATE attachments_local
       SET state = ?, error = NULL, updated_at = ?
       WHERE id = ? AND state = ? AND retry_count < ?`,
      [
        ATTACHMENT_STATES.QUEUED,
        now,
        id,
        ATTACHMENT_STATES.FAILED,
        AUTO_RETRY_CAP,
      ],
    );
```

Replace it with the cooldown-guarded version:

```ts
    // Auto-heal: if this attachment was previously FAILED and we still have
    // retry budget, flip it back to QUEUED so a code/URL fix recovers without
    // user action. The 30 s `updated_at` cooldown stops a server outage from
    // burning the retry budget in one burst — pushes still force-retry via
    // `enqueuePushAttachments`, which has its own code path. Manual retry
    // resets retry_count to 0 to bypass the cap.
    //
    // `datetime(updated_at)` is required because rows store ISO 8601 strings
    // while `datetime('now', ...)` returns SQLite's `YYYY-MM-DD HH:MM:SS`;
    // wrapping both sides normalizes them to the numeric Julian rep.
    await powersync.execute(
      `UPDATE attachments_local
       SET state = ?, error = NULL, updated_at = ?
       WHERE id = ? AND state = ? AND retry_count < ?
         AND datetime(updated_at) < datetime('now', '-30 seconds')`,
      [
        ATTACHMENT_STATES.QUEUED,
        now,
        id,
        ATTACHMENT_STATES.FAILED,
        AUTO_RETRY_CAP,
      ],
    );
```

- [ ] **Step 2: Confirm `enqueuePushAttachments` is unchanged**

Open `features/attachments/attachments.api.ts`. The forceful FAILED → QUEUED `UPDATE` around lines 79-99 must remain unchanged — pushes are intentionally exempt from the cooldown because the user just expressed intent by tapping the notification.

No edits in this file. This is a verification step only.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: no new errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`

Expected: clean for `features/attachments/`.

- [ ] **Step 5: Checkpoint for user review**

Stop. User inspects + commits.

---

## Task 4 — Attachment queue 401 → awaited refresh

**Files:**
- Modify: `features/attachments/attachments.queue.ts`

**Why:** The current 1 s `setTimeout` in the 401 branch of `processOne` (lines 200-201) is "wait and hope someone else called `silentRefresh`." Nothing else fires `silentRefresh` for an attachment 401 — the foreground poll runs on a 60 s cadence and only refreshes within the 5 min expiry buffer. So in the common case the retry runs with the same expired token and fails again.

The fix is a one-line swap: `await silentRefresh({ force: true })` in place of the sleep. `silentRefresh` is dedup'd via `inflightRefresh` (see `useTokenRefresh.ts:25`), so a concurrent refresh from any other code path joins the same in-flight promise — no thundering herd.

When `silentRefresh` returns `false` (offline / no refresh token / failed refresh / forced logout), `useStore.getState().accessToken` will either be the unchanged old token or empty. The existing `if (refreshedToken && refreshedToken !== "")` guard below handles both cases by falling through to the outer catch's `markFailed`/`markPermanentlyFailed` block. No new branches required.

- [ ] **Step 1: Import `silentRefresh`**

Open `features/attachments/attachments.queue.ts`. At the top of the file, alongside the existing imports, add:

```ts
import { silentRefresh } from "@/features/auth/useTokenRefresh";
```

Keep all other imports as they are.

- [ ] **Step 2: Replace the 1 s sleep with the awaited forced refresh**

Find this block in `processOne` (around lines 200-203):

```ts
        this.retried.add(row.id);
        // Allow the auth slice's refresh flow to land before retrying.
        await new Promise((r) => setTimeout(r, 1000));
        const refreshedToken = useStore.getState().accessToken;
```

Replace it with:

```ts
        this.retried.add(row.id);
        // Force a token rotation before retrying. `silentRefresh` is dedup'd
        // via `inflightRefresh`, so concurrent callers join the same promise.
        // On failure (offline / dead refresh token / forced logout) the store
        // either holds the old empty token or signOut has cleared it; either
        // way the `refreshedToken` guard below routes the row to markFailed.
        await silentRefresh({ force: true });
        const refreshedToken = useStore.getState().accessToken;
```

No other code in `processOne` changes — the existing `if (refreshedToken && refreshedToken !== "")` block and its inner retry logic stay exactly as written.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: no new errors. (TS will flag the import if the path is wrong.)

- [ ] **Step 4: Lint**

Run: `npm run lint`

Expected: clean for `features/attachments/`.

- [ ] **Step 5: Checkpoint for user review**

Stop. User inspects + commits.

---

## Task 5 — Connector CRUD 401 → forced refresh

**Files:**
- Modify: `powersync/Connector.ts`

**Why:** `uploadData` re-throws any non-2xx to keep PowerSync retrying, but it never asks the auth layer to rotate the token. The next retry uses the same expired token until something else (foreground poll, axios interceptor on an unrelated request) refreshes. For users actively writing while offline-then-online, this can mean a backlog of CRUD ops sits in `ps_crud` for a full minute.

We extract a `fetchOpWithAuthRetry` helper that wraps every `fetchAndLog` call site in `uploadData` with a 401-recovery path: catch a 401 → `await silentRefresh({ force: true })` → retry the same op **once** with the rotated token. JSON and multipart op shapes differ (JSON sets `Content-Type`, multipart omits it so the runtime sets the boundary), so each call site passes a `rebuildAuthHeader` callback that knows how to merge the new token into its own header shape.

`silentRefresh` is already imported in this file (line 9).

- [ ] **Step 1: Add the `fetchOpWithAuthRetry` helper near the top of the file**

Open `powersync/Connector.ts`. Find the existing `fetchAndLog` function (starts around line 64). Immediately **after** the closing `}` of `fetchAndLog` (around line 104), and **before** the commented-out logger lines (around line 106), insert the new helper:

```ts
/**
 * Wraps a single CRUD op fetch with a 401-recovery retry. On a 401 from the
 * server, forces a token rotation via silentRefresh and retries the same op
 * once with the rotated token. Any other error — including a second 401 after
 * refresh — re-throws so PowerSync re-queues the transaction normally.
 *
 * Each call site passes `rebuildAuthHeader(token)` because JSON and multipart
 * op shapes use different header sets, and the retry must preserve the right
 * shape (multipart omits `Content-Type` so the runtime can set the boundary).
 */
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
    if (!refreshed) throw err;

    const refreshedToken = useStore.getState().accessToken;
    if (!refreshedToken) throw err;

    return await fetchAndLog(`${label} (retry-after-refresh)`, url, {
      ...init,
      headers: rebuildAuthHeader(refreshedToken),
    });
  }
}
```

- [ ] **Step 2: Replace the PUT-multipart call site**

In `uploadData`, find the PUT-multipart branch (around lines 186-202):

```ts
            if (hasFile) {
              const multipartHeaders: Record<string, string> = {
                Accept: "application/json",
                "X-Platform": "mobile",
              };
              if (accessToken)
                multipartHeaders.Authorization = `Bearer ${accessToken}`;

              await fetchAndLog(
                `PUT-multipart ${op.table} ${op.id}`,
                instanceUrl,
                {
                  method: "PUT",
                  headers: multipartHeaders,
                  body: buildMultipartBody(record),
                },
              );
            } else {
```

Replace the `await fetchAndLog(...)` call (keep the `multipartHeaders` block above it unchanged) with:

```ts
              await fetchOpWithAuthRetry(
                `PUT-multipart ${op.table} ${op.id}`,
                instanceUrl,
                {
                  method: "PUT",
                  headers: multipartHeaders,
                  body: buildMultipartBody(record),
                },
                (token) => ({
                  Accept: "application/json",
                  "X-Platform": "mobile",
                  Authorization: `Bearer ${token}`,
                }),
              );
```

- [ ] **Step 3: Replace the PUT-json call site**

Find the PUT-json branch (around lines 203-213):

```ts
            } else {
              await fetchAndLog(
                `PUT-json ${op.table} ${op.id}`,
                instanceUrl,
                {
                  method: "PUT",
                  headers,
                  body: JSON.stringify(record),
                },
              );
            }
            break;
```

Replace the `await fetchAndLog(...)` call with:

```ts
            } else {
              await fetchOpWithAuthRetry(
                `PUT-json ${op.table} ${op.id}`,
                instanceUrl,
                {
                  method: "PUT",
                  headers,
                  body: JSON.stringify(record),
                },
                (token) => ({ ...headers, Authorization: `Bearer ${token}` }),
              );
            }
            break;
```

- [ ] **Step 4: Replace the PATCH-multipart call site**

Find the PATCH-multipart branch (around lines 215-231):

```ts
            if (hasFile) {
              const authHeaders: Record<string, string> = {
                Accept: "application/json",
                "X-Platform": "mobile",
              };
              if (accessToken)
                authHeaders.Authorization = `Bearer ${accessToken}`;
              await fetchAndLog(
                `PATCH-multipart ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                {
                  method: "PATCH",
                  headers: authHeaders,
                  body: buildMultipartBody({ ...op.opData }),
                },
              );
            } else {
```

Replace the `await fetchAndLog(...)` call (keep `authHeaders` build above it) with:

```ts
              await fetchOpWithAuthRetry(
                `PATCH-multipart ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                {
                  method: "PATCH",
                  headers: authHeaders,
                  body: buildMultipartBody({ ...op.opData }),
                },
                (token) => ({
                  Accept: "application/json",
                  "X-Platform": "mobile",
                  Authorization: `Bearer ${token}`,
                }),
              );
```

- [ ] **Step 5: Replace the PATCH-json call site**

Find the PATCH-json branch (around lines 232-242):

```ts
            } else {
              await fetchAndLog(
                `PATCH-json ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                {
                  method: "PATCH",
                  headers,
                  body: JSON.stringify(op.opData),
                },
              );
            }
            break;
```

Replace with:

```ts
            } else {
              await fetchOpWithAuthRetry(
                `PATCH-json ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
                {
                  method: "PATCH",
                  headers,
                  body: JSON.stringify(op.opData),
                },
                (token) => ({ ...headers, Authorization: `Bearer ${token}` }),
              );
            }
            break;
```

- [ ] **Step 6: Replace the DELETE call site**

Find the DELETE branch (around lines 244-249):

```ts
          case UpdateType.DELETE:
            await fetchAndLog(
              `DELETE ${op.table} ${op.id}`,
              `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
              { method: "DELETE", headers },
            );
            break;
```

Replace with:

```ts
          case UpdateType.DELETE:
            await fetchOpWithAuthRetry(
              `DELETE ${op.table} ${op.id}`,
              `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
              { method: "DELETE", headers },
              (token) => ({ ...headers, Authorization: `Bearer ${token}` }),
            );
            break;
```

- [ ] **Step 7: Verify no direct `fetchAndLog` calls remain in `uploadData`**

Run: `grep -n "fetchAndLog" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/powersync/Connector.ts`

Expected: only three matches — the function definition (`async function fetchAndLog(`), the call inside `fetchOpWithAuthRetry` (`return await fetchAndLog(label, url, init);`), and the retry call inside `fetchOpWithAuthRetry` (`return await fetchAndLog(\`${label} (retry-after-refresh)\`, ...)`).

If there's a `fetchAndLog` call anywhere else, a call site was missed in Steps 2-6. Go back and replace it.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`

Expected: no new errors.

- [ ] **Step 9: Lint**

Run: `npm run lint`

Expected: clean for `powersync/`.

- [ ] **Step 10: Checkpoint for user review**

Stop. User inspects + commits.

---

## Task 6 — Manual smoke verification

**Files:** none modified — this task is verification only.

**Why:** This repo has no automated test harness for the Connector or the attachment queue. We confirm each fix manually on a dev build before considering the PR complete. Each scenario is small and quick (≤2 minutes).

Run a dev build: `npm run start:dev`, then `npm run ios` (or `android`) in a second terminal.

- [ ] **Step 1: Smoke — CRUD 401 forced refresh**

Goal: confirm `Connector.uploadData` triggers `silentRefresh` on a 401 and the retry uses the rotated token.

Setup:
1. Sign in as a test student account.
2. In React Native Debugger or via `useStore.getState()` in the app's dev console, manually expire the access token: `useStore.getState().setAccessToken("expired.fake.token")`. Leave the refresh token intact.
3. Trigger any local mutation that hits `Connector.uploadData` — submitting an activity attempt, marking an announcement read, anything that writes a synced table.

Expected logs from `[Connector]`:
- First `response` log with `status: 401`
- A `[TokenRefresh] Tokens refreshed silently` log immediately after
- A second `response` log with `status: 2xx` and the label ending `(retry-after-refresh)`

If the second `response` is `401` again, check that `silentRefresh` is producing a fresh token (compare `accessToken` before/after via the dev console).

- [ ] **Step 2: Smoke — attachment 401 forced refresh**

Goal: confirm `AttachmentQueue.processOne` awaits `silentRefresh` (no 1 s sleep) on a 401 and retries with the rotated token.

Setup:
1. Sign in. Confirm at least one attachment is queued (open any screen that has student photos or activity files; pull-to-refresh).
2. Expire the access token in the dev console as in Step 1.
3. Force-poke the queue by triggering a fresh PowerSync change (e.g., touch a tracked row), or wait for the next scheduled tick.

Expected logs:
- Attachment fetch fails with 401 (look for `[Connector] metaUrl ...` followed by a 401-ish error, or `[attachments] failed ...`)
- A `[TokenRefresh] Tokens refreshed silently` log within ~100 ms (not a full 1 s)
- The retry attempt logs success (`state` transitions to `synced`)

Negative case: kill the network (airplane mode), expire the token, trigger a fetch. The 401 attempt fails → `silentRefresh` returns `false` (offline guard) → row ends up in `failed` state with `retry_count` incremented. No infinite loop.

- [ ] **Step 3: Smoke — watcher 30 s cooldown**

Goal: confirm the auto-heal `UPDATE` no longer re-arms a freshly-failed row for 30 s.

Setup:
1. In the dev SQLite tool (Drizzle Studio is wired via `expo-drizzle-studio-plugin` in this repo), pick one or two `attachments_local` rows and manually set them to `state = 'failed'`, `retry_count = 1`, `updated_at = (current ISO timestamp)`. Note the `id`s.
2. Touch any tracked-table row to trigger the watcher (e.g., insert a no-op update via `powersync.execute("UPDATE accounts_profile SET ... WHERE ...")`).

Expected:
- Immediately after the watcher tick: those rows stay `failed`. They do **not** flip to `queued`.
- Wait 30 s. Touch another tracked-table row.
- After this second tick: rows now flip to `queued` and the worker re-attempts.

Push-driven retry stays immediate (this verifies we didn't break it):
1. Repeat Setup step 1 to mark a row `failed`.
2. Send a push notification carrying `attachment_refs` referencing that row's id (or, easier in dev: call `enqueuePushAttachments([{ id, resource }])` directly from a dev-tool button).

Expected: row flips to `queued` immediately — the 30 s cooldown does not apply.

- [ ] **Step 4: Smoke — hook consolidation didn't regress UI**

Goal: confirm the SyncCenter icon and SyncSheet content render identically to before.

Steps:
1. Cold-start the app, sign in.
2. Observe the SyncCenter icon in `TabsHeader` — connection state, pulse on activity, attachment-failed badge if applicable.
3. Tap the icon. Confirm the SyncSheet shows: Connection, Sync Activity, Attachments (`N of M downloaded` or `All N downloaded`), Last Synced, Pending Changes.
4. Force an attachment failure (mark a row `failed`); confirm the red "N attachment failed to download" alert with Retry-all button still appears.
5. Trigger low-storage state if possible (or stub `attachmentQueue.isLowStorage` to return `true` via the dev console); confirm the amber low-storage warning still shows.

Expected: no visual regressions.

- [ ] **Step 5: Smoke — dead-code deletion didn't break a forgotten consumer**

Run `grep -rn "SyncBanner" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile --include="*.ts" --include="*.tsx"` one more time.

Expected: only matches in `docs/`. No imports anywhere in app code.

- [ ] **Step 6: Final checkpoint**

If all five smoke steps pass, the PR is verification-complete. Stop and let the user open the PR.

---

## Out of scope (deferred to PR 2)

For traceability — these belong to the Sync Center reimagine, not this PR:

- Full-screen `/sync` route replacing the Dialog modal.
- `sync_events_local` ring buffer for per-request event logging.
- `ps_crud_meta_local` sidecar and the Stuck Items lane.
- CRUD 4xx "permanent fail" classification (today, 4xx retries forever).
- Icon health-light, 44 pt tap target, dark-mode theming via `useThemeColor`.
- Surfacing `pendingChanges` from `useSyncData` (today only the count is shown).
- Per-item retry / dismiss for failed attachments.
- Reconnect button rewording, copy review, full accessibility audit.
- Promoting `StreamList` from dev-only to a prod-visible "Advanced" disclosure.
