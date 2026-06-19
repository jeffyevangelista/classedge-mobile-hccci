import useStore from "@/lib/store";
import { getMMKVItem } from "@/lib/storage/mmkv-storage";
import { MMKV_KEYS } from "@/utils/storage-keys";

export type RefreshExpiryState = "safe" | "warn" | "critical" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_THRESHOLD_DAYS = 7;
const CRITICAL_THRESHOLD_DAYS = 1;

export type RefreshExpiryReading = {
  state: RefreshExpiryState;
  daysRemaining: number | null;
  shouldShowBanner: boolean;
  shouldShowModal: boolean;
};

export function useRefreshExpiry(): RefreshExpiryReading {
  const refreshExpiresAt = useStore((s) => s.refreshExpiresAt);
  const isConnected = useStore((s) => s.isConnected);
  const isInternetReachable = useStore((s) => s.isInternetReachable);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  if (!isAuthenticated || refreshExpiresAt == null) {
    return {
      state: "safe",
      daysRemaining: null,
      shouldShowBanner: false,
      shouldShowModal: false,
    };
  }

  const msRemaining = refreshExpiresAt - Date.now();
  const daysRemaining = msRemaining / DAY_MS;
  const offline = !isConnected || !isInternetReachable;

  let state: RefreshExpiryState;
  if (msRemaining <= 0) state = "expired";
  else if (daysRemaining <= CRITICAL_THRESHOLD_DAYS) state = "critical";
  else if (daysRemaining <= WARN_THRESHOLD_DAYS) state = "warn";
  else state = "safe";

  const shouldShowBanner =
    offline && (state === "warn" || state === "critical");

  const todayIso = new Date().toISOString().slice(0, 10);
  const lastShown = getMMKVItem<string>(
    MMKV_KEYS.LAST_REFRESH_EXPIRY_WARNING_SHOWN,
  );
  const shouldShowModal =
    offline && state === "critical" && lastShown !== todayIso;

  return {
    state,
    daysRemaining: Math.max(0, daysRemaining),
    shouldShowBanner,
    shouldShowModal,
  };
}
