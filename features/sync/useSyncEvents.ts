import { useQuery } from "@powersync/react-native";
import type { SyncEventRow } from "./syncEvents";

/**
 * Live-streaming query over the last 200 sync events, newest first.
 */
export function useSyncEvents() {
  return useQuery<SyncEventRow>(
    `SELECT id, ts, kind, target, status, http_status, message, duration_ms, retry_count
     FROM sync_events_local
     ORDER BY ts DESC`,
  );
}
