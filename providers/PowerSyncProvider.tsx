import useStore from "@/lib/store";
import { logDbPath, powersync, setupPowerSync } from "@/powersync/system";
import { PowerSyncContext } from "@powersync/react-native";
import { useEffect, useRef, useState } from "react";

const PowerSyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const accessToken = useStore((state) => state.accessToken);
  const isConnected = useStore((state) => state.isConnected);
  const isInternetReachable = useStore((state) => state.isInternetReachable);
  const wasConnectedRef = useRef(false);

  const isOnline = isConnected && isInternetReachable;

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize PowerSync database first (this makes it available for local queries)
        await powersync.init();
        logDbPath();

        // Only connect to sync service if authenticated and online
        if (accessToken && isOnline) {
          if (!wasConnectedRef.current) {
            await setupPowerSync();
            wasConnectedRef.current = true;
          }
        } else {
          // Disconnect sync but keep database available
          await powersync.disconnect();
          wasConnectedRef.current = false;
        }

        setIsReady(true);
      } catch (error) {
        console.error("PowerSync initialization failed:", error);
        setIsReady(true);
      }
    };

    initialize();
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
