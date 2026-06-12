import React, { useCallback, useMemo } from "react";
import { useGlobalSearchParams } from "expo-router";
import { useStudents } from "@/features/oversight/oversight.hooks";
import { ActivityIndicator, View, FlatList } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import { AppText } from "@/components/AppText";
import { Avatar, Card, Skeleton } from "heroui-native";
import { Student } from "@/features/oversight/oversight.type";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { toTitleCase } from "@/utils/toTitleCase";

const CONTENT_CONTAINER_STYLE = { paddingTop: 16 } as const;

const StudentList = () => {
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
  } = useStudents(classroomId as string);

  const students = useMemo(
    () =>
      data?.pages.flatMap((page) =>
        Array.isArray(page) ? page : (page.results ?? []),
      ) ?? [],
    [data],
  );

  const keyExtractor = useCallback((item: Student) => item.id.toString(), []);

  const renderItem = useCallback(
    ({ item }: { item: Student }) => <StudentItem {...item} />,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const safeBottom = useScrollBottomInset();

  // Render the skeleton any time a fetch is in flight and we have
  // nothing to show — see features/classroom/components/LessonList for
  // the full rationale.
  if (
    students.length === 0 &&
    (isLoading || (isFetching && !isFetchingNextPage))
  )
    return <StudentsSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  if (!isLoading && students.length === 0)
    return (
      <NoDataFallback
        icon="SmileySad"
        title="No students found"
        onRefetch={refetch}
      />
    );

  return (
    <FlatList
      data={students}
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
      contentContainerStyle={CONTENT_CONTAINER_STYLE}
      style={{ marginBottom: safeBottom }}
    />
  );
};

const StudentItem = React.memo(({ name, studentPhoto }: Student) => {
  const displayName = name ? toTitleCase(name) : "Unknown student";
  return (
    <Card className="shadow-none rounded-xl mt-2.5 w-full max-w-3xl mx-auto">
      <View className="flex-row gap-2 items-center">
        <Avatar alt={displayName} size="sm">
          <AttachmentAvatarImage path={studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>
        <AppText className="text-neutral-900 dark:text-neutral-100 font-poppins-regular text-lg flex-1">
          {displayName}
        </AppText>
      </View>
    </Card>
  );
});
StudentItem.displayName = "StudentItem";

const StudentsSkeleton = () => {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <Card
          key={index}
          className="shadow-none rounded-xl mt-2.5 w-full max-w-3xl mx-auto"
        >
          <View className="flex-row gap-2 items-center">
            <Skeleton className="rounded-full h-8 w-8" />
            <Skeleton className="h-4 flex-1 rounded-full" />
          </View>
        </Card>
      ))}
    </>
  );
};

export default StudentList;
