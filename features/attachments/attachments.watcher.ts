import * as FileSystem from "expo-file-system/legacy";
import { powersync } from "@/powersync/system";
import {
  ATTACHMENT_COLUMNS,
  type AttachmentColumnConfig,
  AUTO_RETRY_CAP,
  extractAttachmentId,
  TRACKED_TABLES,
} from "./attachments.config";
import { attachmentQueue } from "./attachments.queue";
import { ATTACHMENT_STATES } from "./attachments.schema";

type Row = Record<string, unknown> & { [key: string]: unknown };

async function scanColumn(
  cfg: AttachmentColumnConfig,
  referenced: Set<string>,
): Promise<void> {
  const rows = await powersync.getAll<Row>(
    `SELECT ${cfg.column} AS val FROM ${cfg.table} WHERE ${cfg.column} IS NOT NULL AND ${cfg.column} <> ''`,
  );
  if (rows.length === 0) return;

  const now = new Date().toISOString();
  for (const r of rows) {
    const id = extractAttachmentId(r.val as string | null | undefined);
    if (!id) continue;
    referenced.add(id);
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
  }
}

/**
 * Drops attachments_local rows whose ids are no longer referenced by any
 * source column, and deletes their on-disk files. Skips DOWNLOADING rows so
 * an in-flight fetch isn't yanked out from under the queue. Bails when
 * `referenced` is empty — that almost always means initial sync hasn't loaded
 * the source tables yet, and we'd nuke the whole table otherwise.
 */
async function reconcileOrphans(referenced: Set<string>): Promise<void> {
  if (referenced.size === 0) return;

  const refArr = Array.from(referenced);
  const placeholders = refArr.map(() => "?").join(",");
  const where = `id NOT IN (${placeholders}) AND state <> ?`;
  const params = [...refArr, ATTACHMENT_STATES.DOWNLOADING];

  const orphans = await powersync.getAll<{ local_uri: string | null }>(
    `SELECT local_uri FROM attachments_local
     WHERE ${where} AND local_uri IS NOT NULL`,
    params,
  );

  for (const o of orphans) {
    if (!o.local_uri) continue;
    try {
      await FileSystem.deleteAsync(o.local_uri, { idempotent: true });
    } catch (e) {
      console.warn(
        `[attachments] failed to delete orphan file ${o.local_uri}`,
        e,
      );
    }
  }

  await powersync.execute(
    `DELETE FROM attachments_local WHERE ${where}`,
    params,
  );
}

export async function scanAllColumns(): Promise<void> {
  const referenced = new Set<string>();
  for (const cfg of ATTACHMENT_COLUMNS) {
    try {
      await scanColumn(cfg, referenced);
    } catch (e) {
      console.warn(
        `[attachments] scan failed for ${cfg.table}.${cfg.column}`,
        e,
      );
    }
  }
  try {
    await reconcileOrphans(referenced);
  } catch (e) {
    console.warn("[attachments] reconcile failed", e);
  }
  attachmentQueue.poke();
}

const SCAN_DEBOUNCE_MS = 250;

export function startAttachmentWatcher(): () => void {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let scanning = false;
  let pendingWhileScanning = false;

  const triggerScan = async () => {
    if (scanning) {
      pendingWhileScanning = true;
      return;
    }
    scanning = true;
    try {
      await scanAllColumns();
    } finally {
      scanning = false;
      if (pendingWhileScanning) {
        pendingWhileScanning = false;
        void triggerScan();
      }
    }
  };

  const debouncedScan = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void triggerScan();
    }, SCAN_DEBOUNCE_MS);
  };

  // Initial scan covers returning users / data already in DB.
  void triggerScan();

  // Subscribe to changes; coalesce bursts via debounce.
  const dispose = powersync.onChangeWithCallback(
    {
      onChange: () => {
        debouncedScan();
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

  return () => {
    if (timer) clearTimeout(timer);
    abort.abort();
    if (typeof dispose === "function") dispose();
  };
}
