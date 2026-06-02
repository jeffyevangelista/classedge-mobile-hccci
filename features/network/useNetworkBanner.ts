import useStore from "@/lib/store";
import { useStatus } from "@powersync/react-native";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useRef, useState } from "react";

dayjs.extend(relativeTime);

export type NetworkBannerState = "hidden" | "offline" | "reconnecting" | "online";

const BACK_ONLINE_DISPLAY_MS = 2000;

export const useNetworkBanner = () => {
  const { isConnected, isInternetReachable } = useStore();
  const isOnline = isConnected && isInternetReachable;
  const { lastSyncedAt } = useStatus();

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

  const lastSyncedLabel = lastSyncedAt
    ? `synced ${dayjs(lastSyncedAt).fromNow()}`
    : null;

  return {
    bannerState,
    isVisible: bannerState !== "hidden",
    setReconnecting,
    lastSyncedLabel,
  };
};
