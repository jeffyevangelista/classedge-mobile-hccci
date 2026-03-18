import useStore from "@/lib/store";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";

const NetworkProvider = ({ children }: { children: React.ReactNode }) => {
  const { setNetworkState } = useStore();

  useEffect(() => {
    // Sync React Query's onlineManager with NetInfo so queries
    // automatically pause/resume based on connectivity.
    onlineManager.setEventListener((setOnline) => {
      return NetInfo.addEventListener((state) => {
        const isOnline = !!(state.isConnected && state.isInternetReachable);
        setOnline(isOnline);
      });
    });

    // Keep Zustand store in sync for imperative access (axios, PowerSync).
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      setNetworkState({
        isConnected: !!state.isConnected,
        isInternetReachable: !!state.isInternetReachable,
      });
    });

    return () => {
      unsubscribeNetInfo();
    };
  }, [setNetworkState]);

  return <>{children}</>;
};

export default NetworkProvider;
