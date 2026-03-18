import useStore from "@/lib/store";
import { useEffect, useRef, useState } from "react";

export type NetworkBannerState = "hidden" | "offline" | "reconnecting" | "online";

const BACK_ONLINE_DISPLAY_MS = 2000;

export const useNetworkBanner = () => {
  const { isConnected, isInternetReachable } = useStore();
  const isOnline = isConnected && isInternetReachable;

  const [bannerState, setBannerState] = useState<NetworkBannerState>("hidden");
  const wasOfflineRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!isOnline) {
      // Device went offline
      wasOfflineRef.current = true;
      setBannerState("offline");
    } else if (wasOfflineRef.current) {
      // Device came back online after being offline
      setBannerState("online");
      hideTimerRef.current = setTimeout(() => {
        setBannerState("hidden");
        wasOfflineRef.current = false;
      }, BACK_ONLINE_DISPLAY_MS);
    } else {
      // Was already online, no banner needed
      setBannerState("hidden");
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [isOnline]);

  const setReconnecting = () => {
    if (bannerState === "offline") {
      setBannerState("reconnecting");
    }
  };

  return {
    bannerState,
    isVisible: bannerState !== "hidden",
    setReconnecting,
  };
};
