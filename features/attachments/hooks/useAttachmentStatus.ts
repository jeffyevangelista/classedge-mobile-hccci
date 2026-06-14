import { useQuery } from "@powersync/react-native";
import { useEffect, useState } from "react";
import { attachmentQueue } from "../attachments.queue";

type CountRow = { state: string; n: number };

export type AttachmentStatus = {
  queued: number;
  downloading: number;
  synced: number;
  failed: number;
  total: number;
  inFlight: number;
  isDownloading: boolean;
  progress: number;
  lowStorage: boolean;
};

export function useAttachmentStatus(): AttachmentStatus {
  const { data } = useQuery<CountRow>(
    "SELECT state, COUNT(*) AS n FROM attachments_local GROUP BY state",
  );

  const [lowStorage, setLowStorage] = useState(attachmentQueue.isLowStorage());

  useEffect(() => {
    return attachmentQueue.onChange(() => {
      setLowStorage(attachmentQueue.isLowStorage());
    });
  }, []);

  const counts = { queued: 0, downloading: 0, synced: 0, failed: 0 };
  for (const row of data ?? []) {
    if (row.state === "queued") counts.queued = row.n;
    else if (row.state === "downloading") counts.downloading = row.n;
    else if (row.state === "synced") counts.synced = row.n;
    else if (row.state === "failed") counts.failed = row.n;
  }

  const total =
    counts.queued + counts.downloading + counts.synced + counts.failed;
  const inFlight = counts.queued + counts.downloading;

  return {
    ...counts,
    total,
    inFlight,
    isDownloading: inFlight > 0,
    progress: total > 0 ? counts.synced / total : 1,
    lowStorage,
  };
}
