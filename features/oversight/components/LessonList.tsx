import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { Lesson } from "../oversight.type";
import { useFormattedDate } from "@/hooks/userFormattedDate";
import { Link, useGlobalSearchParams } from "expo-router";
import { useLessons } from "../oversight.hooks";
import { Card, Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";

const CONTENT_CONTAINER_STYLE = { paddingTop: 16 } as const;

const LESSON_ICON_MAP = {
  document: { label: "Material" },
  external_link: { label: "Link" },
  embedded_content: { label: "Sway" },
} as const;

const getLessonIcon = (lessonType: string) =>
  LESSON_ICON_MAP[lessonType as keyof typeof LESSON_ICON_MAP] ??
  LESSON_ICON_MAP.document;

const MaterialList = () => {
  const { subjectId } = useGlobalSearchParams();

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
  } = useLessons(subjectId as string);

  if (isLoading && !data) return <MaterialsSkeleton />;
  if (isError)
    return <ErrorFallback message={error.message} onRefetch={refetch} />;

  const materials = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const keyExtractor = useCallback((item: Lesson) => item.id.toString(), []);

  const renderItem = useCallback(
    ({ item }: { item: Lesson }) => <MaterialItem {...item} />,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
        contentContainerStyle={CONTENT_CONTAINER_STYLE}
      />
    </View>
  );
};

const MaterialItem = React.memo(
  ({ id, lesson_name, lesson_type, start_date }: Lesson) => {
    const { label } = getLessonIcon(lesson_type);
    const formattedDate = useFormattedDate(start_date);

    return (
      <Link className="max-w-3xl mx-auto w-full mt-2.5" href={`/lesson/${id}`}>
        <Card className="shadow-none rounded-lg flex-row items-center dark:bg-neutral-800/50">
          <View className="flex-row gap-2 flex-1">
            <View className="p-2.5 bg-purple-50 dark:bg-purple-900/50 rounded-full">
              <Icon
                name="BookOpenTextIcon"
                className="text-purple-600 dark:text-purple-400"
              />
            </View>

            <View className="flex-1">
              <AppText
                className="text-neutral-900 dark:text-neutral-100 font-poppins-semibold text-lg flex-1"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}: {lesson_name}
              </AppText>
              <AppText
                className="text-neutral-500 dark:text-neutral-400 text-xs"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Posted {formattedDate}
              </AppText>
            </View>
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
        <Card
          key={index}
          className="shadow-none rounded-lg mt-2.5 flex-row max-w-3xl mx-auto w-full gap-2.5 items-center"
        >
          <View className="gap-2 flex-row flex-1">
            <Skeleton className="rounded-md h-16 w-16" />

            <View className="flex-1 gap-1">
              <Skeleton className="h-5 rounded-full" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
};

export default MaterialList;
