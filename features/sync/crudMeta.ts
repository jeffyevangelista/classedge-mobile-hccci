import { powersync } from "@/powersync/db";

export const STUCK_ATTEMPT_CAP = 5;
export const STUCK_AGE_HOURS = 24;

export type CrudAttemptResult = {
  error: string;
  httpStatus: number | null;
};

/**
 * Record one CRUD upload attempt against `ps_crud_meta_local`. INSERTs on
 * first failure (sets `first_failed_at`), bumps `attempt_count` on
 * subsequent failures. Idempotent — safe to call from any failure path.
 */
export async function recordCrudAttempt(
  opId: string,
  result: CrudAttemptResult,
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await powersync.execute(
      `INSERT INTO ps_crud_meta_local
         (op_id, attempt_count, first_failed_at, last_attempt_at, last_error, last_http_status)
       VALUES (?, 1, ?, ?, ?, ?)
       ON CONFLICT(op_id) DO UPDATE SET
         attempt_count    = attempt_count + 1,
         last_attempt_at  = excluded.last_attempt_at,
         last_error       = excluded.last_error,
         last_http_status = excluded.last_http_status`,
      [opId, now, now, result.error, result.httpStatus],
    );
  } catch (err) {
    console.warn("[crudMeta] recordCrudAttempt failed", err);
  }
}

/**
 * Drop meta rows for ops that just completed successfully. Called from the
 * Connector's transaction-complete path with the full set of ops in the
 * transaction.
 */
export async function clearCrudMeta(opIds: string[]): Promise<void> {
  if (opIds.length === 0) return;
  const placeholders = opIds.map(() => "?").join(",");
  try {
    await powersync.execute(
      `DELETE FROM ps_crud_meta_local WHERE op_id IN (${placeholders})`,
      opIds,
    );
  } catch (err) {
    console.warn("[crudMeta] clearCrudMeta failed", err);
  }
}

/**
 * Manual retry from the Stuck section: zero `attempt_count` and clear the
 * failure-history fields. PowerSync's next upload cycle re-attempts the op.
 */
export async function resetCrudMeta(opId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await powersync.execute(
      `UPDATE ps_crud_meta_local
       SET attempt_count    = 0,
           first_failed_at  = NULL,
           last_error       = NULL,
           last_http_status = NULL,
           last_attempt_at  = ?
       WHERE op_id = ?`,
      [now, opId],
    );
  } catch (err) {
    console.warn("[crudMeta] resetCrudMeta failed", err);
  }
}

/**
 * Snapshot of one ps_crud_meta_local row. Used by the Connector to read
 * attempt_count before deciding whether to drop a stuck op.
 */
export type CrudMetaRow = {
  attempt_count: number;
  dropped_at: string | null;
};

export async function readCrudMeta(opId: string): Promise<CrudMetaRow | null> {
  try {
    const rows = await powersync.getAll<CrudMetaRow>(
      `SELECT attempt_count, dropped_at FROM ps_crud_meta_local WHERE op_id = ?`,
      [opId],
    );
    return rows[0] ?? null;
  } catch (err) {
    console.warn("[crudMeta] readCrudMeta failed", err);
    return null;
  }
}

/**
 * Mark a CRUD op as permanently dropped from PowerSync's queue. INSERTs a
 * fresh meta row if one doesn't exist (defensive — the Connector usually
 * called recordCrudAttempt first, but markCrudOpDropped must be safe to call
 * standalone). UPDATEs an existing row's last_error / last_http_status /
 * target / dropped_at fields. attempt_count is left untouched on conflict so
 * the historical retry count survives for the Failed section to show.
 */
export async function markCrudOpDropped(
  opId: string,
  detail: { target: string | null; error: string; httpStatus: number | null },
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await powersync.execute(
      `INSERT INTO ps_crud_meta_local
         (op_id, attempt_count, first_failed_at, last_attempt_at, last_error, last_http_status, target, dropped_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(op_id) DO UPDATE SET
         last_error       = excluded.last_error,
         last_http_status = excluded.last_http_status,
         target           = excluded.target,
         dropped_at       = excluded.dropped_at`,
      [opId, now, now, detail.error, detail.httpStatus, detail.target, now],
    );
  } catch (err) {
    console.warn("[crudMeta] markCrudOpDropped failed", err);
  }
}

/**
 * User-tapped Dismiss on a Failed entry. Plain DELETE — no interaction with
 * PowerSync's queue (the op left the queue when transaction.complete() ran).
 */
export async function dismissFailedOp(opId: string): Promise<void> {
  try {
    await powersync.execute(`DELETE FROM ps_crud_meta_local WHERE op_id = ?`, [
      opId,
    ]);
  } catch (err) {
    console.warn("[crudMeta] dismissFailedOp failed", err);
  }
}
