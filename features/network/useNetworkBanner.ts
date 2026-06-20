import { useStatus } from "@powersync/react-native";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useRef, useState } from "react";
import useStore from "@/lib/store";

dayjs.extend(relativeTime);

export type NetworkBannerState =
  | "hidden"
  | "offline"
  | "reconnecting"
  | "online";

const BACK_ONLINE_DISPLAY_MS = 2000;
// Absorb sub-second probe flaps (weak Wi-Fi, brief reachability misses)
// before declaring offline. If connectivity comes back within this window
// the user sees nothing — no flicker, no "Back online" toast for a blip
// that didn't disrupt anything.
const OFFLINE_DEBOUNCE_MS = 1500;

export const useNetworkBanner = () => {
  const { isConnected, isInternetReachable } = useStore();
  const isOnline = isConnected && isInternetReachable;
  const { lastSyncedAt } = useStatus();

  const [bannerState, setBannerState] = useState<NetworkBannerState>("hidden");
  const wasOfflineRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }

    if (!isOnline) {
      // Debounce: only commit to "offline" if it persists. wasOfflineRef
      // is set inside the timeout so a flap shorter than the window
      // doesn't trigger the "Back online" banner afterward either.
      offlineTimerRef.current = setTimeout(() => {
        wasOfflineRef.current = true;
        setBannerState("offline");
      }, OFFLINE_DEBOUNCE_MS);
    } else if (wasOfflineRef.current) {
      // Device came back online after being offline
      setBannerState("online");
      hideTimerRef.current = setTimeout(() => {
        setBannerState("hidden");
        wasOfflineRef.current = false;
      }, BACK_ONLINE_DISPLAY_MS);
    } else {
      // Was already online (or flap absorbed by debounce), no banner needed
      setBannerState("hidden");
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
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
