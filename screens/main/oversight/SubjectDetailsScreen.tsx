import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Avatar, Card, Skeleton, useThemeColor } from "heroui-native";
import Screen from "@/components/screen";
import Image from "@/components/Image";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { useGetSubject, useStudents, useSubjectSchedules } from "@/features/oversight/oversight.hooks";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { toTitleCase } from "@/utils/toTitleCase";
import type { Schedule, Student } from "@/features/oversight/oversight.type";

const SubjectDetailsScreen = () => {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { data, isLoading, isError, error } = useGetSubject(subjectId ?? "");
  const navigation = useNavigation();

  const headerTitle = data?.subjectName ?? "";
  useEffect(() => {
    if (!headerTitle) return;
    navigation.setOptions({ headerTitle });
  }, [navigation, headerTitle]);

  if (isLoading) return <SubjectDetailsSkeleton />;
  if (isError)
    return (
      <Screen className="px-2.5 pt-2.5">
        <ErrorFallback message={getApiErrorMessage(error)} />
      </Screen>
    );

  const subjectName = data?.subjectName ?? "";
  const subjectCode = data?.subjectCode ?? "";
  const subjectType = data?.subjectType;
  const subjectPhoto = data?.subjectPhoto;
  const subjectDescription = data?.subjectDescription;
  const instructorName = data?.assignTeacherName ?? "Unassigned";
  const roomNumber = data?.roomNumber || "TBA";
  const showCode = !!subjectCode && subjectCode !== subjectName;

  return (
    <Screen>
      <ScreenScrollView>
        <View className="w-full max-w-3xl mx-auto px-2.5">
          <View className="mt-2.5 mb-5">
            <View className="rounded-2xl overflow-hidden bg-surface-secondary aspect-video">
              <Image
                source={
                  subjectPhoto
                    ? { uri: subjectPhoto }
                    : require("@/assets/placeholder/bg-placeholder.png")
                }
                className="w-full h-full"
                contentFit="cover"
                cachePolicy="disk"
              />
            </View>

            <View className="mt-4">
              <AppText weight="bold" className="text-2xl" numberOfLines={2}>
                {subjectName}
              </AppText>
              {(subjectType || showCode) && (
                <View className="flex-row items-center gap-2 mt-1.5">
                  {subjectType && (
                    <View className="bg-accent-soft px-2.5 py-1 rounded-full">
                      <AppText
                        weight="semibold"
                        className="text-[11px] text-accent uppercase tracking-wider"
                      >
                        {subjectType}
                      </AppText>
                    </View>
                  )}
                  {showCode && (
                    <AppText className="text-sm text-muted">
                      {subjectCode}
                    </AppText>
                  )}
                </View>
              )}
            </View>
          </View>

          <View className="bg-surface-secondary rounded-2xl px-4 mb-5">
            <InfoRow
              icon="UserCircleIcon"
              iconColor="accent"
              iconBgClass="bg-accent-soft"
              label="Instructor"
              value={instructorName}
            />
            <View className="h-px bg-border" />
            <InfoRow
              icon="MapPinIcon"
              iconColor="#10b981"
              iconBgClass="bg-emerald-100 dark:bg-emerald-900/50"
              label="Room"
              value={roomNumber}
            />
          </View>

          <ClassScheduleSection subjectId={subjectId ?? ""} />

          {!!subjectDescription && (
            <View className="mb-5">
              <AppText
                weight="semibold"
                className="text-[11px] text-muted uppercase tracking-wider mb-2 px-1"
              >
                Description
              </AppText>
              <View className="bg-surface-secondary rounded-2xl p-4">
                <AppText className="text-sm leading-6">
                  {subjectDescription}
                </AppText>
              </View>
            </View>
          )}

          <StudentsRosterSection subjectId={subjectId ?? ""} />
        </View>
      </ScreenScrollView>
    </Screen>
  );
};

type InfoRowProps = {
  icon: IconName;
  iconColor: string;
  iconBgClass: string;
  label: string;
  value: string;
};

const InfoRow = ({
  icon,
  iconColor,
  iconBgClass,
  label,
  value,
}: InfoRowProps) => {
  const accentColor = useThemeColor("accent");
  const resolvedColor = iconColor === "accent" ? accentColor : iconColor;
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View
        className={`w-8 h-8 rounded-full items-center justify-center ${iconBgClass}`}
      >
        <Icon name={icon} size={16} color={resolvedColor} />
      </View>
      <View className="flex-1">
        <AppText weight="semibold" className="text-sm" numberOfLines={1}>
          {value}
        </AppText>
        <AppText className="text-[11px] text-muted">{label}</AppText>
      </View>
    </View>
  );
};

const SubjectDetailsSkeleton = () => (
  <Screen>
    <View className="w-full max-w-3xl mx-auto px-2.5 mt-2.5">
      <Skeleton className="rounded-2xl w-full aspect-video" />
      <View className="mt-4 gap-2">
        <Skeleton className="h-7 w-3/4 rounded" />
        <View className="flex-row gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 w-20 rounded" />
        </View>
      </View>

      <View className="bg-surface-secondary rounded-2xl px-4 mt-5">
        <View className="flex-row items-center gap-3 py-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </View>
        </View>
        <View className="h-px bg-border" />
        <View className="flex-row items-center gap-3 py-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </View>
        </View>
      </View>
    </View>
  </Screen>
);

const VISIBLE_DEFAULT = 5;

const StudentsRosterSection = ({ subjectId }: { subjectId: string }) => {
  const [expanded, setExpanded] = useState(false);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useStudents(subjectId);

  // Tolerate both flat-page and {results} shapes — mirrors StudentList.
  const students: Student[] = (data?.pages ?? []).flatMap((page) => {
    if (!page) return [] as Student[];
    if (Array.isArray(page)) return page as Student[];
    const results = (page as { results?: Student[] }).results;
    return Array.isArray(results) ? results : ([] as Student[]);
  });

  const total =
    (data?.pages?.[0] as { count?: number } | undefined)?.count ??
    students.length;

  // Exhaust pagination on first expand so the inline list shows everyone.
  useEffect(() => {
    if (expanded && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [expanded, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const canExpand = total > VISIBLE_DEFAULT;
  const visible =
    expanded || !canExpand ? students : students.slice(0, VISIBLE_DEFAULT);
  const hiddenCount = Math.max(0, total - VISIBLE_DEFAULT);

  return (
    <View className="mb-5">
      <AppText
        weight="semibold"
        className="text-[11px] text-muted uppercase tracking-wider mb-2 px-1"
      >
        Students · {total}
      </AppText>

      {isLoading ? (
        <View className="bg-surface-secondary rounded-2xl px-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <View key={idx}>
              <View className="flex-row items-center gap-3 py-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <View className="flex-1 gap-1.5">
                  <Skeleton className="h-4 w-2/3 rounded" />
                </View>
              </View>
              {idx < 2 ? <View className="h-px bg-border" /> : null}
            </View>
          ))}
        </View>
      ) : isError ? (
        <View className="bg-surface-secondary rounded-2xl p-4">
          <ErrorFallback
            message={getApiErrorMessage(error)}
            onRefetch={refetch}
          />
        </View>
      ) : students.length === 0 ? (
        <View className="bg-surface-secondary rounded-2xl p-4">
          <AppText className="text-sm text-muted">
            No students enrolled yet
          </AppText>
        </View>
      ) : (
        <View className="bg-surface-secondary rounded-2xl px-4">
          {visible.map((student, idx) => (
            <View key={student.id}>
              <View className="flex-row items-center gap-3 py-3">
                <Avatar alt={toTitleCase(student.name) || "Student"} size="sm">
                  {student.studentPhoto ? (
                    <Avatar.Image source={{ uri: student.studentPhoto }} />
                  ) : null}
                  <AvatarFallbackImage />
                </Avatar>
                <AppText
                  weight="semibold"
                  className="text-sm flex-1"
                  numberOfLines={1}
                >
                  {toTitleCase(student.name) || "Unknown student"}
                </AppText>
              </View>
              {idx < visible.length - 1 ? (
                <View className="h-px bg-border" />
              ) : null}
            </View>
          ))}

          {canExpand ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? "Show fewer students"
                  : `Show all ${total} students`
              }
              hitSlop={6}
              className="py-3 active:opacity-70 flex-row items-center gap-1 self-start"
            >
              <AppText weight="semibold" className="text-sm text-accent">
                {expanded
                  ? "Show less"
                  : `Show all ${total} students (+${hiddenCount})`}
              </AppText>
              <Icon
                name={expanded ? "CaretUpIcon" : "CaretDownIcon"}
                size={14}
              />
              {expanded && isFetchingNextPage ? (
                <AppText className="text-xs text-muted ml-2">
                  Loading…
                </AppText>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatScheduleTime = (value: string | undefined | null): string => {
  if (!value) return "";
  // Server returns "HH:MM:SS"; render as 12-hour with am/pm.
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m.toString().padStart(2, "0");
  return `${h12}:${mm} ${period}`;
};

const ClassScheduleSection = ({ subjectId }: { subjectId: string }) => {
  const accentColor = useThemeColor("accent");
  const { data, isLoading, isError, error, refetch } = useSubjectSchedules(
    subjectId,
  );

  const activeSchedules = (data?.results ?? []).filter(
    (s) => s.isActiveSemester === 1,
  );

  if (isLoading) {
    return (
      <View className="mb-5 bg-surface-secondary rounded-2xl p-4">
        <View className="flex-row items-center mb-3">
          <Skeleton className="w-8 h-8 rounded-full mr-3" />
          <Skeleton className="h-4 w-32 rounded" />
        </View>
        <Skeleton className="h-4 w-3/4 rounded mb-2" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="mb-5 bg-surface-secondary rounded-2xl p-4">
        <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
      </View>
    );
  }

  if (activeSchedules.length === 0) return null;

  return (
    <View className="mb-5 bg-surface-secondary rounded-2xl overflow-hidden">
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <View className="w-8 h-8 rounded-full bg-accent-soft items-center justify-center">
          <Icon name="ClockIcon" size={16} color={accentColor} />
        </View>
        <View className="flex-1">
          <AppText weight="semibold" className="text-sm">
            Class Schedule
          </AppText>
          {activeSchedules.length > 1 ? (
            <AppText className="text-[11px] text-muted">
              {activeSchedules.length} sessions per week
            </AppText>
          ) : null}
        </View>
      </View>

      {activeSchedules.map((schedule: Schedule, idx) => {
        const days = (schedule.daysOfWeek ?? "")
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean)
          .sort(
            (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
          );
        return (
          <View key={schedule.id}>
            {idx > 0 ? <View className="h-px bg-border mx-4" /> : null}
            <View className="px-4 py-3 gap-2">
              <View className="flex-row gap-1.5 flex-wrap">
                {days.map((d) => (
                  <View
                    key={d}
                    className="px-2.5 py-1 rounded-md bg-accent-soft"
                  >
                    <AppText
                      weight="semibold"
                      className="text-[11px] text-accent uppercase tracking-wider"
                    >
                      {d}
                    </AppText>
                  </View>
                ))}
              </View>
              <AppText weight="semibold" className="text-base text-foreground">
                {formatScheduleTime(schedule.scheduleStartTime)} –{" "}
                {formatScheduleTime(schedule.scheduleEndTime)}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default SubjectDetailsScreen;
