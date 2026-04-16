import { View, ScrollView, Image } from "react-native";
import { useCourseMaterial } from "@/features/courses/courses.hooks";
import { useLocalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { Skeleton } from "heroui-native";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { env } from "@/utils/env";
import { getApiErrorMessage } from "@/lib/api-error";

const MaterialDetailsScreen = () => {
  const { materialId } = useLocalSearchParams();
  const { data, isLoading, isError, error } = useCourseMaterial(
    materialId as string,
  );

  if (isLoading) return <MaterialDetailsSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;
  if (!data)
    return (
      <NoDataFallback
        title="Material not found"
        description="The material you're looking for doesn't exist"
      />
    );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Screen className="bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-6 w-full max-w-3xl mx-auto p-4">
          <View>
            <AppText className="text-sm text-neutral-500 dark:text-neutral-400">
              {formatDate(data.startDate)} – {formatDate(data.endDate)}
            </AppText>
            <AppText
              weight="semibold"
              className="text-xl text-neutral-900 dark:text-neutral-100 mt-1"
            >
              {data.fileName}
            </AppText>
          </View>

          {data.description && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-1"
              >
                Description
              </AppText>
              <AppText className="text-neutral-500 dark:text-neutral-400 text-justify leading-relaxed">
                {data.description}
              </AppText>
            </View>
          )}

          {data.file && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-2"
              >
                Attached File
              </AppText>
              <Image
                source={{
                  uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${data.file}`,
                }}
                style={{ width: "100%", height: 300, borderRadius: 8 }}
                resizeMode="contain"
              />
            </View>
          )}

          {data.url && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-1"
              >
                URL
              </AppText>
              <AppText className="text-primary">{data.url}</AppText>
            </View>
          )}

          {data.iframeCode && (
            <View>
              <AppText
                weight="semibold"
                className="text-base text-neutral-900 dark:text-neutral-100 mb-1"
              >
                Embedded Content
              </AppText>
              <AppText className="text-neutral-500 dark:text-neutral-400">
                Iframe content available
              </AppText>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
};

const MaterialDetailsSkeleton = () => (
  <Screen className="bg-white dark:bg-neutral-900">
    <View className="gap-6 w-full max-w-3xl mx-auto p-4">
      <View>
        <Skeleton className="h-3 w-40 rounded-full" />
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
        <Skeleton className="h-64 w-full rounded-xl" />
      </View>
    </View>
  </Screen>
);

export default MaterialDetailsScreen;
