import { createId } from "@paralleldrive/cuid2";
import { powersync } from "@/powersync/system";

export const SYNC_EVENT_CAP = 200;

export type SyncEventKind =
  | "upload"
  | "download"
  | "auth"
  | "connect"
  | "stream";

export type SyncEventStatus = "started" | "ok" | "fail";

export type SyncEventInput = {
  kind: SyncEventKind;
  target?: string | null;
  status: SyncEventStatus;
  httpStatus?: number | null;
  message?: string | null;
  durationMs?: number | null;
  retryCount?: number | null;
};

export type SyncEventRow = {
  id: string;
  ts: string;
  kind: SyncEventKind;
  target: string | null;
  status: SyncEventStatus;
  http_status: number | null;
  message: string | null;
  duration_ms: number | null;
  retry_count: number | null;
};

/**
 * Append one row to `sync_events_local` and trim to `SYNC_EVENT_CAP` newest
 * rows in a single write transaction. Telemetry failures are swallowed so
 * the calling sync path is never broken by a logging error.
 */
export async function appendSyncEvent(input: SyncEventInput): Promise<void> {
  const id = createId();
  const ts = new Date().toISOString();
  try {
    await powersync.writeTransaction(async (tx) => {
      await tx.execute(
        `INSERT INTO sync_events_local
          (id, ts, kind, target, status, http_status, message, duration_ms, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ts,
          input.kind,
          input.target ?? null,
          input.status,
          input.httpStatus ?? null,
          input.message ?? null,
          input.durationMs ?? null,
          input.retryCount ?? null,
        ],
      );
      await tx.execute(
        `DELETE FROM sync_events_local WHERE id IN (
           SELECT id FROM sync_events_local ORDER BY ts ASC
           LIMIT MAX(0, (SELECT COUNT(*) FROM sync_events_local) - ?)
         )`,
        [SYNC_EVENT_CAP],
      );
    });
  } catch (err) {
    console.warn("[syncEvents] appendSyncEvent failed", err);
  }
}
