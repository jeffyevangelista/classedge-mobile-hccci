import React, { useCallback, useMemo, useState } from "react";
import { useGlobalSearchParams } from "expo-router";
import { useStudents } from "../oversight.hooks";
import { ActivityIndicator, Pressable, View, FlatList } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import { AppText } from "@/components/AppText";
import { Avatar, Card, Skeleton } from "heroui-native";
import { Student } from "../oversight.type";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { StudentSearchBar } from "@/features/classroom/components/StudentSearchBar";
import { Icon } from "@/components/Icon";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { toTitleCase } from "@/utils/toTitleCase";

const StudentList = () => {
  const params = useGlobalSearchParams<{ subjectId?: string | string[] }>();
  const subjectIdParam = Array.isArray(params.subjectId)
    ? params.subjectId[0]
    : params.subjectId;
  const subjectId = subjectIdParam ?? "";

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
  } = useStudents(subjectId);

  const [searchQuery, setSearchQuery] = useState("");

  const students = useMemo(() => {
    const pages = data?.pages;
    if (!Array.isArray(pages)) return [] as Student[];
    return pages.flatMap((page) => {
      if (!page) return [] as Student[];
      if (Array.isArray(page)) return page as Student[];
      const results = (page as { results?: Student[] }).results;
      return Array.isArray(results) ? results : ([] as Student[]);
    });
  }, [data]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => (s.name ?? "").toLowerCase().includes(q));
  }, [students, searchQuery]);

  const keyExtractor = useCallback((item: Student) => item.id.toString(), []);

  const renderItem = useCallback(
    ({ item }: { item: Student }) => <StudentItem {...item} />,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const safeBottom = useScrollBottomInset();

  if (!subjectId) return <StudentsSkeleton />;
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

  const hasQuery = searchQuery.trim().length > 0;
  const isEmptySearch = hasQuery && filteredStudents.length === 0;

  return (
    <FlatList
      data={isEmptySearch ? [] : filteredStudents}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={
        <View className="w-full max-w-3xl mx-auto px-2.5">
          <StudentSearchBar value={searchQuery} onChange={setSearchQuery} />
        </View>
      }
      ListEmptyComponent={
        isEmptySearch ? (
          <View className="w-full max-w-3xl mx-auto px-2.5 items-center mt-8">
            <Icon name="MagnifyingGlass" size={32} color="#9ca3af" />
            <AppText className="text-sm text-muted-foreground mt-2 text-center">
              No students match &ldquo;{searchQuery.trim()}&rdquo;
            </AppText>
            <Pressable onPress={() => setSearchQuery("")} className="mt-3">
              <AppText weight="semibold" className="text-sm text-accent">
                Clear search
              </AppText>
            </Pressable>
          </View>
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
      style={{ marginBottom: safeBottom }}
    />
  );
};

const StudentItem = React.memo(({ name, studentPhoto }: Student) => {
  const displayName = name ? toTitleCase(name) : "Unknown student";
  return (
    <View className="w-full max-w-3xl mx-auto mb-2.5 px-2.5">
      <Card className="rounded-xl flex-row items-center gap-3 shadow-none">
        <Avatar alt={displayName} size="sm">
          <AttachmentAvatarImage path={studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>
        <AppText
          weight="semibold"
          className="text-lg flex-1"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayName}
        </AppText>
      </Card>
    </View>
  );
});
StudentItem.displayName = "StudentItem";

const StudentsSkeleton = () => {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <View key={index} className="w-full max-w-3xl mx-auto px-2.5 mb-2.5">
          <Card className="shadow-none rounded-xl flex-row gap-2.5 items-center">
            <Skeleton className="rounded-full h-8 w-8" />
            <Skeleton className="h-4 flex-1 rounded-full" />
          </Card>
        </View>
      ))}
    </>
  );
};

export default StudentList;
