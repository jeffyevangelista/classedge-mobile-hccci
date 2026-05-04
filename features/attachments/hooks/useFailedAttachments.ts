import { useQuery } from "@powersync/react-native";
import { ATTACHMENT_STATES } from "../attachments.schema";

export type FailedAttachment = {
  id: string;
  resource: string;
  source_table: string;
  source_col: string;
  error: string;
  retry_count: number;
  updated_at: string;
};

export function useFailedAttachments() {
  return useQuery<FailedAttachment>(
    `SELECT id, resource, source_table, source_col, error, retry_count, updated_at
     FROM attachments_local
     WHERE state = ?
     ORDER BY updated_at DESC`,
    [ATTACHMENT_STATES.FAILED],
  );
}
