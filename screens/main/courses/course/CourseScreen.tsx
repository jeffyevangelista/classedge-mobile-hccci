import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import Screen from "@/components/screen";
import CourseTimeline from "@/features/courses/components/CourseTimeline";
import { useCourseDetails } from "@/features/courses/courses.hooks";
import { queryClient } from "@/providers/QueryProvider";
import { env } from "@/utils/env";
import { useLocalSearchParams } from "expo-router";
import { Card } from "heroui-native";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

const CourseScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { courseId } = useLocalSearchParams();

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

  return (
    <Screen className="px-2.5">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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
    <Card className=" w-full mx-auto  max-w-3xl mb-4 p-2">
      <Image
        source={
          data?.subjectId.subjectPhoto
            ? {
                uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${data.subjectId.subjectPhoto}`,
              }
            : require("@/assets/placeholder/bg-placeholder.png")
        }
        className="rounded-t-2xl w-full aspect-[29/9] md:aspect-[31/9] "
        contentFit="cover"
        cachePolicy="disk"
      />
      <View className="p-2 md:p-4">
        <AppText weight="semibold" className="text-sm md:text-lg">
          {data?.subjectId.subjectType
            ? `(${data?.subjectId.subjectType}) `
            : ""}{" "}
          {data?.subjectId.subjectName}
        </AppText>
      </View>
    </Card>
  );
};

export default CourseScreen;
