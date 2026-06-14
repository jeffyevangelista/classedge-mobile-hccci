import { powersync } from "@/powersync/system";

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
