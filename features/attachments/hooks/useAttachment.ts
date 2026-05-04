import { useQuery } from "@powersync/react-native";
import { useCallback } from "react";
import { extractAttachmentId } from "../attachments.config";
import { retryAttachment } from "../attachments.api";
import { type AttachmentState } from "../attachments.schema";

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

  const retry = useCallback(() => {
    if (!id) return;
    void retryAttachment(id);
  }, [id]);

  if (!id || !row) {
    return { uri: undefined, state: "unknown", error: undefined, retry };
  }

  return {
    uri: row.local_uri ?? undefined,
    state: row.state,
    error: row.error ?? undefined,
    retry,
  };
}
