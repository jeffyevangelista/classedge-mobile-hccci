import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { scanAllColumns } from "@/features/attachments/attachments.watcher";
import { silentRefresh } from "@/features/auth/useTokenRefresh";
import useStore from "@/lib/store";
import { env } from "@/utils/env";

// Point NetInfo's reachability probe at our own backend instead of the
// default `clients3.google.com/generate_204`. Google's probe is blocked or
// throttled by many school/corporate networks and some PH ISPs, which
// causes `isInternetReachable` to stay false even when the actual API is
// reachable — surfacing as a permanent "Offline" banner. Probing the
// backend makes "online" mean "the API the app actually uses is up."
//
// Must run before any `NetInfo.addEventListener` registration; the module
// top-level is the safe place.
NetInfo.configure({
  reachabilityUrl: `${env.EXPO_PUBLIC_API_URL}/health/`,
  reachabilityTest: async (response) => response.status === 204,
  reachabilityLongTimeout: 60 * 1000,
  reachabilityShortTimeout: 5 * 1000,
  reachabilityRequestTimeout: 10 * 1000,
});

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
      // be expired but PowerSync/axios haven't tried to use it yet. Also
      // trigger an attachments scan — rows that failed during the offline
      // window are stuck in FAILED and only the watcher's auto-heal flips
      // them back to QUEUED. Without this, they'd wait for the next DB
      // change to retry.
      if (
        wasOnlineRef.current === false &&
        isOnline &&
        useStore.getState().isAuthenticated
      ) {
        void silentRefresh();
        void scanAllColumns();
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
