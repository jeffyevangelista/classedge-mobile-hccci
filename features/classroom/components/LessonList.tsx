import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { Lesson } from "@/features/oversight/oversight.type";
import { formatDate } from "@/utils/formatDate";
import { Link, useGlobalSearchParams } from "expo-router";
import { useLessons } from "@/features/oversight/oversight.hooks";
import { Card, Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const LESSON_ICON_MAP = {
  document: { label: "Material" },
  external_link: { label: "Link" },
  embedded_content: { label: "Sway" },
} as const;

const getLessonIcon = (lessonType: string) =>
  LESSON_ICON_MAP[lessonType as keyof typeof LESSON_ICON_MAP] ??
  LESSON_ICON_MAP.document;

const LessonList = () => {
  const { classroomId } = useGlobalSearchParams();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useLessons(classroomId as string);

  const materials = useMemo(() => {
    const all = data?.pages.flatMap((page) => page.results) ?? [];
    const seen = new Set<number>();
    return all.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [data]);

  const keyExtractor = useCallback((item: Lesson) => item.id.toString(), []);

  const renderItem = useCallback(
    ({ item }: { item: Lesson }) => <MaterialItem {...item} />,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading && !data) return <MaterialsSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  if (!isLoading && materials.length === 0)
    return (
      <NoDataFallback
        icon="SmileySad"
        title="No Materials found"
        onRefetch={refetch}
      />
    );

  return (
    <View className="flex-1">
      <FlatList
        data={materials}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
        refreshing={isRefetching}
        onRefresh={refetch}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      />
    </View>
  );
};

const MATERIAL_ICON_COLOR = "#10b981";

const MaterialItem = React.memo(
  ({ id, lessonName, lessonType, startDate }: Lesson) => {
    const { label } = getLessonIcon(lessonType);
    const formattedDate = formatDate(startDate);

    return (
      <Link
        className="w-full max-w-3xl mx-auto mb-2.5 px-2.5"
        href={`/lesson/${id}`}
      >
        <Card className="rounded-xl flex-row items-center gap-3 shadow-none">
          <View className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <Icon
              name="BookOpenTextIcon"
              size={24}
              color={MATERIAL_ICON_COLOR}
            />
          </View>
          <View className="flex-1">
            <AppText
              weight="semibold"
              className="text-lg"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label}: {lessonName}
            </AppText>
            <AppText
              className="text-xs text-muted"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Posted {formattedDate}
            </AppText>
          </View>
        </Card>
      </Link>
    );
  },
);
MaterialItem.displayName = "MaterialItem";

const MaterialsSkeleton = () => {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} className="w-full max-w-3xl mx-auto px-2.5 mb-2.5">
          <Card className="shadow-none rounded-xl flex-row gap-2.5 items-center">
            <View className="gap-2 flex-row flex-1">
              <Skeleton className="rounded-md h-16 w-16" />
              <View className="flex-1 gap-1">
                <Skeleton className="h-5 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </View>
            </View>
          </Card>
        </View>
      ))}
    </>
  );
};

export default LessonList;
