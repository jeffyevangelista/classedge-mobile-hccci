import { powersync } from "@/powersync/system";
import {
  ATTACHMENT_COLUMNS,
  AUTO_RETRY_CAP,
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
