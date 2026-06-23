import { useStatus } from "@powersync/react-native";
import { useEffect, useRef, useState } from "react";
import useStore from "@/lib/store";

// Compact "X ago" formatter for the banner suffix. dayjs' `.fromNow()`
// produces verbose strings like "a few seconds ago" / "5 minutes ago"
// which eat banner real estate; the conventional shortform (`5m ago`,
// `1h ago`) reads at a glance and matches what users see in Slack,
// GitHub, iOS notifications, etc.
const formatCompactAgo = (date: Date | number | string): string => {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 1000),
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

export type NetworkBannerState =
  | "hidden"
  | "deviceOffline"
  | "serverUnreachable"
  | "syncUnavailable"
  | "reconnecting"
  | "online";

type FaultState = "deviceOffline" | "serverUnreachable" | "syncUnavailable";

const BACK_ONLINE_DISPLAY_MS = 2000;
// Absorb sub-second probe flaps (weak Wi-Fi, brief reachability misses,
// PowerSync reconnect cycles) before surfacing a fault. If the underlying
// signal recovers within this window the user sees nothing — no flicker,
// no "Back online" toast for a blip that didn't disrupt anything.
const FAULT_DEBOUNCE_MS = 1500;
// While PowerSync is actively retrying (`connecting: true`) after a sync
// fault, show the softer "Reconnecting…" copy so the banner matches the
// Sync Center's "Connecting…" spinner instead of contradicting it. After
// this window without recovery, escalate to the sterner "Live sync
// unavailable" so a permanently-stuck stream still gets surfaced.
const RECONNECTING_GRACE_MS = 10_000;

export const useNetworkBanner = () => {
  const { isConnected, isInternetReachable } = useStore();
  const {
    lastSyncedAt,
    connected: psConnected,
    connecting: psConnecting,
  } = useStatus();

  // Identify the deepest failing layer. Layers cascade (device down → API
  // + sync down; API down → sync down), so we surface only the deepest
  // because it's the most actionable explanation. `syncUnavailable` is
  // gated on `lastSyncedAt` to avoid false positives during cold start,
  // when PowerSync hasn't had a chance to connect yet. We deliberately
  // do NOT exclude `connecting` from fault detection — when the endpoint
  // is unreachable PowerSync stays in `connecting: true` retrying forever,
  // which is exactly the state this banner should surface. The 1.5s
  // debounce below absorbs brief reconnect cycles in normal operation;
  // `connecting` only feeds into the reconnecting→syncUnavailable display
  // split, not fault detection itself.
  const fault: FaultState | null = !isConnected
    ? "deviceOffline"
    : !isInternetReachable
      ? "serverUnreachable"
      : lastSyncedAt && !psConnected
        ? "syncUnavailable"
        : null;

  const [bannerState, setBannerState] = useState<NetworkBannerState>("hidden");
  const wasFaultedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upgradeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Anchor for the reconnecting→syncUnavailable upgrade window. Set when a
  // sync fault first appears and held across `connecting` flips so a flap
  // mid-outage doesn't restart the grace period.
  const syncFaultStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (faultTimerRef.current) {
      clearTimeout(faultTimerRef.current);
      faultTimerRef.current = null;
    }
    if (upgradeTimerRef.current) {
      clearTimeout(upgradeTimerRef.current);
      upgradeTimerRef.current = null;
    }

    if (fault === "syncUnavailable") {
      if (syncFaultStartedAtRef.current === null) {
        syncFaultStartedAtRef.current = Date.now();
      }
    } else {
      syncFaultStartedAtRef.current = null;
    }

    const resolveDisplay = (): NetworkBannerState => {
      if (fault !== "syncUnavailable") return fault as NetworkBannerState;
      const elapsed = syncFaultStartedAtRef.current
        ? Date.now() - syncFaultStartedAtRef.current
        : 0;
      return psConnecting && elapsed < RECONNECTING_GRACE_MS
        ? "reconnecting"
        : "syncUnavailable";
    };

    if (fault) {
      if (wasFaultedRef.current) {
        // Already showing a faulted banner — swap messages immediately as
        // the underlying cause changes (e.g., device-offline → server
        // still down once Wi-Fi returns). Re-debouncing here would leave
        // the user staring at a stale message for 1.5s.
        setBannerState(resolveDisplay());
      } else {
        // Healthy → faulted: debounce so a brief probe miss doesn't
        // flicker the banner. wasFaultedRef flips inside the timeout so a
        // flap shorter than the window won't trigger "Back online" either.
        faultTimerRef.current = setTimeout(() => {
          wasFaultedRef.current = true;
          setBannerState(resolveDisplay());
        }, FAULT_DEBOUNCE_MS);
      }

      if (
        fault === "syncUnavailable" &&
        psConnecting &&
        syncFaultStartedAtRef.current !== null
      ) {
        const remaining =
          RECONNECTING_GRACE_MS - (Date.now() - syncFaultStartedAtRef.current);
        if (remaining > 0) {
          upgradeTimerRef.current = setTimeout(() => {
            setBannerState((prev) =>
              prev === "reconnecting" ? "syncUnavailable" : prev,
            );
          }, remaining);
        }
      }
    } else if (wasFaultedRef.current) {
      setBannerState("online");
      hideTimerRef.current = setTimeout(() => {
        setBannerState("hidden");
        wasFaultedRef.current = false;
      }, BACK_ONLINE_DISPLAY_MS);
    } else {
      setBannerState("hidden");
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      if (faultTimerRef.current) {
        clearTimeout(faultTimerRef.current);
      }
      if (upgradeTimerRef.current) {
        clearTimeout(upgradeTimerRef.current);
      }
    };
  }, [fault, psConnecting]);

  const lastSyncedLabel = lastSyncedAt
    ? `synced ${formatCompactAgo(lastSyncedAt)}`
    : null;

  return {
    bannerState,
    isVisible: bannerState !== "hidden",
    lastSyncedLabel,
  };
};
