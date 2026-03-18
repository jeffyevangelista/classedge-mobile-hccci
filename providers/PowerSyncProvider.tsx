import useStore from "@/lib/store";
import { powersync, setupPowerSync } from "@/powersync/system";
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
      // Only initialize PowerSync if user is authenticated
      if (!accessToken) {
        // Disconnect PowerSync if user logs out
        await powersync.disconnect();
        wasConnectedRef.current = false;
        setIsReady(true);
        return;
      }

      if (!isOnline) {
        // Disconnect when offline to stop infinite retry loops (saves battery).
        // Local reads from the SQLite DB still work.
        await powersync.disconnect();
        wasConnectedRef.current = false;
        setIsReady(true);
        return;
      }

      try {
        // Only reconnect if we weren't already connected
        if (!wasConnectedRef.current) {
          await setupPowerSync();
          wasConnectedRef.current = true;
        }
        setIsReady(true);
      } catch (error) {
        console.error("PowerSync failed to connect:", error);
        // Still set ready to true so app can render
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
