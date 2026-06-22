import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import HomeTabHeader from "@/components/HomeTabHeader";
import { SectionHeader } from "@/components/SectionHeader";
import Screen from "@/components/screen";
import { useAnnouncementsWithEvents } from "@/features/announcements/announcements.hooks";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import CampusNewsSection from "@/features/campus-news/components/CampusNewsSection";
import GreetingBand from "@/features/home/components/GreetingBand";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";

const PULL_THRESHOLD = 60;
const SPINNER_HEIGHT = 56;

const HomeScreen = () => {
  const { authUser } = useStore();
  const announcements = useAnnouncementsWithEvents();
  const [refreshing, setRefreshing] = useState(false);
  const bottomInset = useScrollBottomInset();
  const foregroundColor = useThemeColor("foreground");

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  // Eases the spinner area open/closed on refresh state changes; combined
  // with live pull amount via Math.max so the spinner stays visible during
  // the iOS bounce-back after the user releases past the pull threshold.
  const refreshOpenAmount = useSharedValue(0);

  useEffect(() => {
    refreshOpenAmount.value = withTiming(refreshing ? 1 : 0, { duration: 220 });
  }, [refreshing, refreshOpenAmount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ stale: true }),
        announcements.refresh?.(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [announcements]);

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (refreshing) return;
      if (e.nativeEvent.contentOffset.y < -PULL_THRESHOLD) {
        onRefresh();
      }
    },
    [refreshing, onRefresh],
  );

  // Cancels the scrollview's natural push-down during pull so GreetingBand
  // stays visually attached to HomeTabHeader instead of detaching. The pull
  // is absorbed by the spinner area's height expansion below, which pushes
  // the rest of the content down by the same amount — same finger travel,
  // but the greeting stays put.
  const antiPushStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(0, scrollOffset.value) }],
  }));

  // Spinner sits below GreetingBand inside the scrollview. Height tracks
  // the pull amount one-to-one so the rest of the content moves with the
  // finger; during refresh, height locks open at SPINNER_HEIGHT. The
  // Math.max merges both signals so the open-state survives the iOS
  // bounce-back that runs in parallel with the refresh starting.
  const spinnerContainerStyle = useAnimatedStyle(() => {
    const pulled = scrollOffset.value < 0 ? -scrollOffset.value : 0;
    const height = Math.max(refreshOpenAmount.value * SPINNER_HEIGHT, pulled);
    const visibility = Math.max(
      refreshOpenAmount.value,
      Math.min(pulled / SPINNER_HEIGHT, 1),
    );
    return {
      height,
      opacity: interpolate(visibility, [0, 0.5], [0, 1], Extrapolation.CLAMP),
    };
  });

  const isStudent = authUser?.role === "Student";

  return (
    <Screen>
      <HomeTabHeader />
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={1}
        onScrollEndDrag={handleScrollEndDrag}
        showsVerticalScrollIndicator={false}
        className="w-full"
        scrollIndicatorInsets={{ right: 1 }}
        style={{ marginBottom: bottomInset }}
      >
        <Animated.View style={antiPushStyle}>
          <GreetingBand />

          <Animated.View
            style={[
              {
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              },
              spinnerContainerStyle,
            ]}
          >
            <ActivityIndicator size="small" color={foregroundColor} />
          </Animated.View>

          {isStudent && (
            <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
              <SectionHeader title="My Schedule" iconName="CalendarIcon" />
              <ScheduleComponent />
            </View>
          )}

          <CampusNewsSection />

          <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
            <SectionHeader
              title="Announcements"
              iconName="MegaphoneIcon"
              actionLabel="See all"
              onAction={() => router.push("/announcement")}
            />
          </View>
          <AnnouncementList preview {...announcements} />
        </Animated.View>
      </Animated.ScrollView>
    </Screen>
  );
};

export default HomeScreen;
