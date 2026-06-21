import React, { ComponentType, useCallback, useMemo, useState } from "react";
import { useGlobalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, type FlatListProps, View } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import { useAssessments } from "@/features/oversight/oversight.hooks";
import { Skeleton } from "heroui-native";
import { Assessment } from "@/features/oversight/oversight.type";
import CourseworkItem from "@/features/oversight/components/Coursework";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { RefreshIndicator } from "@/components/RefreshIndicator";

type CourseworkListProps = {
  ListComponent?: ComponentType<FlatListProps<Assessment>>;
};

const CourseworkList = ({ ListComponent = FlatList }: CourseworkListProps) => {
  const safeBottom = useScrollBottomInset();
  const { classroomId } = useGlobalSearchParams();

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
  } = useAssessments(classroomId as string, true);

  const assessments = useMemo(() => {
    // Sort by id desc so the most recently created activity lands at
    // the top of the list. The backend's pagination order isn't
    // guaranteed to be newest-first, and waiting on a query-param fix
    // costs nothing here — the merged page list is short.
    const all = data?.pages.flatMap((page) => page.results) ?? [];
    return [...all].sort((a, b) => Number(b.id) - Number(a.id));
  }, [data]);

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

  // Local flag synchronously bumped when the user taps "Try again" —
  // guarantees a skeleton render frame regardless of how the underlying
  // query's `isFetching` toggling lines up with React's batching on the
  // retry-from-error path. `isFetching` alone would be enough in
  // theory; this just makes it bulletproof in practice.
  const [retrying, setRetrying] = useState(false);
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await refetch();
    } finally {
      setRetrying(false);
    }
  }, [refetch]);

  if (isError)
    return (
      <ErrorFallback
        message={getApiErrorMessage(error)}
        onRefetch={handleRetry}
      />
    );

  // Skeleton + empty fallback live inside the FlatList so they receive
  // the collapsible-tab-view library's auto-injected tab-bar offset.
  const showSkeleton =
    assessments.length === 0 &&
    (isLoading || retrying || (isFetching && !isFetchingNextPage));
  const showEmpty =
    !isLoading && !isFetching && !retrying && assessments.length === 0;

  return (
    <View className="flex-1 bg-background">
      <ListComponent
        data={assessments}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          showSkeleton ? (
            <AssessmentSkeleton />
          ) : (
            <View style={{ height: 10 }} />
          )
        }
        ListEmptyComponent={
          showEmpty ? (
            <NoDataFallback
              icon="SmileySad"
              title="No coursework found"
              onRefetch={refetch}
            />
          ) : null
        }
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
        refreshControl={
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: safeBottom + 8,
        }}
      />
    </View>
  );
};

const AssessmentSkeleton = () => {
  // Width permutations keep the skeleton from looking like a stack of
  // identical bars while still mirroring the title-then-meta hierarchy
  // of a real CourseworkItem row.
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-4/5", "w-1/2"] as const;
  return (
    <View style={{ paddingTop: 10 }}>
      {widths.map((titleWidth, index) => (
        <View key={index} className="w-full max-w-3xl mx-auto px-2.5 mb-1">
          <View className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <View className="flex-1">
              <Skeleton className={`h-[18px] ${titleWidth} rounded`} />
              <View style={{ height: 2 }} />
              <Skeleton className="h-[14px] w-44 rounded" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export default CourseworkList;
