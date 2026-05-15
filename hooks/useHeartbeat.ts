import { useEffect } from "react";
import { updateHeartbeat } from "@/features/assessment/assessment.service";

const DEFAULT_INTERVAL_MS = 10_000;

export const useHeartbeat = (
  attemptLocalId: string | undefined,
  intervalMs = DEFAULT_INTERVAL_MS,
) => {
  useEffect(() => {
    if (!attemptLocalId) return;
    const ping = () =>
      updateHeartbeat(attemptLocalId).catch((err) =>
        console.error("[useHeartbeat] failed:", err),
      );
    ping();
    const interval = setInterval(ping, intervalMs);
    return () => clearInterval(interval);
  }, [attemptLocalId, intervalMs]);
};
