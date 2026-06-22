import api from "@/lib/axios";
import useStore from "@/lib/store";
import { deleteByClientEventIds, readBatch, size } from "./queue";
import type { IngestResponse } from "./types";

const ENDPOINT = "/audit_events/";
const FLUSH_BATCH_SIZE = 100;

const BACKOFF_MS = [5_000, 30_000, 120_000, 300_000];
let consecutiveFailures = 0;
let nextEligibleAt = 0;
let flushInFlight: Promise<void> | null = null;

export async function flush(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    try {
      await doFlush();
    } finally {
      flushInFlight = null;
    }
  })();
  return flushInFlight;
}

async function doFlush(): Promise<void> {
  if (Date.now() < nextEligibleAt) return;
  if (size() === 0) return;

  const { isConnected, isInternetReachable, accessToken } = useStore.getState();
  if (!isConnected || !isInternetReachable || !accessToken) return;

  const events = readBatch(FLUSH_BATCH_SIZE);
  if (events.length === 0) return;

  try {
    const { data } = await api.post<IngestResponse>(ENDPOINT, { events });
    const accepted = data?.accepted ?? [];
    const duplicates = data?.duplicates ?? [];
    deleteByClientEventIds([...accepted, ...duplicates]);
    consecutiveFailures = 0;
    nextEligibleAt = 0;
  } catch (error) {
    consecutiveFailures += 1;
    const delay =
      BACKOFF_MS[Math.min(consecutiveFailures - 1, BACKOFF_MS.length - 1)];
    nextEligibleAt = Date.now() + delay;
    if (__DEV__) {
      console.warn(
        "[activity-tracker] flush failed; retry in",
        delay,
        "ms",
        error,
      );
    }
  }
}

export function _resetForTest(): void {
  consecutiveFailures = 0;
  nextEligibleAt = 0;
  flushInFlight = null;
}
