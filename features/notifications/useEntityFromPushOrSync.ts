import { useEffect, useRef, useState } from "react";
import { clearPushPayload, peekPushPayload } from "./pushPayloadCache";

export type EntitySource = "payload" | "local" | "api" | "none";

export type EntityResolution<T> = {
  /** Best-available data right now. Null only when every source has settled empty. */
  data: T | null;
  /** Which source produced `data`. "none" only when data is null. */
  source: EntitySource;
  /** True while at least one source might still produce data and we don't have any yet. */
  isResolving: boolean;
  /** True iff every source has settled and none returned data. Render the "not found" UI only when this is true. */
  isMissing: boolean;
  /** Error from the apiFetch fallback (if any). Local watch errors are not surfaced here. */
  error: unknown | null;
  /** Retry the apiFetch fallback. No-op if no apiFetch was provided. */
  retry: () => void;
};

export type UseEntityFromPushOrSyncParams<T> = {
  /** `${entityType}:${entityId}` — matches the key written by the OneSignal click handler. */
  entityKey: string;
  /** The row from a PowerSync watch hook. For array-returning hooks, pass `data?.[0] ?? null`. */
  localData: T | null | undefined;
  /** The watch's loading flag — relevant only for the very first paint. */
  localIsLoading: boolean;
  /** Optional REST fallback for the cold-start race. Wrap in `useCallback` at the call site if its identity could change. */
  apiFetch?: () => Promise<T | null>;
  /** How long to wait for watch / payload before firing apiFetch. */
  graceMs?: number;
};

/**
 * Resolves a detail-screen entity from three independent sources:
 *
 *   1. Push payload  — read once on mount from pushPayloadCache. Renders
 *                       first paint instantly if a push delivered the
 *                       entity blob alongside the notification.
 *   2. PowerSync watch — the canonical, reactive source of truth. Wins
 *                         the moment it produces a non-null row.
 *   3. REST apiFetch  — optional. Fires after `graceMs` if neither (1)
 *                         nor (2) produced data yet. Acts as a safety net
 *                         on cold start when PowerSync replication is slow.
 *
 * Priority on every render is `localData ?? apiData ?? payload ?? null`,
 * so canonical always overrides hydration, and the screen never flashes
 * "not found" during the replication gap.
 */
export const useEntityFromPushOrSync = <T>({
  entityKey,
  localData,
  localIsLoading,
  apiFetch,
  graceMs = 2500,
}: UseEntityFromPushOrSyncParams<T>): EntityResolution<T> => {
  // Read the payload from cache when the entity key changes (which
  // includes the first render). peekPushPayload does not delete the
  // entry, so a remount during the same session (e.g. nav back-and-
  // forward) still hydrates. We track the last-seen key so the hook
  // is robust if a parent reuses this instance for a different entity.
  const payloadRef = useRef<T | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  if (lastKeyRef.current !== entityKey) {
    lastKeyRef.current = entityKey;
    payloadRef.current = peekPushPayload<T>(entityKey);
  }
  const payload = payloadRef.current;

  const [apiData, setApiData] = useState<T | null>(null);
  const [apiSettled, setApiSettled] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Clear REST fallback state whenever entityKey changes so a key
  // flip mid-mount doesn't render stale apiData from a prior entity.
  // No-op on first mount (initial values already match).
  // biome-ignore lint/correctness/useExhaustiveDependencies: entityKey is intentional — changing it must re-arm the reset even though only stable setters are called in the body
  useEffect(() => {
    setApiData(null);
    setApiSettled(false);
    setError(null);
  }, [entityKey]);

  // Latest apiFetch in a ref so an unstable inline function from the
  // caller doesn't keep retriggering the timer effect on every render.
  const apiFetchRef = useRef(apiFetch);
  useEffect(() => {
    apiFetchRef.current = apiFetch;
  }, [apiFetch]);

  // Cold-start safety net: after graceMs, if neither canonical nor
  // payload covered us, fire the REST fallback.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retryNonce is intentional — incrementing it re-arms the timer on user retry
  useEffect(() => {
    const fetcher = apiFetchRef.current;
    if (!fetcher) return;
    if (localData != null) return;
    if (payload != null) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetcher();
        if (!cancelled) setApiData(res);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setApiSettled(true);
      }
    }, graceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [entityKey, localData, payload, graceMs, retryNonce]);

  // Once canonical (localData) arrives, free the cached payload. The
  // payloadRef captured at mount is preserved, so this clear has no
  // visible effect on the current screen; it just frees memory and
  // ensures a fresh navigation to the same entity doesn't pick up a
  // stale payload.
  useEffect(() => {
    if (localData != null) clearPushPayload(entityKey);
  }, [entityKey, localData]);

  const data: T | null = localData ?? apiData ?? payload ?? null;
  const source: EntitySource =
    localData != null
      ? "local"
      : apiData != null
        ? "api"
        : payload != null
          ? "payload"
          : "none";

  const apiInactive = apiFetch == null;
  const isResolving =
    data == null && (localIsLoading || (!apiInactive && !apiSettled));
  const isMissing =
    data == null && !localIsLoading && (apiInactive || apiSettled);

  return {
    data,
    source,
    isResolving,
    isMissing,
    error,
    retry: () => {
      setError(null);
      setApiData(null);
      setApiSettled(false);
      setRetryNonce((n) => n + 1);
    },
  };
};
