import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useNetworkBannerHeight } from "@/features/network/NetworkBannerContext";

/**
 * Bottom inset for scrollable content.
 *
 * Returns the inset to apply (typically as `style.marginBottom`) so scroll
 * content stops above the system nav bar and the network banner.
 *
 * Behavior depends on context:
 * - Inside the (tabs) layout: the outer Animated.View at
 *   `app/(main)/(tabs)/_layout.tsx` already applies `paddingBottom:
 *   insets.bottom`. So we only need to clear the network banner (when up)
 *   plus the extra breathing room. Return `bannerHeight + extra`.
 * - Outside the (tabs) layout (stack-pushed screens, modals, etc.): the
 *   screen sits directly above the system nav. Return
 *   `insets.bottom + bannerHeight + extra`.
 *
 * For PINNED bottom bars (CTA bars, tab bars), use `useSafeBottomInset`
 * instead — that one returns 0 while the banner is visible, since pinned
 * bars sit on top of the banner.
 */
export function useScrollBottomInset(extra = 0): number {
  const { bottom } = useSafeAreaInsets();
  const { bannerHeight } = useNetworkBannerHeight();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const isInsideTabs = tabBarHeight !== undefined;
  const systemInset = isInsideTabs ? 0 : bottom;
  return systemInset + bannerHeight + extra;
}
