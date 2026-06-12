import { AppState, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useClassSchedule } from "../profile.hooks";
import { ScreenList } from "@/components/ScreenList";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon } from "@/components/Icon";
import { Skeleton, Card, Separator, Chip } from "heroui-native";
import EmptyState from "@/components/EmptyState";
import { formatTime } from "@/features/calendar/components/date-formatter";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = new Map(DAY_NAMES.map((d, i) => [d, i]));

const safeFormatTime = (time?: string | null) => {
  if (!time) return null;
  return formatTime(time.slice(0, 8));
};

const subjectHasToday = (
  schedules: { daysOfWeek?: string | null }[],
  todayShort: string,
) =>
  schedules.some((s) =>
    s.daysOfWeek
      ?.split(",")
      .map((d) => d.trim())
      .includes(todayShort),
  );

const sortByStartTime = <T extends { scheduleStartTime?: string | null }>(
  schedules: T[],
) =>
  [...schedules].sort((a, b) =>
    (a.scheduleStartTime ?? "").localeCompare(b.scheduleStartTime ?? ""),
  );

const sortDays = (days: string[]) =>
  [...days].sort(
    (a, b) =>
      (DAY_ORDER.get(a.trim()) ?? 99) - (DAY_ORDER.get(b.trim()) ?? 99),
  );

const ClassScheduleList = () => {
  const {
    data,
    isError,
    error,
    isLoading,
    refetch,
    isRefetching,
    isFetching,
  } = useClassSchedule();

  // Day precision only — refresh on screen focus and app foreground so
  // "Today" stays correct without a per-minute clock subscription.
  const [todayShort, setTodayShort] = useState(
    () => DAY_NAMES[new Date().getDay()],
  );
  const refreshToday = useCallback(() => {
    setTodayShort(DAY_NAMES[new Date().getDay()]);
  }, []);
  useFocusEffect(refreshToday);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refreshToday();
    });
    return () => sub.remove();
  }, [refreshToday]);
  const classSchedules = [...(data ?? [])].sort((a, b) => {
    const aToday = subjectHasToday(a.schedules ?? [], todayShort);
    const bToday = subjectHasToday(b.schedules ?? [], todayShort);
    if (aToday === bToday) return 0;
    return aToday ? -1 : 1;
  });

  const todayCount = classSchedules.filter((item) =>
    subjectHasToday(item.schedules ?? [], todayShort),
  ).length;
  const summary =
    todayCount === 0
      ? "No classes today"
      : `You have ${todayCount} ${todayCount === 1 ? "class" : "classes"} today`;

  // Render the skeleton any time a fetch is in flight and we have
  // nothing to show — covers the initial mount AND retries from the
  // error state. `isFetching` is the most reliable signal: `keepPreviousData`
  // and similar query options can keep `isRefetching` / `!data` from
  // reliably flipping during the post-error retry path.
  if ((isLoading || isFetching) && !data) return <ClassScheduleSkeleton />;

  if (isError)
    return (
      <ErrorComponent
        message={getApiErrorMessage(error)}
        onRetry={() => refetch()}
      />
    );

  return (
    <ScreenList
      className="mx-auto w-full max-w-3xl"
      refreshControl={
        <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
      }
      ListHeaderComponent={
        classSchedules.length > 0 ? (
          <View className="px-2.5 pt-2 pb-3">
            <AppText
              weight="semibold"
              className="text-sm text-muted"
            >
              {summary}
            </AppText>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="CalendarBlankIcon"
          title="No schedules found"
          description="Your class schedule will appear here"
        />
      }
      keyExtractor={(item, index) =>
        item?.id?.toString() || `schedule-${index}`
      }
      renderItem={({ item }) => {
        const subject = item.subjectId;
        const teacher = subject?.assignTeacherId;
        const schedules = sortByStartTime(item.schedules ?? []);
        const hasToday = subjectHasToday(schedules, todayShort);
        const subjectName = subject?.subjectName || "N/A";

        return (
          <Pressable
            onPress={() => subject?.id && router.push(`/course/${subject.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open course ${subjectName}`}
            android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
            className="active:opacity-80 rounded-xl overflow-hidden mb-3"
          >
            <Card
              className={`shadow-none rounded-xl border ${
                hasToday ? "border-accent" : "border-border"
              }`}
            >
              <Card.Body className="gap-3">
                <View className="flex-row items-start gap-2">
                  <View className="flex-1 gap-1">
                    <AppText
                      weight="semibold"
                      className="text-lg text-foreground"
                      numberOfLines={2}
                    >
                      {subjectName}
                    </AppText>
                    <AppText
                      className="text-sm text-muted"
                      numberOfLines={1}
                    >
                      {teacher
                        ? toTitleCase(
                            `${teacher.firstName} ${teacher.lastName}`,
                          )
                        : "No teacher assigned"}
                    </AppText>
                  </View>
                  {hasToday ? (
                    <View className="px-2 py-0.5 rounded-full bg-accent-soft">
                      <AppText
                        weight="semibold"
                        className="text-[11px] text-accent"
                      >
                        Today
                      </AppText>
                    </View>
                  ) : null}
                </View>

                <Separator className="my-1" />

                <MetaRow
                  icon="MapPinIcon"
                  value={subject?.roomNumber || "N/A"}
                />

                {schedules.length === 0 ? (
                  <MetaRow icon="ClockIcon" value="No time set" />
                ) : (
                  schedules.map((s, idx) => (
                    <ScheduleBlock
                      key={s.id ?? idx}
                      startTime={s.scheduleStartTime}
                      endTime={s.scheduleEndTime}
                      daysOfWeek={s.daysOfWeek}
                      todayShort={todayShort}
                    />
                  ))
                )}
              </Card.Body>
            </Card>
          </Pressable>
        );
      }}
      data={classSchedules}
    />
  );
};

const ScheduleBlock = ({
  startTime,
  endTime,
  daysOfWeek,
  todayShort,
}: {
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek?: string | null;
  todayShort: string;
}) => {
  const startStr = safeFormatTime(startTime);
  const endStr = safeFormatTime(endTime);
  const timeLabel = startStr && endStr ? `${startStr} – ${endStr}` : "N/A";

  return (
    <View className="gap-2">
      <MetaRow icon="ClockIcon" value={timeLabel} />
      {daysOfWeek ? (
        <View className="flex-row flex-wrap gap-1.5">
          {sortDays(daysOfWeek.split(",")).map((day) => {
            const trimmed = day.trim();
            const isToday = trimmed === todayShort;
            return (
              <Chip
                key={trimmed}
                variant={isToday ? "primary" : "soft"}
                color="accent"
              >
                <Chip.Label>{trimmed}</Chip.Label>
              </Chip>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const MetaRow = ({
  icon,
  value,
}: {
  icon: "ClockIcon" | "MapPinIcon";
  value: string;
}) => (
  <View className="flex-row items-center gap-2">
    <Icon name={icon} size={16} className="text-muted" />
    <AppText className="text-sm text-foreground flex-1">{value}</AppText>
  </View>
);

const ClassScheduleSkeleton = () => {
  return (
    <View className="mx-auto w-full max-w-3xl gap-3 p-2.5">
      <View className="px-0 pt-2 pb-1">
        <Skeleton className="h-4 w-40 rounded" />
      </View>
      {Array(4)
        .fill(0)
        .map((_, index) => (
          <Card
            key={index}
            className="mb-3 rounded-xl shadow-none border border-border"
          >
            <Card.Body className="gap-3">
              <View className="flex-row items-start gap-2">
                <View className="flex-1 gap-1">
                  <Skeleton className="h-5 w-3/4 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                </View>
                <Skeleton className="h-5 w-12 rounded-full" />
              </View>
              <Separator className="my-1" />
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 w-32 rounded" />
                </View>
                <View className="flex-row items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                </View>
              </View>
              <View className="flex-row flex-wrap gap-1.5 mt-1">
                <Skeleton className="h-7 w-14 rounded-full" />
                <Skeleton className="h-7 w-14 rounded-full" />
                <Skeleton className="h-7 w-14 rounded-full" />
              </View>
            </Card.Body>
          </Card>
        ))}
    </View>
  );
};

export default ClassScheduleList;
