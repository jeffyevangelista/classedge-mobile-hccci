import { useQuery, useStatus } from "@powersync/react-native";

export const useSyncData = () => {
  const {
    lastSyncedAt,
    connected,
    connecting,
    hasSynced,
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
    hasSynced,
    pendingChanges,
    unsyncedCount,
    lastSyncedAt,
    uploading,
    downloading,
    connected,
    connecting,
    downloadError,
    downloadProgress,
    internalStreamSubscriptions,
    uploadError,
  };
};
