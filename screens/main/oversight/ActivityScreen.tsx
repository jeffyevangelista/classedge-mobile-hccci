import { AppText } from "@/components/AppText";
import FileRenderer from "@/components/FileRenderer";
import { useAssessment } from "@/features/oversight/oversight.hooks";
import { useFormattedDate } from "@/hooks/userFormattedDate";
import { useLocalSearchParams } from "expo-router";
import { Skeleton } from "heroui-native";
import { View } from "react-native";
import { RefreshControl, ScrollView } from "react-native-gesture-handler";

const ActivityScreen = () => {
  const { activityId } = useLocalSearchParams();
  const { isLoading, isError, error, data, refetch, isRefetching } =
    useAssessment(activityId as string);

  if (isLoading)
    return (
      <LoadingComponent isRefetching={isLoading} refetch={() => refetch()} />
    );

  if (isError) return <AppText>{error.message}</AppText>;

  if (!data) return <AppText>No data found</AppText>;

  const ongoing = data.ongoing_attempt;
  const isPastDue = data.end_time
    ? new Date(data.end_time) < new Date()
    : false;
  const isOutOfAttempts = data.remaining_attempts === 0;

  let actionButton = null;

  return (
    <View className="flex-1 w-full max-w-3xl mx-auto">
      <ScrollView
        className="pb-24"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          <AppText>Due {useFormattedDate(data.end_time, true)} </AppText>
          <AppText>
            {data.activity_type_name}: {data?.activity_name}
          </AppText>

          <AppText>
            {data.max_score} Points • {data.time_duration} Minutes
          </AppText>

          {data.activity_instruction && (
            <View className="mt-5">
              <AppText>Instructions</AppText>
              <AppText className="text-typography-500 text-justify">
                {data.activity_instruction}
              </AppText>
            </View>
          )}
          <View className="mt-5">
            <AppText>Materials</AppText>
            {data.lesson_urls.length > 0 ? (
              data.lesson_urls.map((url) => (
                <FileRenderer url={url} key={url.id} />
              ))
            ) : (
              <AppText className="text-typography-400">
                No materials available
              </AppText>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const LoadingComponent = ({
  isRefetching,
  refetch,
}: {
  isRefetching: boolean;
  refetch: () => void;
}) => {
  return (
    <View className="flex-1 w-full max-w-3xl mx-auto">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className=" w-full max-w-3xl mx-auto flex-1 gap-10">
          <View className="gap-2">
            <Skeleton className="rounded-full h-3 w-40" />
            <Skeleton className="rounded-full h-6" />
            <Skeleton className="rounded-full h-3 w-20" />
          </View>
          <Skeleton className="rounded-full h-4" />

          <View className="gap-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="rounded full h-16" />
            <Skeleton className="rounded full h-16" />
            <Skeleton className="rounded full h-16" />
            <Skeleton className="rounded full h-16" />
          </View>
        </View>
      </ScrollView>
      <View className="bg-[#f9f9f9] absolute bottom-0 left-0 right-0 z-10 p-4">
        <Skeleton className="h-12 w-full max-w-3xl mx-auto rounded-full" />
      </View>
    </View>
  );
};

export default ActivityScreen;
