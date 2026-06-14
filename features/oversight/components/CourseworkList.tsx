import React, { useCallback, useMemo } from "react";
import { useGlobalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, View } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import { useAssessments } from "../oversight.hooks";
import { AppText } from "@/components/AppText";
import { Card, Skeleton } from "heroui-native";
import { Assessment } from "../oversight.type";
import CourseworkItem from "./Coursework";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { RefreshIndicator } from "@/components/RefreshIndicator";

const CourseworkList = () => {
  const safeBottom = useScrollBottomInset();
  const { subjectId } = useGlobalSearchParams();

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
    isFetching,
  } = useAssessments(subjectId as string, true);

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

  // Render the skeleton any time a fetch is in flight and we have
  // nothing to show — see features/classroom/components/LessonList for
  // the full rationale.
  if (
    assessments.length === 0 &&
    (isLoading || (isFetching && !isFetchingNextPage))
  )
    return <AssessmentSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  if (!isLoading && assessments.length === 0)
    return (
      <NoDataFallback
        icon="SmileySad"
        title="No coursework found"
        onRefetch={refetch}
      />
    );

  return (
    <FlatList
      data={assessments}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
      refreshControl={
        <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      style={{ marginBottom: safeBottom }}
    />
  );
};

const AssessmentSkeleton = () => {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} className="w-full max-w-3xl mx-auto px-2.5 mb-1">
          <Card className="shadow-none rounded-xl flex-row gap-2.5 items-center">
            <View className="flex-row gap-1 flex-1">
              <Skeleton className="rounded-md h-16 w-16" />
              <View className="flex-1 gap-2">
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

export default CourseworkList;
