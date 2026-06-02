import useStore from "@/lib/store";
import { logDbPath, powersync, setupPowerSync } from "@/powersync/system";
import { unsubscribeAllRoleStreams } from "@/powersync/streamSubscriptions";
import { PowerSyncContext } from "@powersync/react-native";
import { useEffect, useRef, useState } from "react";
import { startAttachmentWatcher } from "@/features/attachments/attachments.watcher";
import { attachmentQueue } from "@/features/attachments/attachments.queue";

const PowerSyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const accessToken = useStore((state) => state.accessToken);
  const isConnected = useStore((state) => state.isConnected);
  const isInternetReachable = useStore((state) => state.isInternetReachable);
  const wasConnectedRef = useRef(false);

  const isOnline = isConnected && isInternetReachable;

  useEffect(() => {
    let stopWatcher: (() => void) | undefined;

    const initialize = async () => {
      try {
        await powersync.init();
        logDbPath();

        if (accessToken && isOnline) {
          if (!wasConnectedRef.current) {
            await setupPowerSync();
            wasConnectedRef.current = true;
          }
          attachmentQueue.start();
          stopWatcher = startAttachmentWatcher();

          // Debug: dump current FAILED attachments so we can see actual errors.
          try {
            const failed = await powersync.getAll<{
              id: string;
              resource: string;
              error: string;
              retry_count: number;
              source_table: string;
            }>(
              `SELECT id, resource, error, retry_count, source_table
               FROM attachments_local WHERE state = 'failed' ORDER BY updated_at DESC`,
            );
            if (failed.length > 0) {
              console.warn(
                `[attachments] ${failed.length} FAILED attachments at startup:`,
              );
              for (const f of failed) {
                console.warn(
                  `  - ${f.source_table} ${f.resource}/${f.id} retry=${f.retry_count} :: ${f.error}`,
                );
              }
            }
          } catch (e) {
            console.warn("[attachments] failed-row inventory dump errored", e);
          }
        } else {
          unsubscribeAllRoleStreams();
          await powersync.disconnect();
          wasConnectedRef.current = false;
          attachmentQueue.stop();
        }

        setIsReady(true);
      } catch (error) {
        console.error("PowerSync initialization failed:", error);
        setIsReady(true);
      }
    };

    initialize();

    return () => {
      stopWatcher?.();
      attachmentQueue.stop();
    };
  }, [accessToken, isOnline]);

  // Optional: Don't render the app until the DB is ready
  if (!isReady) return null;

  return (
    <PowerSyncContext.Provider value={powersync}>
      {children}
    </PowerSyncContext.Provider>
  );
};

export default PowerSyncProvider;
