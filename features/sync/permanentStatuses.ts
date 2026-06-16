/**
 * HTTP status codes that the Connector treats as permanently failed —
 * retrying the exact same payload cannot change the outcome. On first
 * occurrence, the op is dropped from PowerSync's CRUD queue, marked in
 * ps_crud_meta_local, and surfaced via a Sync Center Failed entry plus a
 * danger toast.
 *
 * 401 is intentionally absent — it's handled by Connector's
 * fetchOpWithAuthRetry silent-refresh path before reaching the classify
 * code.
 *
 * 409 is intentionally absent (treated as transient) — IdempotentLocalIdUpsertMixin
 * returns 409 on legitimate cross-user local_id collisions (which are
 * permanent), but 409 also fires on transient races. Safer to retry then
 * fall into the existing STUCK_ATTEMPT_CAP path.
 */
export const PERMANENT_STATUSES: ReadonlySet<number> = new Set([
  400, 403, 404, 410, 413, 415, 422,
]);

export function isPermanentStatus(status: number | null): boolean {
  return status != null && PERMANENT_STATUSES.has(status);
}
