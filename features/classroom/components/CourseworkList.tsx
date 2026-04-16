import React, { useCallback, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, View } from "react-native";
import { useAssessments } from "@/features/oversight/oversight.hooks";
import { Card, Skeleton } from "heroui-native";
import { Assessment } from "@/features/oversight/oversight.type";
import CourseworkItem from "@/features/oversight/components/Coursework";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const CONTENT_CONTAINER_STYLE = { paddingTop: 16 } as const;

const CourseworkList = () => {
  const { classroomId } = useLocalSearchParams();

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useAssessments(classroomId as string, true);

  if (isLoading) return <AssessmentSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  const assessments = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const keyExtractor = useCallback(
    (item: Assessment) => item.id.toString(),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: Assessment }) => <CourseworkItem {...item} />,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!isLoading && assessments.length === 0)
    return (
      <NoDataFallback
        icon="SmileySad"
        title="No coursework found"
        onRefetch={refetch}
      />
    );

  console.log(assessments);

  return (
    <View className="flex-1">
      <FlatList
        data={assessments}
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

const AssessmentSkeleton = () => {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <Card
          key={index}
          className="shadow-none rounded-xl mt-2.5 flex-row max-w-3xl mx-auto w-full gap-2.5 items-center dark:bg-neutral-800/50"
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

export default CourseworkList;
