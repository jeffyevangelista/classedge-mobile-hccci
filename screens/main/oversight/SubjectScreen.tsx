import { useLocalSearchParams, useRouter } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { useCallback, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import BackButton from "@/components/BackButton";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import SubjectTimeline from "@/features/oversight/components/SubjectTimeline";
import {
  useGetSubject,
  useSubjectTimeline,
} from "@/features/oversight/oversight.hooks";
import { getApiErrorMessage } from "@/lib/api-error";

const NAV_HEIGHT = 56;

const SubjectScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const IMAGE_HEIGHT = Math.round(screenHeight * 0.28);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const subjectQuery = useGetSubject(subjectId ?? "");
  const timelineQuery = useSubjectTimeline(subjectId ?? "");

  const surfaceColor = useThemeColor("surface");
  const foregroundColor = useThemeColor("foreground");
  const borderColor = useThemeColor("border");

  // Pull-to-refresh refetches BOTH the subject metadata AND the timeline
  // in parallel — diverges from CourseScreen, which only refetches the
  // PowerSync-watched details query (the watch covers the timeline).
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([subjectQuery.refetch(), timelineQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [subjectQuery, timelineQuery]);

  const refreshControl = useMemo(
    () => <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />,
    [refreshing, onRefresh],
  );

  // Stretchy header (iOS pull-to-refresh pattern): when the user pulls down,
  // translateY cancels the scrollview's push-down so the image's top stays
  // anchored at the viewport top, then scaleY stretches it to fill the
  // pulled-down area. Without the translateY, scale alone leaves a white
  // gap above the photo where the spinner sits.
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const pulled = scrollOffset.value < 0 ? -scrollOffset.value : 0;
    return {
      transformOrigin: "top",
      transform: [
        { translateY: -pulled },
        { scaleY: 1 + pulled / IMAGE_HEIGHT },
      ],
    };
  });

  const navBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [0, IMAGE_HEIGHT],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const navTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [IMAGE_HEIGHT, IMAGE_HEIGHT + 30],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const floatingBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [0, IMAGE_HEIGHT],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.container} className="bg-background">
      {/* Animated Navigation Bar */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top,
          height: insets.top + NAV_HEIGHT,
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: surfaceColor,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: borderColor,
            },
            navBgStyle,
          ]}
        />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
          }}
        >
          <View>
            <Animated.View
              style={[styles.floatingBtn, floatingBtnStyle]}
              className="bg-white/70 dark:bg-black/50"
            />
            <View className="w-10 h-10 rounded-full flex justify-center items-center">
              <BackButton tintColor={foregroundColor} />
            </View>
          </View>
          <Animated.View
            style={[{ flex: 1, marginHorizontal: 4 }, navTitleStyle]}
          >
            <AppText
              weight="semibold"
              className="text-lg text-foreground"
              numberOfLines={1}
            >
              {subjectQuery.data?.subjectName ?? ""}
            </AppText>
          </Animated.View>
          <View>
            <Animated.View
              style={[styles.floatingBtn, floatingBtnStyle]}
              className="bg-white/70 dark:bg-black/50"
            />
            <Pressable
              onPress={() =>
                router.push(`/subject/${subjectId}/subject-details`)
              }
              accessibilityRole="button"
              accessibilityLabel="Open subject details"
              android_ripple={{
                color: "rgba(0,0,0,0.1)",
                borderless: true,
              }}
              hitSlop={4}
              className="w-10 h-10 rounded-full flex justify-center items-center active:opacity-70"
            >
              <Icon
                name="InfoIcon"
                size={22}
                color={foregroundColor}
                style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Parallax ScrollView */}
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={1}
        refreshControl={refreshControl}
      >
        <Animated.View
          style={[
            styles.imageHeader,
            { height: IMAGE_HEIGHT },
            headerAnimatedStyle,
          ]}
          className="bg-default"
        >
          {subjectQuery.isLoading ? (
            <Skeleton style={StyleSheet.absoluteFill} />
          ) : (
            <Image
              source={
                subjectQuery.data?.subjectPhoto
                  ? { uri: subjectQuery.data.subjectPhoto }
                  : require("@/assets/placeholder/bg-placeholder.png")
              }
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="disk"
            />
          )}
        </Animated.View>

        <View style={styles.content} className="bg-background">
          {subjectQuery.isLoading ? (
            <View className="gap-4">
              <View className="gap-2">
                <Skeleton className="h-6 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-1/3 rounded-full" />
              </View>
            </View>
          ) : subjectQuery.isError ? (
            <ErrorComponent message={getApiErrorMessage(subjectQuery.error)} />
          ) : (
            <View className="gap-1">
              <AppText
                weight="semibold"
                className="text-lg md:text-xl text-foreground leading-snug"
              >
                {subjectQuery.data?.subjectName}
              </AppText>
              {subjectQuery.data?.subjectType && (
                <AppText className="text-xs md:text-sm text-muted">
                  {subjectQuery.data.subjectType}
                </AppText>
              )}
            </View>
          )}
          <SubjectTimeline />
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageHeader: {
    overflow: "hidden",
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 24,
    gap: 16,
    overflow: "hidden",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    minHeight: "100%",
  },
  floatingBtn: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
  },
});

export default SubjectScreen;
