import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import Screen from "@/components/screen";
import CourseTimeline from "@/features/courses/components/CourseTimeline";
import { useCourseDetails } from "@/features/courses/courses.hooks";
import { queryClient } from "@/providers/QueryProvider";
import { env } from "@/utils/env";
import { useLocalSearchParams } from "expo-router";
import { Card } from "heroui-native";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useUniwind } from "uniwind";

const CourseScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { courseId } = useLocalSearchParams();
  const { theme } = useUniwind();

  const isDark = theme === "dark";
  const spinnerColor = isDark ? "#FFF" : "#000";
  const bgColor = isDark ? "#333" : "#FFF";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({
      queryKey: ["course-details", courseId as string],
    });
    await queryClient.invalidateQueries({
      queryKey: ["course-timeline", courseId as string],
    });
    setRefreshing(false);
  }, [courseId]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={spinnerColor}
        colors={[spinnerColor]}
        progressBackgroundColor={bgColor}
      />
    ),
    [refreshing, onRefresh, spinnerColor, bgColor],
  );

  return (
    <Screen className="px-2.5">
      <ScrollView refreshControl={refreshControl}>
        <TimelineHeader />
        <CourseTimeline />
      </ScrollView>
    </Screen>
  );
};

const TimelineHeader = () => {
  const { courseId } = useLocalSearchParams();
  const { data, isLoading, isError, error, isRefetching } = useCourseDetails(
    courseId as string,
  );

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>Error: {error.message}</AppText>;

  return (
    <Card className="shadow-none w-full mx-auto rounded-xl max-w-3xl p-0 overflow-hidden mt-2.5">
      <Image
        source={
          data?.subjectId.subjectPhoto
            ? {
                uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${data.subjectId.subjectPhoto}`,
              }
            : require("@/assets/placeholder/bg-placeholder.png")
        }
        className="w-full rounded-t-xl aspect-29/9 md:aspect-31/9"
        contentFit="cover"
        cachePolicy="disk"
      />
      <View className="p-4 md:p-6">
        <AppText
          weight="semibold"
          className="text-base md:text-xl dark:text-white leading-snug"
        >
          {data?.subjectId.subjectName}
        </AppText>
        {data?.subjectId.subjectType && (
          <AppText className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {data.subjectId.subjectType}
          </AppText>
        )}
      </View>
    </Card>
  );
};

export default CourseScreen;
