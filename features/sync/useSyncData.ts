import React from "react";
import { useQuery, useStatus } from "@powersync/react-native";

export const useSyncData = () => {
  const {
    lastSyncedAt,
    connected,

    dataFlowStatus: {
      uploading,
      downloading,
      downloadError,
      downloadProgress,
      internalStreamSubscriptions,
      uploadError,
    },
  } = useStatus();

  const { data: rawRows = [] } = useQuery("SELECT id, data FROM ps_crud");

  const pendingChanges = React.useMemo(() => {
    return rawRows
      .map((row) => {
        try {
          const body = JSON.parse(row.data);
          return {
            rowId: row.id,
            table: body.type,
            operation: body.op,
            recordId: body.id,
            fields: body.data,
          };
        } catch (e) {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [rawRows]);

  const unsyncedCount = pendingChanges.length;

  return {
    pendingChanges,
    unsyncedCount,
    lastSyncedAt,
    uploading,
    downloading,
    connected,
    downloadError,
    downloadProgress,
    internalStreamSubscriptions,
    uploadError,
  };
};
