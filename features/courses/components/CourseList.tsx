import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import { ScreenList } from "@/components/ScreenList";
import { router } from "expo-router";
import {
  Button,
  Card,
  InputGroup,
  Skeleton,
  useThemeColor,
} from "heroui-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import {
  useCoursePendingCounts,
  useStudentCourses,
  type CoursePendingCount,
} from "../courses.hooks";
import { StudentEnrolledCourses } from "../courses.types";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { toTitleCase } from "@/utils/toTitleCase";

const MIN_CARD_WIDTH = 280;

type SortMode = "asc" | "desc";

const CourseList = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { authUser } = useStore();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useStudentCourses();
  const pendingCounts = useCoursePendingCounts(authUser?.id);

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("asc");

  const visible = useMemo(() => {
    const list = data ?? [];
    const filtered = search.trim()
      ? list.filter((c) =>
          c.subjectId.subjectName
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
      : list;
    const direction = sortMode === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) =>
        direction *
        a.subjectId.subjectName.localeCompare(b.subjectId.subjectName),
    );
  }, [data, search, sortMode]);

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <SectionView status={status}>
      <SectionView.Loading>
        <CourseListSkeleton numColumns={numColumns} />
      </SectionView.Loading>
      <SectionView.Empty>
        <View className="w-full max-w-6xl mx-auto flex-1">
          <CourseListToolbar
            search={search}
            onSearchChange={setSearch}
            sortMode={sortMode}
            onSortChange={setSortMode}
          />
          <EmptyState
            icon="BookOpenIcon"
            title="No courses found"
            description="You are not enrolled in any courses yet"
          />
        </View>
      </SectionView.Empty>
      <SectionView.OfflineEmpty>
        <OfflineEmpty section="courses" />
      </SectionView.OfflineEmpty>
      <SectionView.Ready>
        <View className="w-full max-w-6xl mx-auto flex-1">
          <CourseListToolbar
            search={search}
            onSearchChange={setSearch}
            sortMode={sortMode}
            onSortChange={setSortMode}
          />
          <ScreenList
            refreshControl={
              <RefreshIndicator
                refreshing={isRefetching}
                onRefresh={refetch}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="BookOpenIcon"
                title="No matching courses"
                description="Try a different search term"
              />
            }
            key={numColumns}
            numColumns={numColumns}
            data={visible}
            className="p-1"
            renderItem={({ item }) => (
              <Course
                item={item}
                numColumns={numColumns}
                counts={pendingCounts.get(item.subjectId.id)}
              />
            )}
          />
        </View>
      </SectionView.Ready>
    </SectionView>
  );
};

const CourseListToolbar = ({
  search,
  onSearchChange,
  sortMode,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}) => {
  const mutedColor = useThemeColor("muted");
  const toggle = () => onSortChange(sortMode === "asc" ? "desc" : "asc");
  return (
    <View className="flex-row items-center gap-2 px-2 pt-2 pb-1">
      <InputGroup className="flex-1 shadow-none">
        <InputGroup.Prefix>
          <Icon name="MagnifyingGlassIcon" size={18} color={mutedColor} />
        </InputGroup.Prefix>
        <InputGroup.Input
          placeholder="Search courses"
          value={search}
          onChangeText={onSearchChange}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search courses"
        />
        {search.length > 0 ? (
          <InputGroup.Suffix>
            <Pressable
              onPress={() => onSearchChange("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              className="active:opacity-60"
            >
              <Icon name="XCircleIcon" size={18} color={mutedColor} />
            </Pressable>
          </InputGroup.Suffix>
        ) : null}
      </InputGroup>
      <Button
        isIconOnly
        variant="outline"
        onPress={toggle}
        className="rounded-2xl"
        accessibilityLabel={`Sort: ${
          sortMode === "asc" ? "A to Z" : "Z to A"
        }. Tap to change.`}
      >
        <Icon
          name={sortMode === "asc" ? "SortAscendingIcon" : "SortDescendingIcon"}
          size={18}
          color={mutedColor}
        />
      </Button>
    </View>
  );
};

const PendingBadge = ({ counts }: { counts?: CoursePendingCount }) => {
  if (!counts) return null;
  const { due, overdue } = counts;
  if (overdue > 0) {
    return (
      <View className="absolute top-2 right-2 bg-danger px-2 py-0.5 rounded-full">
        <AppText className="text-xs text-white" weight="semibold">
          {overdue} overdue
        </AppText>
      </View>
    );
  }
  if (due > 0) {
    return (
      <View className="absolute top-2 right-2 bg-accent px-2 py-0.5 rounded-full">
        <AppText
          className="text-xs text-accent-foreground"
          weight="semibold"
        >
          {due} due
        </AppText>
      </View>
    );
  }
  return null;
};

const Course = ({
  item,
  numColumns,
  counts,
}: {
  item: StudentEnrolledCourses;
  numColumns: number;
  counts?: CoursePendingCount;
}) => {
  const mutedColor = useThemeColor("muted");
  const teacher = item.subjectId.assignTeacherId;
  const teacherName =
    teacher?.firstName || teacher?.lastName
      ? toTitleCase(
          `${teacher?.firstName ?? ""} ${teacher?.lastName ?? ""}`.trim(),
        )
      : "Unassigned";

  return (
    <View style={{ flex: 1 / numColumns, padding: 5 }}>
      <Pressable
        onPress={() => router.push(`/course/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Open course ${item.subjectId.subjectName}, taught by ${teacherName}`}
        android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
        className="active:opacity-80 rounded-xl overflow-hidden"
      >
        <Card className="p-0 shadow-none rounded-xl border border-border">
          <Card.Body className="gap-2.5">
            <View>
              <AttachmentImage
                path={item.subjectId.subjectPhoto}
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
              <PendingBadge counts={counts} />
            </View>
            <View className="px-4 pb-4 gap-2">
              <View className="h-14">
                <AppText
                  numberOfLines={2}
                  weight="semibold"
                  className="text-base leading-6"
                >
                  {item.subjectId.subjectName}
                </AppText>
              </View>
              <View className="gap-1">
                <View className="flex-row items-center gap-1.5">
                  <Icon name="MapPinIcon" size={14} color={mutedColor} />
                  <AppText
                    numberOfLines={1}
                    className="text-xs text-muted flex-1"
                  >
                    {item.subjectId.roomNumber || "TBA"}
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
                    {teacherName}
                  </AppText>
                </View>
              </View>
            </View>
          </Card.Body>
        </Card>
      </Pressable>
    </View>
  );
};

const CourseListSkeleton = ({ numColumns }: { numColumns: number }) => {
  return (
    <View className="w-full max-w-6xl mx-auto flex-1 px-1">
      <ScreenScrollView>
        <View className="px-2 pt-2 pb-1">
          <Skeleton className="h-10 w-full rounded-xl" />
        </View>
        <View className="flex-row flex-wrap">
          {Array(6)
            .fill(0)
            .map((_, index) => (
              <View
                key={index}
                style={{ width: `${100 / numColumns}%`, padding: 10 / 2 }}
              >
                <Card className="p-0 shadow-none rounded-xl border border-border">
                  <Card.Body className="gap-2.5">
                    <Skeleton className="rounded-t-xl w-full aspect-video" />
                    <View className="px-4 pb-4 gap-2">
                      <View className="h-14 justify-start gap-1">
                        <Skeleton className="h-5 w-3/4 rounded" />
                        <Skeleton className="h-5 w-1/2 rounded" />
                      </View>
                      <Skeleton className="h-3 w-1/2 rounded" />
                      <Skeleton className="h-3 w-2/3 rounded" />
                    </View>
                  </Card.Body>
                </Card>
              </View>
            ))}
        </View>
      </ScreenScrollView>
    </View>
  );
};

export default CourseList;
