import { useQuery } from "@powersync/react-native";

type StateCountRow = { state: string; count: number };

export type AttachmentSyncStatus = {
  total: number;
  queued: number;
  downloading: number;
  synced: number;
  failed: number;
  inFlight: number;
  isDownloading: boolean;
  progress: number;
};

export function useAttachmentSyncStatus(): AttachmentSyncStatus {
  const { data: counts = [] } = useQuery<StateCountRow>(
    "SELECT state, COUNT(*) as count FROM attachments_local GROUP BY state",
  );

  const byState = counts.reduce<Record<string, number>>((acc, row) => {
    acc[row.state] = Number(row.count);
    return acc;
  }, {});

  const queued = byState["queued"] ?? 0;
  const downloading = byState["downloading"] ?? 0;
  const synced = byState["synced"] ?? 0;
  const failed = byState["failed"] ?? 0;
  const total = queued + downloading + synced + failed;
  const inFlight = queued + downloading;
  const isDownloading = inFlight > 0;
  const progress = total > 0 ? synced / total : 1;

  return {
    total,
    queued,
    downloading,
    synced,
    failed,
    inFlight,
    isDownloading,
    progress,
  };
}
