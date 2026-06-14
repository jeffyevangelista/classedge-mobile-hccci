import * as FileSystem from "expo-file-system/legacy";
import { silentRefresh } from "@/features/auth/useTokenRefresh";
import useStore from "@/lib/store";
import { powersync } from "@/powersync/system";
import {
  AUTO_RETRY_CAP,
  LOW_STORAGE_THRESHOLD_BYTES,
  MAX_CONCURRENT_DOWNLOADS,
} from "./attachments.config";
import { AttachmentFetchError, fetchAttachment } from "./attachments.fetcher";
import {
  clearAttachmentProgress,
  setAttachmentProgress,
} from "./attachments.progress";
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
  private retried = new Set<string>();
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
    const inFlightIds = Array.from(this.inFlight);
    const placeholders =
      inFlightIds.length > 0 ? inFlightIds.map(() => "?").join(",") : "''";
    const exclusion =
      inFlightIds.length > 0 ? `AND id NOT IN (${placeholders})` : "";
    const rows = await powersync.getAll<Row>(
      `SELECT id, resource, priority, retry_count
       FROM attachments_local
       WHERE state = ? ${exclusion}
       ORDER BY priority ASC, updated_at ASC
       LIMIT 1`,
      [ATTACHMENT_STATES.QUEUED, ...inFlightIds],
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
       WHERE id = ? AND state = ?`,
      [
        ATTACHMENT_STATES.SYNCED,
        localUri,
        sizeBytes,
        new Date().toISOString(),
        id,
        ATTACHMENT_STATES.DOWNLOADING,
      ],
    );
  }

  private async markFailed(id: string, error: string): Promise<void> {
    await powersync.execute(
      `UPDATE attachments_local
       SET state = ?, error = ?, retry_count = retry_count + 1, updated_at = ?
       WHERE id = ? AND state = ?`,
      [
        ATTACHMENT_STATES.FAILED,
        error,
        new Date().toISOString(),
        id,
        ATTACHMENT_STATES.DOWNLOADING,
      ],
    );
  }

  /**
   * Park a row at the retry cap so the watcher's auto-heal can't flip it back
   * to QUEUED. Used for non-retriable failures (404, no file URL) where
   * banging on the server further is pointless. Manual retry still works —
   * it resets retry_count to 0.
   */
  private async markPermanentlyFailed(
    id: string,
    error: string,
  ): Promise<void> {
    await powersync.execute(
      `UPDATE attachments_local
       SET state = ?, error = ?, retry_count = ?, updated_at = ?
       WHERE id = ? AND state = ?`,
      [
        ATTACHMENT_STATES.FAILED,
        error,
        AUTO_RETRY_CAP,
        new Date().toISOString(),
        id,
        ATTACHMENT_STATES.DOWNLOADING,
      ],
    );
  }

  private async processOne(row: Row): Promise<void> {
    // Synchronous reservation to prevent concurrent picks of the same row.
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
        (downloaded, total) => setAttachmentProgress(row.id, downloaded, total),
      );
      await this.markSynced(row.id, localUri, sizeBytes);
      clearAttachmentProgress(row.id);
      this.retried.delete(row.id);
    } catch (e) {
      if (
        e instanceof AttachmentFetchError &&
        e.status === 401 &&
        e.retriable &&
        !this.retried.has(row.id)
      ) {
        this.retried.add(row.id);
        // Force a token rotation before retrying. `silentRefresh` is dedup'd
        // via `inflightRefresh`, so concurrent callers join the same promise.
        // On failure (offline / dead refresh token / forced logout) the store
        // either holds the old empty token or signOut has cleared it; either
        // way the `refreshedToken` guard below routes the row to markFailed.
        await silentRefresh({ force: true });
        const refreshedToken = useStore.getState().accessToken;
        if (refreshedToken && refreshedToken !== "") {
          try {
            const { localUri, sizeBytes } = await fetchAttachment(
              row.resource,
              row.id,
              refreshedToken,
              (downloaded, total) =>
                setAttachmentProgress(row.id, downloaded, total),
            );
            await this.markSynced(row.id, localUri, sizeBytes);
            clearAttachmentProgress(row.id);
            this.retried.delete(row.id);
            return;
          } catch (retryErr) {
            const retryMsg =
              retryErr instanceof Error ? retryErr.message : String(retryErr);
            console.warn(
              `[attachments] failed (after 401 retry) ${row.resource}/${row.id}: ${retryMsg}`,
            );
            if (
              retryErr instanceof AttachmentFetchError &&
              !retryErr.retriable
            ) {
              await this.markPermanentlyFailed(row.id, retryMsg);
            } else {
              await this.markFailed(row.id, retryMsg);
            }
            clearAttachmentProgress(row.id);
            this.retried.delete(row.id);
            return;
          }
        }
      }
      const msg =
        e instanceof AttachmentFetchError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      console.warn(`[attachments] failed ${row.resource}/${row.id}: ${msg}`);
      if (e instanceof AttachmentFetchError && !e.retriable) {
        await this.markPermanentlyFailed(row.id, msg);
      } else {
        await this.markFailed(row.id, msg);
      }
      clearAttachmentProgress(row.id);
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
