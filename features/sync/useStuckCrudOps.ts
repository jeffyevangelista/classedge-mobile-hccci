import { useQuery } from "@powersync/react-native";
import { STUCK_AGE_HOURS, STUCK_ATTEMPT_CAP } from "./crudMeta";

export type StuckCrudOp = {
  op_id: string;
  attempt_count: number;
  first_failed_at: string | null;
  last_attempt_at: string;
  last_error: string | null;
  last_http_status: number | null;
  /** From the PowerSync-internal `ps_crud` table (op payload as JSON string). */
  data: string;
  tx_id: number | null;
};

/**
 * Live-streaming query of CRUD ops considered "stuck": either too many
 * attempts or stuck for too long. Joined with PowerSync's internal `ps_crud`
 * to surface the op payload.
 */
export function useStuckCrudOps() {
  return useQuery<StuckCrudOp>(
    `SELECT m.op_id,
            m.attempt_count,
            m.first_failed_at,
            m.last_attempt_at,
            m.last_error,
            m.last_http_status,
            c.data,
            c.tx_id
     FROM ps_crud_meta_local m
     JOIN ps_crud c ON c.id = m.op_id
     WHERE m.dropped_at IS NULL
       AND (m.attempt_count >= ?
            OR datetime(m.first_failed_at) < datetime('now', ?))
     ORDER BY m.first_failed_at ASC`,
    [STUCK_ATTEMPT_CAP, `-${STUCK_AGE_HOURS} hours`],
  );
}
