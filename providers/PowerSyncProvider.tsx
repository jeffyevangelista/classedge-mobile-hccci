import useStore from "@/lib/store";
import { powersync, setupPowerSync } from "@/powersync/system";
import { PowerSyncContext } from "@powersync/react-native";
import { useEffect, useState } from "react";

const PowerSyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const accessToken = useStore((state) => state.accessToken);

  useEffect(() => {
    const initialize = async () => {
      // Only initialize PowerSync if user is authenticated
      if (!accessToken) {
        // Disconnect PowerSync if user logs out
        await powersync.disconnect();
        setIsReady(true);
        return;
      }

      try {
        // 1. Start the sync engine (this calls powersync.connect(connector))
        await setupPowerSync();
        setIsReady(true);
      } catch (error) {
        console.error("PowerSync failed to connect:", error);
        // Still set ready to true so app can render
        setIsReady(true);
      }
    };

    initialize();
  }, [accessToken]);

  // Optional: Don't render the app until the DB is ready
  if (!isReady) return null;

  return (
    <PowerSyncContext.Provider value={powersync}>
      {children}
    </PowerSyncContext.Provider>
  );
};

export default PowerSyncProvider;
