// features/sync/useSectionStatus.ts

import { useStatus } from "@powersync/react-native";
import { useEffect } from "react";
import useStore from "@/lib/store";
import { markPostLoginReady } from "@/lib/telemetry";

export type SectionPhase = "loading" | "ready" | "empty" | "offline-empty";

export type SectionStatus<T> = {
  phase: SectionPhase;
  data: T;
  hasSynced: boolean;
  isOnline: boolean;
};

export type UseSectionStatusOpts<T> = {
  data: T;
  isEmpty: (data: T) => boolean;
  isLoading?: boolean;
};

/**
 * Classify a section's render state. Pass in the data + an emptiness predicate
 * and optionally an `isLoading` flag from a React Query hook. Resolves to one
 * of {loading, ready, empty, offline-empty}. Non-empty data always wins.
 *
 * Resolution order (first match):
 *   1. !isEmpty(data) → ready  (non-empty data always wins)
 *   2. isLoading      → loading
 *   3. !hasSynced & online  → loading
 *   4. !hasSynced & offline → offline-empty
 *   5. hasSynced            → empty
 */
export function useSectionStatus<T>(
  opts: UseSectionStatusOpts<T>,
): SectionStatus<T> {
  const status = useStatus();
  const isConnected = useStore((s) => s.isConnected);
  const isInternetReachable = useStore((s) => s.isInternetReachable);

  const isOnline = Boolean(isConnected && isInternetReachable);
  const hasSynced = status.hasSynced === true;
  const empty = opts.isEmpty(opts.data);

  let phase: SectionPhase;
  if (!empty) phase = "ready";
  else if (opts.isLoading) phase = "loading";
  else if (!hasSynced && isOnline) phase = "loading";
  else if (!hasSynced && !isOnline) phase = "offline-empty";
  else phase = "empty";

  useEffect(() => {
    if (phase !== "loading") markPostLoginReady();
  }, [phase]);

  return { phase, data: opts.data, hasSynced, isOnline };
}

export default useSectionStatus;
