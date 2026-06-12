import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import { Lesson } from "@/features/oversight/oversight.type";
import { formatDate } from "@/utils/formatDate";
import { Link, useGlobalSearchParams } from "expo-router";
import { useLessons } from "@/features/oversight/oversight.hooks";
import { Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";

// All material rows render with a single book icon (matches the
// CourseTimeline materials convention). The meta line only prefixes
// the date for non-default types (Link, Embedded) — the generic
// "Document" label is dropped to keep ordinary materials uncluttered.
const labelForLessonType = (lessonType: string): string | null => {
  if (lessonType === "external_link") return "Link";
  if (lessonType === "embedded_content") return "Embedded";
  return null;
};

const LessonList = () => {
  const safeBottom = useScrollBottomInset();
  const { classroomId } = useGlobalSearchParams();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    isFetching,
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

  // Render the skeleton any time a fetch is in flight and we have
  // nothing to show — that covers the initial mount AND retries from
  // the error state. We key off `isFetching` rather than
  // `isRefetching` because `keepPreviousData` makes `isRefetching` /
  // `data === undefined` unreliable in the post-error retry path.
  // `isFetchingNextPage` is excluded so paginating an already-rendered
  // list doesn't wipe the screen.
  if (
    materials.length === 0 &&
    (isLoading || (isFetching && !isFetchingNextPage))
  )
    return <MaterialsSkeleton />;
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
        // Padding lives on the scroll content (not on a static wrapper)
        // so the top gap scrolls away with the first card — the tab bar
        // ends up flush against the list edge on scroll for a cleaner
        // read. `paddingBottom` includes the safe-area inset so the last
        // card clears the home indicator while remaining scrollable.
        contentContainerStyle={{ paddingTop: 10, paddingBottom: safeBottom + 8 }}
      />
    </View>
  );
};

const MaterialItem = React.memo(
  ({ id, lessonName, lessonType, startDate }: Lesson) => {
    const label = labelForLessonType(lessonType);
    const formattedDate = formatDate(startDate);

    return (
      <Link href={`/lesson/${id}`} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            label ? `Open ${label}: ${lessonName}` : `Open ${lessonName}`
          }
          android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
          className="w-full max-w-3xl mx-auto mb-2 px-3 active:opacity-80"
        >
          <View className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3">
            <View className="w-10 h-10 rounded-full items-center justify-center bg-surface-secondary">
              <Icon
                name="BookOpenTextIcon"
                size={18}
                className="text-muted"
              />
            </View>
            <View className="flex-1 min-w-0">
              <AppText
                weight="semibold"
                className="text-[15px] text-foreground"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {lessonName}
              </AppText>
              <AppText
                className="text-[11px] text-muted mt-0.5"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label ? `${label} · ` : ""}Posted {formattedDate}
              </AppText>
            </View>
          </View>
        </Pressable>
      </Link>
    );
  },
);
MaterialItem.displayName = "MaterialItem";

const MaterialsSkeleton = () => {
  // Width permutations keep the skeleton from looking like a stack of
  // identical bars while still mirroring the title-then-meta hierarchy
  // of a real row.
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-4/5", "w-1/2"] as const;
  return (
    <View style={{ paddingTop: 10 }}>
      {widths.map((titleWidth, index) => (
        <View key={index} className="w-full max-w-3xl mx-auto px-3 mb-2">
          <View className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <View className="flex-1">
              <Skeleton className={`h-[18px] ${titleWidth} rounded`} />
              <View style={{ height: 2 }} />
              <Skeleton className="h-[14px] w-28 rounded" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export default LessonList;
