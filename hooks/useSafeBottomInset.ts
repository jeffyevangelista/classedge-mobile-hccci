import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkBannerHeight } from "@/features/network/NetworkBannerContext";
import useStore from "@/lib/store";

/**
 * Returns the effective safe-area bottom inset for pinned bottom bars.
 *
 * When the network banner is showing (or the device is offline so the banner
 * is about to mount), the banner takes the space normally claimed by the
 * safe-area inset — so consumers should treat the inset as 0 to avoid
 * double-padding above the banner.
 */
export function useSafeBottomInset(): number {
  const insets = useSafeAreaInsets();
  const { bannerHeight } = useNetworkBannerHeight();
  const { isConnected, isInternetReachable } = useStore();
  const isOffline = !isConnected || !isInternetReachable;
  const isBannerVisible = bannerHeight > 0;
  return isOffline || isBannerVisible ? 0 : insets.bottom;
}
