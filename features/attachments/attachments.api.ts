import * as FileSystem from "expo-file-system/legacy";
import { powersync } from "@/powersync/system";
import { attachmentQueue } from "./attachments.queue";
import { ATTACHMENT_STATES } from "./attachments.schema";

const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;

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
