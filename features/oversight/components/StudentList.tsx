import React, { useCallback, useMemo } from "react";
import { useGlobalSearchParams } from "expo-router";
import { useStudents } from "../oversight.hooks";
import { ActivityIndicator, FlatList, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Avatar, Card, Skeleton } from "heroui-native";
import { Student } from "../oversight.type";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";

const CONTENT_CONTAINER_STYLE = { paddingTop: 16 } as const;

const StudentList = () => {
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
  } = useStudents(subjectId as string);

  if (isLoading) return <StudentsSkeleton />;
  if (isError)
    return <ErrorFallback message={error.message} onRefetch={refetch} />;

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
      refreshing={isRefetching}
      onRefresh={refetch}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      contentContainerStyle={CONTENT_CONTAINER_STYLE}
    />
  );
};

const StudentItem = React.memo(({ name, student_photo }: Student) => {
  return (
    <Card className="shadow-none rounded-xl mt-2.5 w-full max-w-3xl mx-auto dark:bg-neutral-800/50">
      <View className="flex-row gap-2 items-center">
        <Avatar alt="student-photo" size="sm">
          <Avatar.Fallback>{name.split(" ")[0][0]}</Avatar.Fallback>
          <Avatar.Image
            source={{
              uri: student_photo,
            }}
          />
        </Avatar>
        <AppText className="text-neutral-900 dark:text-neutral-100 text-lg flex-1">
          {name}
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
