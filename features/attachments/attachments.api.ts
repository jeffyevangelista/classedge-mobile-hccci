import { powersync } from "@/powersync/system";
import { attachmentQueue } from "./attachments.queue";
import { ATTACHMENT_STATES } from "./attachments.schema";

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
