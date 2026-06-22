import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import { ScreenList } from "@/components/ScreenList";
import { router, useNavigation } from "expo-router";
import {
  Card,
  InputGroup,
  Skeleton,
  useThemeColor,
} from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
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
import SyncCenter from "@/features/sync/components/SyncCenter";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { toTitleCase } from "@/utils/toTitleCase";

const MIN_CARD_WIDTH = 280;

type SortMode = "asc" | "desc";

type CourseListProps = {
  query?: ReturnType<typeof useStudentCourses>;
};

const CourseList = ({ query }: CourseListProps = {}) => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { authUser } = useStore();
  const fallbackQuery = useStudentCourses();
  const { data, isLoading, isError, error, refetch, isRefetching } = query ?? fallbackQuery;
  const pendingCounts = useCoursePendingCounts(authUser?.id);
  const navigation = useNavigation();
  const accentColor = useThemeColor("accent");
  const foregroundColor = useThemeColor("foreground");

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("asc");
  const [searchOpen, setSearchOpen] = useState(false);

  const closeSearch = useCallback(() => {
    setSearch("");
    setSearchOpen(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) setSearch("");
      return !open;
    });
  }, []);

  const toggleSort = useCallback(() => {
    setSortMode((mode) => (mode === "asc" ? "desc" : "asc"));
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View className="flex-row items-center gap-1 pr-1">
          <Pressable
            onPress={toggleSort}
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${
              sortMode === "asc" ? "A to Z" : "Z to A"
            }. Tap to change.`}
            hitSlop={6}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          >
            <Icon
              name={sortMode === "asc" ? "SortAscendingIcon" : "SortDescendingIcon"}
              size={22}
              color={foregroundColor}
            />
          </Pressable>
          <Pressable
            onPress={toggleSearch}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? "Close search" : "Open search"}
            accessibilityState={{ expanded: searchOpen }}
            hitSlop={6}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          >
            <Icon
              name="MagnifyingGlassIcon"
              size={22}
              color={searchOpen ? accentColor : foregroundColor}
            />
          </Pressable>
          <SyncCenter />
        </View>
      ),
    });
  }, [
    navigation,
    toggleSort,
    toggleSearch,
    searchOpen,
    sortMode,
    accentColor,
    foregroundColor,
  ]);

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
          <CollapsibleSearch
            open={searchOpen}
            search={search}
            onSearchChange={setSearch}
            onClose={closeSearch}
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
          <CollapsibleSearch
            open={searchOpen}
            search={search}
            onSearchChange={setSearch}
            onClose={closeSearch}
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

const CollapsibleSearch = ({
  open,
  search,
  onSearchChange,
  onClose,
}: {
  open: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
}) => {
  const mutedColor = useThemeColor("muted");
  if (!open) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutUp.duration(140)}
      className="flex-row items-center gap-2 px-2 pt-2"
    >
      <InputGroup className="flex-1 shadow-none">
        <InputGroup.Prefix>
          <Icon name="MagnifyingGlassIcon" size={18} color={mutedColor} />
        </InputGroup.Prefix>
        <InputGroup.Input
          autoFocus
          placeholder="Search courses"
          value={search}
          onChangeText={onSearchChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search courses"
        />
        <InputGroup.Suffix>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={search ? "Clear and close search" : "Close search"}
            hitSlop={6}
          >
            <Icon name="XIcon" size={18} color={mutedColor} />
          </Pressable>
        </InputGroup.Suffix>
      </InputGroup>
    </Animated.View>
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
    <View style={{ flex: 1 / numColumns, padding: 4 }}>
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
        <View className="px-2 pt-2">
          <Skeleton className="h-10 w-full rounded-xl" />
        </View>
        <View className="flex-row flex-wrap">
          {Array(6)
            .fill(0)
            .map((_, index) => (
              <View
                key={index}
                style={{ width: `${100 / numColumns}%`, padding: 4 }}
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
