import { useQuery } from "@powersync/react-native";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { bumpAttachmentPriority, retryAttachment } from "../attachments.api";
import { extractAttachmentId } from "../attachments.config";
import {
  getAttachmentProgress,
  subscribeAttachmentProgress,
} from "../attachments.progress";
import { ATTACHMENT_STATES, type AttachmentState } from "../attachments.schema";

type Row = {
  state: AttachmentState;
  local_uri: string | null;
  error: string | null;
};

export type UseAttachmentResult = {
  uri: string | undefined;
  state: AttachmentState | "unknown";
  error: string | undefined;
  retry: () => void;
  /**
   * Fractional download progress in [0, 1] while DOWNLOADING. `undefined`
   * when not downloading or when the server didn't send Content-Length
   * (chunked encoding) — render an indeterminate indicator in that case.
   */
  progress: number | undefined;
};

export function useAttachment(
  path: string | null | undefined,
): UseAttachmentResult {
  const id = extractAttachmentId(path);

  const { data } = useQuery<Row>(
    "SELECT state, local_uri, error FROM attachments_local WHERE id = ?",
    id ? [id] : [""],
  );

  const row = id ? data[0] : undefined;

  // Whenever this hook is mounted with a non-SYNCED attachment, bump it
  // to priority 1 — the same tier the watcher gives profile/subject
  // photos. Lighter than the push pre-enqueue (priority 0), so explicit
  // push targets still win. Re-runs on state transitions so a row that
  // arrives via PowerSync after mount also gets the bump. Idempotent at
  // the SQL level (MIN priority, SYNCED-filter), so cheap to re-fire.
  useEffect(() => {
    if (!id) return;
    if (row?.state === ATTACHMENT_STATES.SYNCED) return;
    void bumpAttachmentPriority([id], 1);
  }, [id, row?.state]);

  const retry = useCallback(() => {
    if (!id) return;
    void retryAttachment(id);
  }, [id]);

  // Subscribe to the in-memory progress store. Stable subscribe/getSnapshot
  // identities (memoized on id) keep React from churning subscriptions
  // every render.
  const subscribe = useCallback(
    (cb: () => void) => (id ? subscribeAttachmentProgress(id, cb) : () => {}),
    [id],
  );
  const getSnapshot = useCallback(
    () => (id ? getAttachmentProgress(id) : undefined),
    [id],
  );
  const progressEntry = useSyncExternalStore(subscribe, getSnapshot);
  const progress =
    progressEntry && progressEntry.fraction >= 0
      ? progressEntry.fraction
      : undefined;

  if (!id || !row) {
    return {
      uri: undefined,
      state: "unknown",
      error: undefined,
      retry,
      progress,
    };
  }

  return {
    uri: row.local_uri ?? undefined,
    state: row.state,
    error: row.error ?? undefined,
    retry,
    progress,
  };
}
