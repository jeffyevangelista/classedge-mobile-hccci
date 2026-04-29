# PowerSync Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline-first attachment download queue that eagerly caches files referenced by PowerSync rows and exposes them via a `useAttachment` hook.

**Architecture:** A local-only SQLite table (created inside the PowerSync DB but excluded from sync) tracks each attachment's lifecycle. A watcher subscribes to PowerSync table changes to enqueue new paths. A worker drains the queue in priority order, downloading via the JSON API and saving files under `documentDirectory/attachments/`. UI consumes a hook that subscribes to the local table for reactive URIs.

**Tech Stack:** React Native + Expo, PowerSync (`@powersync/react-native@1.34`, `@powersync/drizzle-driver`), drizzle-orm, expo-file-system, zustand store, expo-image.

**Note on testing:** This codebase has no unit test framework configured. The plan uses **manual verification steps** in place of automated unit tests. Modules are designed as small, pure-where-possible functions so unit tests can be added later without restructuring.

**Spec:** `docs/superpowers/specs/2026-04-30-attachments-design.md`

---

## File Structure

**New files:**

```
features/attachments/
  attachments.config.ts        Column → { resource, priority } map + id extraction
  attachments.schema.ts        Drizzle table definition for attachments_local
  attachments.fetcher.ts       Pure fn: download a single attachment to disk
  attachments.queue.ts         Worker singleton (start, stop, retry, drain loop)
  attachments.watcher.ts       Subscribes to PowerSync changes, upserts queue rows
  attachments.api.ts           Public retry/status functions for UI
  hooks/
    useAttachment.ts           (path) → { uri, state, error, retry }
    useFailedAttachments.ts    Subscription to FAILED rows
    useAttachmentStatus.ts     Aggregate status: low storage, counts
  components/
    AttachmentImage.tsx        expo-image with skeleton + error UI
```

**Modified files:**

- `powersync/system.ts` — bootstrap CREATE TABLE for local attachments table
- `providers/PowerSyncProvider.tsx` — start/stop watcher + queue with provider lifecycle

---

### Task 1: Add local attachments table to PowerSync DB

**Files:**
- Create: `features/attachments/attachments.schema.ts`
- Modify: `powersync/system.ts`

- [ ] **Step 1: Create the Drizzle table definition**

Create `features/attachments/attachments.schema.ts`:

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const attachmentsLocalTable = sqliteTable("attachments_local", {
  id: text("id").primaryKey(),
  resource: text("resource").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceCol: text("source_col").notNull(),
  priority: integer("priority").notNull(),
  state: text("state").notNull(),
  localUri: text("local_uri"),
  sizeBytes: integer("size_bytes"),
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export type AttachmentState = "queued" | "downloading" | "synced" | "failed";

export const ATTACHMENT_STATES = {
  QUEUED: "queued",
  DOWNLOADING: "downloading",
  SYNCED: "synced",
  FAILED: "failed",
} as const;
```

- [ ] **Step 2: Add table creation to PowerSync setup**

Modify `powersync/system.ts`. Find the `setupPowerSync` function and add the table creation **before** `powersync.connect(connector)`:

```ts
export const setupPowerSync = async () => {
  await powersync.execute(`
    CREATE TABLE IF NOT EXISTS attachments_local (
      id TEXT PRIMARY KEY,
      resource TEXT NOT NULL,
      source_table TEXT NOT NULL,
      source_col TEXT NOT NULL,
      priority INTEGER NOT NULL,
      state TEXT NOT NULL,
      local_uri TEXT,
      size_bytes INTEGER,
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_attachments_state_priority ON attachments_local (state, priority);`,
  );
  const connector = new Connector();
  powersync.connect(connector);
};
```

- [ ] **Step 3: Manual verification**

Run `pnpm start --clear`, log in to the app. In a dev shell:

```bash
adb shell run-as com.classedge.hccci sqlite3 /path/to/powersync.db "SELECT name FROM sqlite_master WHERE type='table' AND name='attachments_local';"
```

Or simpler — add a one-time `console.log(await powersync.getAll("SELECT * FROM attachments_local"))` in `PowerSyncProvider` and confirm the query succeeds (returns `[]`).

Expected: query succeeds, no SQL error.

- [ ] **Step 4: Commit**

```bash
git add features/attachments/attachments.schema.ts powersync/system.ts
git commit -m "feat(attachments): add local attachments tracking table"
```

---

### Task 2: Attachment configuration and id extraction

**Files:**
- Create: `features/attachments/attachments.config.ts`

- [ ] **Step 1: Implement the config**

Create `features/attachments/attachments.config.ts`:

```ts
export type AttachmentColumnConfig = {
  table: string;
  column: string;
  resource: string;
  priority: number;
};

export const ATTACHMENT_COLUMNS: AttachmentColumnConfig[] = [
  {
    table: "accounts_profile",
    column: "student_photo",
    resource: "profile",
    priority: 1,
  },
  {
    table: "subject_subject",
    column: "subject_photo",
    resource: "subjectPhoto",
    priority: 1,
  },
  {
    table: "activity_studentactivity",
    column: "file",
    resource: "student_activity_files",
    priority: 1,
  },
  {
    table: "activity_retakerecorddetail",
    column: "upload_file",
    resource: "uploadDocuments",
    priority: 1,
  },
  {
    table: "module_module",
    column: "file",
    resource: "module",
    priority: 2,
  },
];

export const TRACKED_TABLES = Array.from(
  new Set(ATTACHMENT_COLUMNS.map((c) => c.table)),
);

export const MAX_CONCURRENT_DOWNLOADS = 3;
export const LOW_STORAGE_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Extracts the attachment id from a column value.
 * Returns null if the value is empty, a local file URI (pending upload), or unparseable.
 *
 * Examples:
 *   "/media/abc/"        -> "abc"
 *   "/media/abc.jpg"     -> "abc.jpg" (caller may strip ext if needed)
 *   "abc"                -> "abc"
 *   "file:///tmp/x.jpg"  -> null  (pending upload)
 *   ""                   -> null
 *   null                 -> null
 */
export function extractAttachmentId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("file://")) return null;
  const segments = value.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last && last.length > 0 ? last : null;
}
```

- [ ] **Step 2: Manual verification**

Add a temporary script `features/attachments/__verify.ts`:

```ts
import { extractAttachmentId } from "./attachments.config";

const cases: [string | null, string | null][] = [
  ["/media/abc/", "abc"],
  ["/media/abc.jpg", "abc.jpg"],
  ["abc", "abc"],
  ["file:///tmp/x.jpg", null],
  ["", null],
  [null, null],
];

for (const [input, expected] of cases) {
  const got = extractAttachmentId(input);
  console.log(
    got === expected ? "✓" : "✗",
    JSON.stringify(input),
    "→",
    JSON.stringify(got),
    expected !== got ? `(expected ${JSON.stringify(expected)})` : "",
  );
}
```

Import once from `app/_layout.tsx` (`import "@/features/attachments/__verify";`) and check Metro logs for `✓` on every line. Then **delete the temp file and the import**.

Expected: all six cases print `✓`.

- [ ] **Step 3: Commit**

```bash
git add features/attachments/attachments.config.ts
git commit -m "feat(attachments): add column config and id extraction"
```

---

### Task 3: Pure download fetcher

**Files:**
- Create: `features/attachments/attachments.fetcher.ts`

- [ ] **Step 1: Implement the fetcher**

Create `features/attachments/attachments.fetcher.ts`:

```ts
import * as FileSystem from "expo-file-system/legacy";
import { env } from "@/utils/env";

export type FetchedAttachment = {
  localUri: string;
  sizeBytes: number;
};

export class AttachmentFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly retriable: boolean,
  ) {
    super(message);
  }
}

const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ATTACHMENTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ATTACHMENTS_DIR, {
      intermediates: true,
    });
  }
}

function inferExt(url: string): string {
  const m = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return m ? m[1].toLowerCase() : "bin";
}

export async function fetchAttachment(
  resource: string,
  id: string,
  accessToken: string,
): Promise<FetchedAttachment> {
  await ensureDir();

  const metaUrl = `${env.EXPO_PUBLIC_API_URL}/api/${resource}/${id}/`;
  const metaRes = await fetch(metaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!metaRes.ok) {
    const retriable = metaRes.status >= 500 || metaRes.status === 401;
    throw new AttachmentFetchError(
      `Metadata fetch failed: ${metaRes.status}`,
      metaRes.status,
      retriable,
    );
  }

  const meta: { file?: string; binaryFile?: string } = await metaRes.json();

  if (!meta.file && !meta.binaryFile) {
    throw new AttachmentFetchError(
      "Response has neither file URL nor binaryFile",
      null,
      false,
    );
  }

  const ext = meta.file ? inferExt(meta.file) : "bin";
  const localUri = `${ATTACHMENTS_DIR}${id}.${ext}`;

  if (meta.file) {
    const result = await FileSystem.downloadAsync(meta.file, localUri);
    if (result.status >= 400) {
      // Fall through to binaryFile if present.
      if (!meta.binaryFile) {
        throw new AttachmentFetchError(
          `File URL returned ${result.status}`,
          result.status,
          result.status >= 500,
        );
      }
    } else {
      const info = await FileSystem.getInfoAsync(localUri, { size: true });
      return { localUri, sizeBytes: info.exists ? (info.size ?? 0) : 0 };
    }
  }

  // binaryFile fallback (base64).
  await FileSystem.writeAsStringAsync(localUri, meta.binaryFile!, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const info = await FileSystem.getInfoAsync(localUri, { size: true });
  return { localUri, sizeBytes: info.exists ? (info.size ?? 0) : 0 };
}
```

- [ ] **Step 2: Manual verification**

Add a temporary script `features/attachments/__verify-fetcher.ts`:

```ts
import { fetchAttachment } from "./attachments.fetcher";
import useStore from "@/lib/store";

export async function verify() {
  const token = useStore.getState().accessToken;
  if (!token) {
    console.log("no token, log in first");
    return;
  }
  // Replace with a real id you can read from your DB during a sync.
  const KNOWN_ID = "REPLACE_WITH_REAL_ID";
  try {
    const result = await fetchAttachment("profile", KNOWN_ID, token);
    console.log("fetched:", result);
  } catch (e) {
    console.error("fetch failed:", e);
  }
}
```

Call it once from a button (or `app/_layout.tsx` `useEffect`), inspect logs. After verifying, delete the temp file.

Expected: console logs `fetched: { localUri: 'file:///.../attachments/REPLACE_WITH_REAL_ID.jpg', sizeBytes: <nonzero> }` and the file exists on disk.

- [ ] **Step 3: Commit**

```bash
git add features/attachments/attachments.fetcher.ts
git commit -m "feat(attachments): add pure download fetcher"
```

---

### Task 4: Queue worker singleton

**Files:**
- Create: `features/attachments/attachments.queue.ts`

- [ ] **Step 1: Implement the worker**

Create `features/attachments/attachments.queue.ts`:

```ts
import * as FileSystem from "expo-file-system/legacy";
import { powersync } from "@/powersync/system";
import useStore from "@/lib/store";
import {
  fetchAttachment,
  AttachmentFetchError,
} from "./attachments.fetcher";
import {
  LOW_STORAGE_THRESHOLD_BYTES,
  MAX_CONCURRENT_DOWNLOADS,
} from "./attachments.config";
import { ATTACHMENT_STATES } from "./attachments.schema";

type Row = {
  id: string;
  resource: string;
  priority: number;
  retry_count: number;
};

class AttachmentQueue {
  private running = false;
  private inFlight = new Set<string>();
  private lowStorage = false;
  private listeners = new Set<() => void>();

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.resetZombies().then(() => this.tick());
  }

  stop(): void {
    this.running = false;
  }

  isLowStorage(): boolean {
    return this.lowStorage;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  /**
   * Reset rows stuck in DOWNLOADING from a previous session.
   */
  private async resetZombies(): Promise<void> {
    await powersync.execute(
      `UPDATE attachments_local SET state = ?, updated_at = ? WHERE state = ?`,
      [
        ATTACHMENT_STATES.QUEUED,
        new Date().toISOString(),
        ATTACHMENT_STATES.DOWNLOADING,
      ],
    );
  }

  private async checkStorage(): Promise<boolean> {
    try {
      const free = await FileSystem.getFreeDiskStorageAsync();
      const enough = free > LOW_STORAGE_THRESHOLD_BYTES;
      if (this.lowStorage !== !enough) {
        this.lowStorage = !enough;
        this.notify();
      }
      return enough;
    } catch {
      return true; // fail open
    }
  }

  private async pickNext(): Promise<Row | null> {
    const rows = await powersync.getAll<Row>(
      `SELECT id, resource, priority, retry_count
       FROM attachments_local
       WHERE state = ?
       ORDER BY priority ASC, updated_at ASC
       LIMIT 1`,
      [ATTACHMENT_STATES.QUEUED],
    );
    return rows[0] ?? null;
  }

  private async markDownloading(id: string): Promise<void> {
    await powersync.execute(
      `UPDATE attachments_local SET state = ?, updated_at = ? WHERE id = ? AND state = ?`,
      [
        ATTACHMENT_STATES.DOWNLOADING,
        new Date().toISOString(),
        id,
        ATTACHMENT_STATES.QUEUED,
      ],
    );
  }

  private async markSynced(
    id: string,
    localUri: string,
    sizeBytes: number,
  ): Promise<void> {
    await powersync.execute(
      `UPDATE attachments_local
       SET state = ?, local_uri = ?, size_bytes = ?, error = NULL, updated_at = ?
       WHERE id = ?`,
      [
        ATTACHMENT_STATES.SYNCED,
        localUri,
        sizeBytes,
        new Date().toISOString(),
        id,
      ],
    );
  }

  private async markFailed(id: string, error: string): Promise<void> {
    await powersync.execute(
      `UPDATE attachments_local
       SET state = ?, error = ?, retry_count = retry_count + 1, updated_at = ?
       WHERE id = ?`,
      [
        ATTACHMENT_STATES.FAILED,
        error,
        new Date().toISOString(),
        id,
      ],
    );
  }

  private async processOne(row: Row): Promise<void> {
    if (this.inFlight.has(row.id)) return;
    this.inFlight.add(row.id);
    try {
      await this.markDownloading(row.id);
      const token = useStore.getState().accessToken;
      if (!token) {
        await this.markFailed(row.id, "Not authenticated");
        return;
      }
      const { localUri, sizeBytes } = await fetchAttachment(
        row.resource,
        row.id,
        token,
      );
      await this.markSynced(row.id, localUri, sizeBytes);
    } catch (e) {
      const msg =
        e instanceof AttachmentFetchError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      await this.markFailed(row.id, msg);
    } finally {
      this.inFlight.delete(row.id);
      this.notify();
      if (this.running) void this.tick();
    }
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    if (this.inFlight.size >= MAX_CONCURRENT_DOWNLOADS) return;
    if (!(await this.checkStorage())) return;

    const next = await this.pickNext();
    if (!next) return;

    void this.processOne(next);
    if (this.inFlight.size < MAX_CONCURRENT_DOWNLOADS) {
      void this.tick();
    }
  }

  /**
   * Called by watcher and retry actions to nudge the worker.
   */
  poke(): void {
    if (this.running) void this.tick();
  }
}

export const attachmentQueue = new AttachmentQueue();
```

- [ ] **Step 2: Manual verification**

Skip this for now — Task 5 (watcher) feeds the queue. Verification happens end-to-end in Task 6.

- [ ] **Step 3: Commit**

```bash
git add features/attachments/attachments.queue.ts
git commit -m "feat(attachments): add queue worker with priority and retry"
```

---

### Task 5: Watcher (enqueues paths from PowerSync rows)

**Files:**
- Create: `features/attachments/attachments.watcher.ts`

- [ ] **Step 1: Implement the watcher**

Create `features/attachments/attachments.watcher.ts`:

```ts
import { powersync } from "@/powersync/system";
import {
  ATTACHMENT_COLUMNS,
  TRACKED_TABLES,
  extractAttachmentId,
  type AttachmentColumnConfig,
} from "./attachments.config";
import { ATTACHMENT_STATES } from "./attachments.schema";
import { attachmentQueue } from "./attachments.queue";

type Row = Record<string, unknown> & { [key: string]: unknown };

async function scanColumn(cfg: AttachmentColumnConfig): Promise<void> {
  const rows = await powersync.getAll<Row>(
    `SELECT ${cfg.column} AS val FROM ${cfg.table} WHERE ${cfg.column} IS NOT NULL AND ${cfg.column} <> ''`,
  );

  if (rows.length === 0) return;

  const now = new Date().toISOString();
  for (const r of rows) {
    const id = extractAttachmentId(r.val as string | null | undefined);
    if (!id) continue;

    // INSERT OR IGNORE ensures we don't reset state for already-tracked attachments.
    await powersync.execute(
      `INSERT OR IGNORE INTO attachments_local
        (id, resource, source_table, source_col, priority, state, retry_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        cfg.resource,
        cfg.table,
        cfg.column,
        cfg.priority,
        ATTACHMENT_STATES.QUEUED,
        now,
      ],
    );
  }
}

export async function scanAllColumns(): Promise<void> {
  for (const cfg of ATTACHMENT_COLUMNS) {
    try {
      await scanColumn(cfg);
    } catch (e) {
      console.warn(`[attachments] scan failed for ${cfg.table}.${cfg.column}`, e);
    }
  }
  attachmentQueue.poke();
}

export function startAttachmentWatcher(): () => void {
  const abort = new AbortController();

  // Initial scan covers returning users / data already in DB.
  void scanAllColumns();

  // Subscribe to changes on tracked tables.
  powersync.onChangeWithCallback(
    {
      onChange: () => {
        void scanAllColumns();
      },
      onError: (e) => {
        console.warn("[attachments] watcher error", e);
      },
    },
    {
      tables: TRACKED_TABLES,
      signal: abort.signal,
    },
  );

  return () => abort.abort();
}
```

- [ ] **Step 2: Manual verification**

Defer to Task 6 — bootstrap is the integration point that lets us see end-to-end behavior.

- [ ] **Step 3: Commit**

```bash
git add features/attachments/attachments.watcher.ts
git commit -m "feat(attachments): add watcher that enqueues from PowerSync rows"
```

---

### Task 6: Bootstrap watcher and worker from PowerSyncProvider

**Files:**
- Modify: `providers/PowerSyncProvider.tsx`

- [ ] **Step 1: Wire start/stop into the provider lifecycle**

Modify `providers/PowerSyncProvider.tsx`. Add the imports at the top:

```ts
import { startAttachmentWatcher } from "@/features/attachments/attachments.watcher";
import { attachmentQueue } from "@/features/attachments/attachments.queue";
```

Inside the `useEffect` of `PowerSyncProvider`, after `setIsReady(true)` in the success path, start the queue and watcher (only when authenticated and online — otherwise stop them). The full revised `useEffect` body:

```ts
useEffect(() => {
  let stopWatcher: (() => void) | undefined;

  const initialize = async () => {
    try {
      await powersync.init();
      logDbPath();

      if (accessToken && isOnline) {
        if (!wasConnectedRef.current) {
          await setupPowerSync();
          wasConnectedRef.current = true;
        }
        attachmentQueue.start();
        stopWatcher = startAttachmentWatcher();
      } else {
        await powersync.disconnect();
        wasConnectedRef.current = false;
        attachmentQueue.stop();
      }

      setIsReady(true);
    } catch (error) {
      console.error("PowerSync initialization failed:", error);
      setIsReady(true);
    }
  };

  initialize();

  return () => {
    stopWatcher?.();
    attachmentQueue.stop();
  };
}, [accessToken, isOnline]);
```

- [ ] **Step 2: Manual verification**

1. Fresh install + login. Watch Metro logs.
2. After SyncGate lifts, run this query (via a temporary `console.log` in any screen):

```ts
import { powersync } from "@/powersync/system";
const rows = await powersync.getAll(
  "SELECT state, COUNT(*) as n FROM attachments_local GROUP BY state",
);
console.log("[attachments]", rows);
```

Expected within ~30s of login: counts shifting from `queued` → `downloading` → `synced`. Eventually most should be `synced`. Some may be `failed` if specific endpoints 404 — that's data, not a bug.

3. Open the device file system (or use `adb pull`) to confirm files exist under `documentDirectory/attachments/`.

- [ ] **Step 3: Commit**

```bash
git add providers/PowerSyncProvider.tsx
git commit -m "feat(attachments): bootstrap watcher and queue with provider lifecycle"
```

---

### Task 7: useAttachment hook

**Files:**
- Create: `features/attachments/hooks/useAttachment.ts`

- [ ] **Step 1: Implement the hook**

Create `features/attachments/hooks/useAttachment.ts`:

```ts
import { useQuery } from "@powersync/react-native";
import { useCallback } from "react";
import { powersync } from "@/powersync/system";
import { extractAttachmentId } from "../attachments.config";
import { attachmentQueue } from "../attachments.queue";
import {
  ATTACHMENT_STATES,
  type AttachmentState,
} from "../attachments.schema";

type Row = {
  state: AttachmentState;
  local_uri: string | null;
  error: string | null;
};

export type UseAttachmentResult = {
  uri: string | undefined;
  state: AttachmentState | "unknown";
  error: string | undefined;
  retry: () => void;
};

export function useAttachment(
  path: string | null | undefined,
): UseAttachmentResult {
  const id = extractAttachmentId(path);

  const { data } = useQuery<Row>(
    "SELECT state, local_uri, error FROM attachments_local WHERE id = ?",
    id ? [id] : [""],
  );

  const row = id ? data[0] : undefined;

  const retry = useCallback(() => {
    if (!id) return;
    void (async () => {
      await powersync.execute(
        `UPDATE attachments_local
         SET state = ?, error = NULL, updated_at = ?
         WHERE id = ?`,
        [ATTACHMENT_STATES.QUEUED, new Date().toISOString(), id],
      );
      attachmentQueue.poke();
    })();
  }, [id]);

  if (!id) {
    return { uri: undefined, state: "unknown", error: undefined, retry };
  }

  if (!row) {
    return { uri: undefined, state: "unknown", error: undefined, retry };
  }

  return {
    uri: row.local_uri ?? undefined,
    state: row.state,
    error: row.error ?? undefined,
    retry,
  };
}
```

- [ ] **Step 2: Manual verification**

Add to any screen temporarily:

```tsx
import { useAttachment } from "@/features/attachments/hooks/useAttachment";

// Inside a component, with a known student photo path:
const att = useAttachment("/media/REPLACE_WITH_REAL_ID/");
console.log("[attachments]", att);
```

Expected: state transitions from `queued`/`downloading` to `synced`, then `uri` is set to a `file://...` path. Remove the test code afterwards.

- [ ] **Step 3: Commit**

```bash
git add features/attachments/hooks/useAttachment.ts
git commit -m "feat(attachments): add useAttachment hook"
```

---

### Task 8: useFailedAttachments and useAttachmentStatus hooks

**Files:**
- Create: `features/attachments/hooks/useFailedAttachments.ts`
- Create: `features/attachments/hooks/useAttachmentStatus.ts`

- [ ] **Step 1: Implement useFailedAttachments**

Create `features/attachments/hooks/useFailedAttachments.ts`:

```ts
import { useQuery } from "@powersync/react-native";
import { ATTACHMENT_STATES } from "../attachments.schema";

export type FailedAttachment = {
  id: string;
  resource: string;
  source_table: string;
  source_col: string;
  error: string;
  retry_count: number;
  updated_at: string;
};

export function useFailedAttachments() {
  return useQuery<FailedAttachment>(
    `SELECT id, resource, source_table, source_col, error, retry_count, updated_at
     FROM attachments_local
     WHERE state = ?
     ORDER BY updated_at DESC`,
    [ATTACHMENT_STATES.FAILED],
  );
}
```

- [ ] **Step 2: Implement useAttachmentStatus**

Create `features/attachments/hooks/useAttachmentStatus.ts`:

```ts
import { useEffect, useState } from "react";
import { useQuery } from "@powersync/react-native";
import { attachmentQueue } from "../attachments.queue";

type CountRow = { state: string; n: number };

export type AttachmentStatus = {
  pending: number;
  downloading: number;
  synced: number;
  failed: number;
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

  const counts = { pending: 0, downloading: 0, synced: 0, failed: 0 };
  for (const row of data ?? []) {
    if (row.state === "queued") counts.pending = row.n;
    else if (row.state === "downloading") counts.downloading = row.n;
    else if (row.state === "synced") counts.synced = row.n;
    else if (row.state === "failed") counts.failed = row.n;
  }

  return { ...counts, lowStorage };
}
```

- [ ] **Step 3: Manual verification**

In a temporary screen, log both hook outputs. Expect counts to update reactively as the queue drains. Failed items (if any) should appear in `useFailedAttachments`. Remove the test code afterwards.

- [ ] **Step 4: Commit**

```bash
git add features/attachments/hooks/useFailedAttachments.ts features/attachments/hooks/useAttachmentStatus.ts
git commit -m "feat(attachments): add status and failed-list hooks"
```

---

### Task 9: AttachmentImage component

**Files:**
- Create: `features/attachments/components/AttachmentImage.tsx`

- [ ] **Step 1: Implement the component**

Create `features/attachments/components/AttachmentImage.tsx`:

```tsx
import { Image, type ImageProps } from "expo-image";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useAttachment } from "../hooks/useAttachment";

type Props = Omit<ImageProps, "source"> & {
  path: string | null | undefined;
  fallback?: React.ReactNode;
  showRetry?: boolean;
};

export const AttachmentImage = ({
  path,
  fallback,
  showRetry = true,
  style,
  ...rest
}: Props) => {
  const { uri, state, retry } = useAttachment(path);

  if (state === "synced" && uri) {
    return <Image source={{ uri }} style={style} {...rest} />;
  }

  if (state === "failed") {
    return (
      <Pressable
        onPress={showRetry ? retry : undefined}
        style={style}
        className="items-center justify-center bg-foreground/5"
      >
        <Icon name="WarningCircleIcon" size={20} />
        {showRetry ? (
          <AppText className="text-xs">Tap to retry</AppText>
        ) : null}
      </Pressable>
    );
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <View style={style} className="items-center justify-center bg-foreground/5">
      <Icon name="ImageIcon" size={20} />
    </View>
  );
};

export default AttachmentImage;
```

- [ ] **Step 2: Manual verification**

In any screen that already shows a profile photo, temporarily swap it:

```tsx
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";

// Replace existing <Image source={{ uri: profile.studentPhoto }} ... />:
<AttachmentImage path={profile.studentPhoto} style={{ width: 80, height: 80, borderRadius: 40 }} />
```

Expected: shows placeholder briefly, then the photo. Toggle airplane mode after first sync — image still shows (cached).

Revert the temporary swap after verifying.

- [ ] **Step 3: Commit**

```bash
git add features/attachments/components/AttachmentImage.tsx
git commit -m "feat(attachments): add AttachmentImage component"
```

---

### Task 10: Public retry/status API

**Files:**
- Create: `features/attachments/attachments.api.ts`

- [ ] **Step 1: Implement the API surface**

Create `features/attachments/attachments.api.ts`:

```ts
import { powersync } from "@/powersync/system";
import { attachmentQueue } from "./attachments.queue";
import { ATTACHMENT_STATES } from "./attachments.schema";

/**
 * Move all FAILED attachments back to QUEUED so the worker reattempts.
 */
export async function retryAllFailedAttachments(): Promise<void> {
  await powersync.execute(
    `UPDATE attachments_local
     SET state = ?, error = NULL, updated_at = ?
     WHERE state = ?`,
    [
      ATTACHMENT_STATES.QUEUED,
      new Date().toISOString(),
      ATTACHMENT_STATES.FAILED,
    ],
  );
  attachmentQueue.poke();
}

/**
 * Move a single FAILED attachment back to QUEUED.
 */
export async function retryAttachment(id: string): Promise<void> {
  await powersync.execute(
    `UPDATE attachments_local
     SET state = ?, error = NULL, updated_at = ?
     WHERE id = ?`,
    [ATTACHMENT_STATES.QUEUED, new Date().toISOString(), id],
  );
  attachmentQueue.poke();
}
```

- [ ] **Step 2: Manual verification**

In dev, call `retryAllFailedAttachments()` from a button. Confirm failed counts go to 0 and downloads kick off again.

- [ ] **Step 3: Commit**

```bash
git add features/attachments/attachments.api.ts
git commit -m "feat(attachments): add public retry API"
```

---

### Task 11: Integrate AttachmentImage in real screens

**Files:**
- Modify: any screens currently using raw `<Image source={{ uri: ... }}>` for these columns.

This task replaces direct image URL rendering for the attachment columns with `AttachmentImage`. The exact files depend on existing screens; expect candidates like profile screens, course list cards, classroom student lists, and material viewers.

- [ ] **Step 1: Find candidates**

Run from project root:

```bash
grep -rn "studentPhoto\|subjectPhoto\|module_module" --include="*.tsx" --include="*.ts" -l app screens features components
```

For each result, check if it renders an image from one of the tracked columns.

- [ ] **Step 2: Replace each consumer**

For every consumer found, replace the image render. Pattern:

Before:
```tsx
<Image source={{ uri: someBaseUrl + profile.studentPhoto }} style={...} />
```

After:
```tsx
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";

<AttachmentImage path={profile.studentPhoto} style={...} />
```

Do this one screen at a time — commit between screens so a regression is bisectable.

- [ ] **Step 3: Manual verification per screen**

For each modified screen:
1. Hot reload, navigate to it.
2. Confirm images load.
3. Toggle airplane mode, navigate away and back. Confirm cached images still load.

- [ ] **Step 4: Commit (per screen, or grouped per feature area)**

```bash
git add <files>
git commit -m "refactor(<area>): use AttachmentImage for cached image rendering"
```

---

### Task 12: Surface failed downloads in SyncSheet

**Files:**
- Modify: `features/sync/components/SyncSheet.tsx`

- [ ] **Step 1: Read the current SyncSheet**

```bash
cat features/sync/components/SyncSheet.tsx
```

The existing layout has `<Dialog.Title>` + `<SyncStatusCard />` + a row with `<ForceSyncButton />`. Add an attachments section between the status card and the force-sync row.

- [ ] **Step 2: Add attachments retry section**

Modify `features/sync/components/SyncSheet.tsx`. Replace the body of `SyncSheetContent` with:

```tsx
import { useFailedAttachments } from "@/features/attachments/hooks/useFailedAttachments";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { retryAllFailedAttachments } from "@/features/attachments/attachments.api";
import { Button } from "heroui-native";
import { AppText } from "@/components/AppText";

const SyncSheetContent = () => {
  const failed = useFailedAttachments();
  const status = useAttachmentStatus();

  return (
    <>
      <Dialog.Title>Sync Center</Dialog.Title>
      <SyncStatusCard />

      {status.lowStorage ? (
        <View className="mt-3 p-3 rounded-lg bg-warning/10">
          <AppText className="text-warning">
            Low device storage. New downloads are paused until you free up space.
          </AppText>
        </View>
      ) : null}

      {failed.data && failed.data.length > 0 ? (
        <View className="mt-3 gap-2">
          <AppText weight="semibold">
            {failed.data.length} attachment{failed.data.length === 1 ? "" : "s"} failed to download
          </AppText>
          <Button onPress={retryAllFailedAttachments}>
            <Button.Label>Retry all</Button.Label>
          </Button>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          marginTop: 12,
        }}
      >
        <ForceSyncButton />
      </View>
    </>
  );
};
```

- [ ] **Step 3: Manual verification**

1. Force a failure: temporarily edit `attachments.fetcher.ts` to throw on a specific resource (e.g. `if (resource === 'profile') throw new AttachmentFetchError('test', 0, false)`), reload, log in, observe FAILED rows accumulating.
2. Open SyncSheet. Expect to see the failed-count message and retry button.
3. Tap "Retry all". Failed rows go back to QUEUED.
4. Revert the test failure in fetcher. Tap retry again. Failed clears as downloads succeed.

- [ ] **Step 4: Commit**

```bash
git add features/sync/components/SyncSheet.tsx
git commit -m "feat(attachments): surface failed downloads and retry in SyncSheet"
```

---

## Definition of Done

- [ ] Fresh install + login on a teacher and student account: every screen with photos/materials shows them within 60 seconds of the SyncGate lifting.
- [ ] Toggle airplane mode after first sync: every previously-shown image still renders from cache.
- [ ] Force a 404 on a known id (point to a non-existent id in DB) and confirm: that one row goes FAILED, others continue, retry button works.
- [ ] Fill simulator disk to under 100 MB free: queue pauses; SyncSheet shows low-storage banner.
- [ ] No regressions in existing screens (notifications, calendar, classroom, teaching).
