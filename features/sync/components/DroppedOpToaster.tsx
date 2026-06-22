import { useQuery } from "@powersync/react-native";
import { useToast } from "heroui-native";
import { useEffect, useRef } from "react";
import { featureLabelFromTarget } from "../syncLabels";

type DroppedEvent = {
  target: string | null;
  message: string | null;
  http_status: number | null;
  ts: string;
};

/**
 * Top-level null-rendering component. Watches sync_events_local for new rows
 * with `status = 'dropped'` since mount, and fires a heroui-native danger
 * toast for each one. The cold-start filter (`ts > mountTime`) intentionally
 * suppresses replays of old events when the app launches — the user's
 * durable record is the Sync Center Failed section.
 *
 * Why a ref for `toast`: heroui-native's `toast.show()` / `toast.hide()`
 * close over the `toasts` state from the render where the callback was
 * created. If we captured `toast` in the closure of the `useEffect`, the
 * effect (which runs after data updates) would be holding a stale `toast`
 * by the time we want to call show(). The ref always points at the latest
 * toast object so show() reaches a fresh closure. Same pattern as
 * useProfilePhotoActionSheet.
 */
export function DroppedOpToaster() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const lastSeenRef = useRef<string>(new Date().toISOString());

  const { data } = useQuery<DroppedEvent>(
    `SELECT target, message, http_status, ts
     FROM sync_events_local
     WHERE status = 'dropped' AND ts > ?
     ORDER BY ts ASC`,
    [lastSeenRef.current],
  );

  useEffect(() => {
    if (!data?.length) return;
    for (const row of data) {
      const description =
        row.http_status != null
          ? `${row.message ?? "Upload failed"} (HTTP ${row.http_status})`
          : (row.message ?? "Upload failed");
      toastRef.current.show({
        label: featureLabelFromTarget(row.target),
        description,
        variant: "danger",
      });
    }
    lastSeenRef.current = data[data.length - 1].ts;
  }, [data]);

  return null;
}

export default DroppedOpToaster;
