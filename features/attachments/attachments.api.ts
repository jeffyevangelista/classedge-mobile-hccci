import * as FileSystem from "expo-file-system/legacy";
import { powersync } from "@/powersync/system";
import { ATTACHMENT_COLUMNS, AUTO_RETRY_CAP } from "./attachments.config";
import { attachmentQueue } from "./attachments.queue";
import { ATTACHMENT_STATES } from "./attachments.schema";

const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

export type PushAttachmentRef = {
  /** Bare attachment id — no leading path segments, no extension. */
  id: string;
  /** Must match an ATTACHMENT_COLUMNS[].resource value. */
  resource: string;
};

/**
 * Synchronously inserts QUEUED rows for attachments referenced in a
 * push payload so the queue starts downloading before PowerSync
 * replicates the source row. Idempotent (INSERT OR IGNORE) — when the
 * source row eventually replicates, the watcher's scan no-ops on the
 * same id.
 *
 * The default priority is 0, intentionally lower than the watcher's
 * priority-1 baseline so push-driven attachments preempt the background
 * backlog. The screen the push is opening sees its files first.
 */
export async function enqueuePushAttachments(
  refs: PushAttachmentRef[] | undefined | null,
  priority = 0,
): Promise<void> {
  if (!refs || refs.length === 0) return;

  const byResource = new Map(ATTACHMENT_COLUMNS.map((c) => [c.resource, c]));
  const now = new Date().toISOString();

  // [push-attach verify] — remove this block after end-to-end verification.
  // Logs the inbound refs so we can confirm the server is delivering the
  // payload shape we expect and that the client receives it on push tap.
  if (__DEV__) {
    console.log(
      `[attachments] push enqueue: received ${refs.length} ref(s)`,
      refs,
    );
  }

  const enqueued: string[] = [];

  for (const ref of refs) {
    if (!ref?.id || !ref?.resource) continue;
    const cfg = byResource.get(ref.resource);
    if (!cfg) {
      // Unknown resource — refuse rather than create rows the watcher
      // can't reconcile against any source column.
      console.warn(
        `[attachments] push enqueue: unknown resource "${ref.resource}"`,
      );
      continue;
    }

    await powersync.execute(
      `INSERT OR IGNORE INTO attachments_local
        (id, resource, source_table, source_col, priority, state, retry_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        ref.id,
        cfg.resource,
        cfg.table,
        cfg.column,
        priority,
        ATTACHMENT_STATES.QUEUED,
        now,
      ],
    );

    // For rows that already existed: bump priority if higher (lower
    // number wins under `pickNext`'s ORDER BY priority ASC), and flip
    // FAILED-with-budget back to QUEUED so the push triggers a retry.
    // Never touches SYNCED rows.
    await powersync.execute(
      `UPDATE attachments_local
       SET priority = MIN(priority, ?),
           state = CASE
             WHEN state = ? THEN ?
             WHEN state = ? AND retry_count < ? THEN ?
             ELSE state
           END,
           error = CASE WHEN state = ? THEN NULL ELSE error END,
           updated_at = ?
       WHERE id = ? AND state <> ?`,
      [
        priority,
        ATTACHMENT_STATES.QUEUED,
        ATTACHMENT_STATES.QUEUED,
        ATTACHMENT_STATES.FAILED,
        AUTO_RETRY_CAP,
        ATTACHMENT_STATES.QUEUED,
        ATTACHMENT_STATES.FAILED,
        now,
        ref.id,
        ATTACHMENT_STATES.SYNCED,
      ],
    );

    enqueued.push(`${ref.resource}:${ref.id}`);
  }

  // [push-attach verify] — remove this block after end-to-end verification.
  if (__DEV__) {
    console.log(
      `[attachments] push enqueue: wrote ${enqueued.length}/${refs.length} row(s) at priority ${priority}`,
      enqueued,
    );
  }

  attachmentQueue.poke();
}

/**
 * Bumps priority for a known set of attachment ids and nudges the queue.
 * Use from non-push entry points (e.g. a detail screen mount) so the
 * visible attachments preempt the background backlog. No-op for SYNCED.
 */
export async function bumpAttachmentPriority(
  ids: string[],
  priority = 0,
): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  await powersync.execute(
    `UPDATE attachments_local
     SET priority = MIN(priority, ?), updated_at = ?
     WHERE id IN (${placeholders}) AND state <> ?`,
    [priority, new Date().toISOString(), ...ids, ATTACHMENT_STATES.SYNCED],
  );
  attachmentQueue.poke();
}

/**
 * Move all FAILED attachments back to QUEUED so the worker reattempts.
 * Resets retry_count to bypass the watcher's auto-retry cap.
 */
export async function retryAllFailedAttachments(): Promise<void> {
  await powersync.execute(
    `UPDATE attachments_local
     SET state = ?, error = NULL, retry_count = 0, updated_at = ?
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
 * Resets retry_count to bypass the watcher's auto-retry cap.
 */
export async function retryAttachment(id: string): Promise<void> {
  await powersync.execute(
    `UPDATE attachments_local
     SET state = ?, error = NULL, retry_count = 0, updated_at = ?
     WHERE id = ?`,
    [ATTACHMENT_STATES.QUEUED, new Date().toISOString(), id],
  );
  attachmentQueue.poke();
}

/**
 * Clears the attachments_local tracking table and removes all downloaded
 * files from disk. Use on logout and on Force Resync so the next user
 * doesn't inherit the previous account's blobs or stale tracking rows.
 */
export async function clearAllAttachments(): Promise<void> {
  try {
    await powersync.execute("DELETE FROM attachments_local");
  } catch (err) {
    console.warn("[attachments] failed to clear attachments_local", err);
  }
  try {
    const info = await FileSystem.getInfoAsync(ATTACHMENTS_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(ATTACHMENTS_DIR, { idempotent: true });
    }
  } catch (err) {
    console.warn("[attachments] failed to delete attachments dir", err);
  }
}
