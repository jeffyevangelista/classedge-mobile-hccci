import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { silentRefresh } from "@/features/auth/useTokenRefresh";
import useStore from "@/lib/store";

const NetworkProvider = ({ children }: { children: React.ReactNode }) => {
  const { setNetworkState } = useStore();
  // Tracks the previous online state so we can detect the offline→online
  // edge. Starts as null so the very first NetInfo event (which may report
  // either state) does NOT count as a transition.
  const wasOnlineRef = useRef<boolean | null>(null);

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
      const isOnline = !!(state.isConnected && state.isInternetReachable);

      // Offline→online edge: kick a silent refresh immediately instead of
      // waiting up to 60s for the next useTokenRefresh poll tick. Closes
      // the post-reconnect limbo window where the access token may already
      // be expired but PowerSync/axios haven't tried to use it yet.
      if (
        wasOnlineRef.current === false &&
        isOnline &&
        useStore.getState().isAuthenticated
      ) {
        void silentRefresh();
      }
      wasOnlineRef.current = isOnline;

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
