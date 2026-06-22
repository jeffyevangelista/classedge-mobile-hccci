import { PowerSyncContext } from "@powersync/react-native";
import { useEffect, useRef, useState } from "react";
import { attachmentQueue } from "@/features/attachments/attachments.queue";
import { startAttachmentWatcher } from "@/features/attachments/attachments.watcher";
import useStore from "@/lib/store";
import {
  syncRoleStreams,
  unsubscribeAllRoleStreams,
} from "@/powersync/streamSubscriptions";
import { logDbPath, powersync, setupPowerSync } from "@/powersync/system";

const PowerSyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const accessToken = useStore((state) => state.accessToken);
  // Gate setupPowerSync on `powersyncToken` too. `hydrateSession` writes
  // `accessToken` and `powersyncToken` as separate Zustand updates — without
  // this gate, the effect fires on the first write and runs `setupPowerSync`
  // with an empty `powersyncToken`, so `syncRoleStreams` subscribes to no
  // role-specific streams and `fetchCredentials` returns "" to the SDK.
  const powersyncToken = useStore((state) => state.powersyncToken);
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

        if (accessToken && powersyncToken && isOnline) {
          if (!wasConnectedRef.current) {
            await setupPowerSync(powersyncToken);
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
  }, [accessToken, powersyncToken, isOnline]);

  // Keep stream subscriptions in sync with the active `powersyncToken`. Handles
  // token rotations from `silentRefresh` (e.g. a role claim change) without
  // requiring a full `setupPowerSync` rerun. Idempotent — `syncRoleStreams`
  // diffs against `activeSubscriptions` and dedup's repeat calls.
  useEffect(() => {
    if (!wasConnectedRef.current || !powersyncToken) return;
    void syncRoleStreams(powersyncToken);
  }, [powersyncToken]);

  // Optional: Don't render the app until the DB is ready
  if (!isReady) return null;

  return (
    <PowerSyncContext.Provider value={powersync}>
      {children}
    </PowerSyncContext.Provider>
  );
};

export default PowerSyncProvider;
