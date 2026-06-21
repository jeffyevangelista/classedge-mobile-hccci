import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useNetworkBanner, type NetworkBannerState } from "./useNetworkBanner";
import { useNetworkBannerHeight } from "./NetworkBannerContext";

const BANNER_HEIGHT = 36;
const ANIMATION_DURATION = 300;

const bannerConfig: Record<
  Exclude<NetworkBannerState, "hidden">,
  { bg: string; text: string; icon: string; iconColor: string }
> = {
  deviceOffline: {
    bg: "#1F1F1F",
    text: "No internet connection",
    icon: "WifiSlashIcon",
    iconColor: "#FFFFFF",
  },
  serverUnreachable: {
    bg: "#1F1F1F",
    text: "Server unreachable",
    icon: "WifiSlashIcon",
    iconColor: "#FFFFFF",
  },
  syncUnavailable: {
    bg: "#1F1F1F",
    text: "Live sync unavailable",
    icon: "WifiSlashIcon",
    iconColor: "#FFFFFF",
  },
  reconnecting: {
    bg: "#1F1F1F",
    text: "Reconnecting...",
    icon: "ArrowsClockwiseIcon",
    iconColor: "#FACC15",
  },
  online: {
    bg: "#16A34A",
    text: "Back online",
    icon: "WifiHighIcon",
    iconColor: "#FFFFFF",
  },
};

const FAULTED_STATES: NetworkBannerState[] = [
  "deviceOffline",
  "serverUnreachable",
  "syncUnavailable",
];

const NetworkBanner = () => {
  const { bannerState, isVisible, lastSyncedLabel } = useNetworkBanner();
  const { setBannerHeight } = useNetworkBannerHeight();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(BANNER_HEIGHT + insets.bottom);
  const heightValue = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      const totalHeight = BANNER_HEIGHT + insets.bottom;
      // Reserve layout space upfront so scroll consumers
      // (useScrollBottomInset) immediately push content above the banner
      // area, even before the slide-in animation finishes. Without this,
      // scroll viewports can be cut by the banner during the animation
      // window or if the completion callback fails to fire.
      setBannerHeight(totalHeight);
      translateY.value = withTiming(0, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      heightValue.value = withTiming(totalHeight, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      translateY.value = withTiming(BANNER_HEIGHT + insets.bottom, {
        duration: ANIMATION_DURATION,
        easing: Easing.in(Easing.cubic),
      });
      // Defer clearing the reserved height until the banner has finished
      // sliding out — otherwise content would snap up before the banner
      // is gone from view.
      heightValue.value = withTiming(
        0,
        {
          duration: ANIMATION_DURATION,
          easing: Easing.in(Easing.cubic),
        },
        () => {
          runOnJS(setBannerHeight)(0);
        },
      );
    }
  }, [isVisible, insets.bottom]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: heightValue.value,
  }));

  const animatedBannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const config = bannerState !== "hidden" ? bannerConfig[bannerState] : null;
  const displayText =
    config && FAULTED_STATES.includes(bannerState) && lastSyncedLabel
      ? `${config.text} · ${lastSyncedLabel}`
      : config?.text;

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <Animated.View
        style={[
          styles.banner,
          animatedBannerStyle,
          { paddingBottom: insets.bottom, backgroundColor: config?.bg ?? "#1F1F1F" },
        ]}
      >
        <View style={styles.content}>
          {config && (
            <>
              <Icon
                name={config.icon as any}
                size={16}
                color={config.iconColor}
              />
              <AppText style={styles.text}>{displayText}</AppText>
            </>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    width: "100%",
  },
  banner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: BANNER_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Poppins-Medium",
  },
});

export default NetworkBanner;
