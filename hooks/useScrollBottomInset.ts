import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkBannerHeight } from "@/features/network/NetworkBannerContext";
import useStore from "@/lib/store";

/**
 * Bottom inset for scrollable content.
 *
 * Returns the inset to apply as `contentContainerStyle.paddingBottom` on
 * a scroll view, so the last item rests above the system gesture/nav
 * area while the scroll viewport itself extends to the screen edge
 * (matches iOS-native behavior).
 *
 * Known trade-off: on Android with edge-to-edge enabled (app.config.ts)
 * AND a translucent 3-button nav bar, mid-scroll content is visible
 * behind the nav. This is accepted for now in exchange for edge-to-edge
 * behavior on iOS and gesture-nav devices. Permanent fix is to set the
 * Android nav bar opaque (via expo-navigation-bar) so the system nav
 * hides any content drawn behind it.
 *
 * Behavior depends on context:
 * - Inside the (tabs) layout: the tab bar sits between the scroll content
 *   and the network banner, and the (tabs) Animated.View handles its own
 *   bottom safe-area inset. The scroll viewport doesn't need to reserve
 *   anything; return `extra` only.
 * - Outside the (tabs) layout (stack-pushed screens, modals, etc.): the
 *   `NetworkBanner` is a flex sibling of the Stack at the root, so when
 *   the banner is visible the Stack container shrinks by the banner's
 *   height — the scroll viewport's parent already excludes the banner
 *   area, and adding any bottom inset for the banner would just produce
 *   dead space between the viewport and the banner top.
 *
 *   So: only reserve the safe-area inset (home indicator / Android nav)
 *   when the banner is hidden. When the banner is visible (or we're
 *   offline and the banner is about to mount), return `extra` only.
 *
 * `useSafeBottomInset` (for pinned bottom bars like CTA buttons or tab
 * bars) uses identical logic — both scroll content and pinned bars need
 * a bottom inset only when the banner isn't claiming the bottom of the
 * Stack.
 */
export function useScrollBottomInset(extra = 0): number {
  const { bottom } = useSafeAreaInsets();
  const { bannerHeight } = useNetworkBannerHeight();
  const { isConnected, isInternetReachable } = useStore();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const isInsideTabs = tabBarHeight !== undefined;
  if (isInsideTabs) return extra;

  const isBannerActive =
    !isConnected || !isInternetReachable || bannerHeight > 0;
  return (isBannerActive ? 0 : bottom) + extra;
}
