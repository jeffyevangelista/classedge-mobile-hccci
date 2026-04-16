import { AppText } from "@/components/AppText";
import FileRenderer from "@/components/FileRenderer";
import Screen from "@/components/screen";
import { useLesson } from "@/features/oversight/oversight.hooks";
import { useFormattedDate } from "@/hooks/userFormattedDate";
import { useLocalSearchParams } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";
import { Skeleton } from "heroui-native";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";

const LessonScreen = () => {
  const { lessonId } = useLocalSearchParams();
  const { isLoading, isError, error, data, isRefetching, refetch } = useLesson(
    lessonId as string,
  );

  if (isLoading) return <LessonScreenSkeleton />;
  if (isError)
    return (
      <ErrorFallback
        message={error?.message ?? "Something went wrong"}
        onRefetch={refetch}
      />
    );

  if (!data)
    return (
      <NoDataFallback
        title="Lesson not found"
        description="The lesson you're looking for doesn't exist"
        onRefetch={refetch}
      />
    );

  const formattedDate = data?.startDate
    ? useFormattedDate(data.startDate)
    : null;

  return (
    <Screen className="bg-white dark:bg-neutral-900">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 w-full max-w-3xl mx-auto p-4">
          <View>
            <AppText className="text-sm text-neutral-500 dark:text-neutral-400">
              {formattedDate || "Date not available"}
            </AppText>
            <AppText
              weight="semibold"
              className="text-xl text-neutral-900 dark:text-neutral-100 mt-1"
            >
              {data.lessonName}
            </AppText>
          </View>

          {data.lessonDescription && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-1"
              >
                Description
              </AppText>
              <AppText className="text-neutral-500 dark:text-neutral-400 text-justify leading-relaxed">
                {data.lessonDescription}
              </AppText>
            </View>
          )}

          <View className="gap-2">
            <AppText
              weight="semibold"
              className="text-base text-neutral-900 dark:text-neutral-100 mb-1"
            >
              Attachments
            </AppText>
            {(data.lessonFile || data.lessonUrl) && <FileRenderer url={data} />}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

const LessonScreenSkeleton = () => (
  <Screen className="bg-white dark:bg-neutral-900">
    <View className="gap-6 w-full max-w-3xl mx-auto p-4">
      <View>
        <Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton className="h-6 w-3/4 rounded-full mt-2" />
      </View>
      <View className="gap-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-2/3 rounded-full" />
      </View>
      <View className="gap-2">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </View>
    </View>
  </Screen>
);

export default LessonScreen;
