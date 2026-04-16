import { AppText } from "@/components/AppText";
import FileRenderer from "@/components/FileRenderer";
import { useAssessment } from "@/features/oversight/oversight.hooks";
import { useFormattedDate } from "@/hooks/userFormattedDate";
import { useLocalSearchParams } from "expo-router";
import { Skeleton } from "heroui-native";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
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

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  if (!data)
    return (
      <NoDataFallback
        title="Activity not found"
        description="The activity you're looking for doesn't exist"
        onRefetch={() => refetch()}
      />
    );

  const ongoing = data.ongoingAttempt;
  const isPastDue = data.endTime ? new Date(data.endTime) < new Date() : false;
  const isOutOfAttempts = data.remainingAttempts === 0;

  let actionButton = null;

  return (
    <View className="flex-1 w-full max-w-3xl mx-auto bg-white dark:bg-neutral-900">
      <ScrollView
        className="pb-24"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          <AppText className="text-sm text-neutral-500 dark:text-neutral-400">
            Due {useFormattedDate(data.endTime, true)}
          </AppText>
          <AppText
            weight="semibold"
            className="text-xl text-neutral-900 dark:text-neutral-100 mt-1"
          >
            {data.activityTypeName}: {data?.activityName}
          </AppText>

          <AppText className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {data.maxScore} Points • {data.timeDuration} Minutes
          </AppText>

          {data.activityInstruction && (
            <View className="mt-5">
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-1"
              >
                Instructions
              </AppText>
              <AppText className="text-neutral-500 dark:text-neutral-400 text-justify leading-relaxed">
                {data.activityInstruction}
              </AppText>
            </View>
          )}
          <View className="mt-5">
            <AppText
              weight="semibold"
              className="text-base text-neutral-900 dark:text-neutral-100 mb-1"
            >
              Materials
            </AppText>
            {data.lessonUrls.length > 0 ? (
              data.lessonUrls.map((url) => (
                <FileRenderer url={url} key={url.id} />
              ))
            ) : (
              <AppText className="text-neutral-400 dark:text-neutral-500">
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
    <View className="flex-1 w-full max-w-3xl mx-auto p-2.5 bg-white dark:bg-neutral-900">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-3xl mx-auto flex-1 gap-10">
          <View className="gap-2">
            <Skeleton className="rounded-full h-3 w-40" />
            <Skeleton className="rounded-full h-6" />
            <Skeleton className="rounded-full h-3 w-20" />
          </View>
          <Skeleton className="rounded-full h-4" />
          <View className="gap-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="rounded-full h-16" />
            <Skeleton className="rounded-full h-16" />
            <Skeleton className="rounded-full h-16" />
            <Skeleton className="rounded-full h-16" />
          </View>
        </View>
      </ScrollView>
      <View className="bg-neutral-50 dark:bg-neutral-800 absolute bottom-0 left-0 right-0 z-10 p-4">
        <Skeleton className="h-12 w-full max-w-3xl mx-auto rounded-full" />
      </View>
    </View>
  );
};

export default ActivityScreen;
