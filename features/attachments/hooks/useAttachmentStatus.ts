import { useEffect, useState } from "react";
import { useQuery } from "@powersync/react-native";
import { attachmentQueue } from "../attachments.queue";

type CountRow = { state: string; n: number };

export type AttachmentStatus = {
  pending: number;
  downloading: number;
  synced: number;
  failed: number;
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

  const counts = { pending: 0, downloading: 0, synced: 0, failed: 0 };
  for (const row of data ?? []) {
    if (row.state === "queued") counts.pending = row.n;
    else if (row.state === "downloading") counts.downloading = row.n;
    else if (row.state === "synced") counts.synced = row.n;
    else if (row.state === "failed") counts.failed = row.n;
  }

  return { ...counts, lowStorage };
}
