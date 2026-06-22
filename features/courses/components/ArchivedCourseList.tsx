import { router } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { ActivityIndicator, Pressable, SectionList, View } from "react-native";
import { AppText } from "@/components/AppText";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { useArchivedCourses } from "../archive.hooks";
import type { ArchivedCourse } from "../archive.types";

const ArchivedCourseList = () => {
  const { isConnected, isInternetReachable } = useStore();
  const isOffline = !isConnected || !isInternetReachable;
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useArchivedCourses();
  const mutedColor = useThemeColor("muted");

  if (isError) {
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );
  }
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const groups = (data?.pages ?? []).flatMap((p) => p.results);
  const totalCourses = groups.reduce((n, g) => n + g.courses.length, 0);

  if (totalCourses === 0) {
    if (isOffline) return <OfflineEmpty section="courses" />;
    return (
      <EmptyState
        icon="BookOpenIcon"
        title="No archived courses"
        description="Past semester courses will appear here."
      />
    );
  }

  const sections = groups.map((g) => ({
    title: g.semester.name,
    data: g.courses,
  }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => `arc-${item.id}`}
      onRefresh={refetch}
      refreshing={isRefetching}
      onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
      }
      renderSectionHeader={({ section }) => (
        <View className="px-4 py-2 bg-background">
          <AppText weight="semibold" className="text-base text-foreground">
            {section.title}
          </AppText>
        </View>
      )}
      renderItem={({ item }) => (
        <ArchivedRow item={item} mutedColor={mutedColor} />
      )}
    />
  );
};

const useArchivedRoute = () => {
  const { authUser } = useStore();
  return (item: ArchivedCourse) => {
    if (authUser?.role === "Student" && item.enrollmentId != null) {
      return `/course/${item.enrollmentId}` as const;
    }
    return `/subject/${item.id}` as const;
  };
};

const ArchivedRow = ({
  item,
  mutedColor,
}: {
  item: ArchivedCourse;
  mutedColor: string;
}) => {
  const resolveRoute = useArchivedRoute();
  return (
    <View className="px-2 py-1">
      <Pressable
        onPress={() => router.push(resolveRoute(item))}
        className="active:opacity-80 rounded-xl overflow-hidden"
      >
        <Card className="p-0 shadow-none rounded-xl border border-border">
          <Card.Body className="gap-2.5">
            <AttachmentImage
              path={item.subjectPhoto}
              fallback={
                <Image
                  source={require("@/assets/placeholder/bg-placeholder.png")}
                  className="rounded-t-xl w-full aspect-video"
                  contentFit="cover"
                />
              }
              className="rounded-t-xl w-full aspect-video"
              contentFit="cover"
              cachePolicy="disk"
            />
            <View className="px-4 pb-4 gap-1">
              <AppText
                weight="semibold"
                className="text-base leading-6"
                numberOfLines={2}
              >
                {item.subjectName}
              </AppText>
              <View className="flex-row items-center gap-1.5">
                <Icon name="MapPinIcon" size={14} color={mutedColor} />
                <AppText
                  numberOfLines={1}
                  className="text-xs text-muted flex-1"
                >
                  {item.roomNumber || "TBA"}
                </AppText>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Icon
                  name="ChalkboardTeacherIcon"
                  size={14}
                  color={mutedColor}
                />
                <AppText
                  numberOfLines={1}
                  className="text-xs text-muted flex-1"
                >
                  {item.teacherName || "Unassigned"}
                </AppText>
              </View>
            </View>
          </Card.Body>
        </Card>
      </Pressable>
    </View>
  );
};

export default ArchivedCourseList;
