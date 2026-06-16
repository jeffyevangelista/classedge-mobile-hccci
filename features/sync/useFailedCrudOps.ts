import { useQuery } from "@powersync/react-native";

export type FailedCrudOp = {
  op_id: string;
  target: string | null;
  last_error: string | null;
  last_http_status: number | null;
  attempt_count: number;
  dropped_at: string;
};

/**
 * Live-streaming query of CRUD ops that have been permanently dropped from
 * PowerSync's queue. Sorted newest-first so the most recent failure is at
 * the top of the Failed section.
 */
export function useFailedCrudOps() {
  return useQuery<FailedCrudOp>(
    `SELECT op_id,
            target,
            last_error,
            last_http_status,
            attempt_count,
            dropped_at
     FROM ps_crud_meta_local
     WHERE dropped_at IS NOT NULL
     ORDER BY dropped_at DESC`,
  );
}
