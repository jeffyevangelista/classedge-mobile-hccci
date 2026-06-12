import { AppState, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Separator, Skeleton } from "heroui-native";
import { useClassSchedule } from "../profile.hooks";
import { ScreenList } from "@/components/ScreenList";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon, type IconName } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { formatTime } from "@/features/calendar/components/date-formatter";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_NAMES_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type DayShort = (typeof DAY_NAMES)[number];

type DayItem = {
  enrollmentId: number;
  scheduleId: number;
  subjectId: number;
  subjectName: string;
  teacherName: string | null;
  roomNumber: string | null;
  startTime: string | null;
  endTime: string | null;
};

const safeFormatTime = (time?: string | null) => {
  if (!time) return null;
  return formatTime(time.slice(0, 8));
};

const formatTimeRange = (
  start?: string | null,
  end?: string | null,
): string => {
  const s = safeFormatTime(start);
  const e = safeFormatTime(end);
  return s && e ? `${s} – ${e}` : "N/A";
};

const todayDayShort = () => DAY_NAMES[new Date().getDay()];

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

  // Day precision only — refresh `todayShort` on focus and on foreground
  // so the "Today" ring on the strip tracks the real day without a
  // per-minute clock subscription. `selectedDay` is independent: it is
  // seeded to today on mount and only changes when the user taps a pill.
  const [todayShort, setTodayShort] = useState<DayShort>(todayDayShort);
  const [selectedDay, setSelectedDay] = useState<DayShort>(todayDayShort);

  const refreshToday = useCallback(() => {
    setTodayShort(todayDayShort());
  }, []);
  useFocusEffect(refreshToday);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refreshToday();
    });
    return () => sub.remove();
  }, [refreshToday]);

  const { dayItems, daysWithClasses } = useMemo(() => {
    const enrollments = data ?? [];
    const dayCoverage = new Set<DayShort>();
    const items: DayItem[] = [];

    for (const enrollment of enrollments) {
      const subject = enrollment.subjectId;
      const teacher = subject?.assignTeacherId;
      const teacherName = teacher
        ? toTitleCase(`${teacher.firstName} ${teacher.lastName}`)
        : null;
      const roomNumber = subject?.roomNumber ?? null;
      const subjectName = subject?.subjectName || "N/A";
      const enrollmentId = enrollment.id ?? 0;
      const subjectId = subject?.id ?? 0;

      for (const schedule of enrollment.schedules ?? []) {
        const days = (schedule.daysOfWeek ?? "")
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean) as DayShort[];

        for (const day of days) {
          if (DAY_NAMES.includes(day)) {
            dayCoverage.add(day);
          }
        }

        if (days.includes(selectedDay)) {
          items.push({
            enrollmentId,
            scheduleId: schedule.id ?? 0,
            subjectId,
            subjectName,
            teacherName,
            roomNumber,
            startTime: schedule.scheduleStartTime ?? null,
            endTime: schedule.scheduleEndTime ?? null,
          });
        }
      }
    }

    items.sort((a, b) =>
      (a.startTime ?? "\uffff").localeCompare(b.startTime ?? "\uffff"),
    );

    return { dayItems: items, daysWithClasses: dayCoverage };
  }, [data, selectedDay]);

  // Render the skeleton any time a fetch is in flight and we have
  // nothing to show — covers the initial mount AND retries from the
  // error state. Same condition as the previous implementation.
  if ((isLoading || isFetching) && !data) return <ClassScheduleSkeleton />;

  if (isError)
    return (
      <ErrorComponent
        message={getApiErrorMessage(error)}
        onRetry={() => refetch()}
      />
    );

  const fullDayName =
    DAY_NAMES_LONG[DAY_NAMES.indexOf(selectedDay)] ?? selectedDay;
  const isViewingToday = selectedDay === todayShort;
  const count = dayItems.length;

  let summary: string | null = null;
  if (count > 0) {
    summary = isViewingToday
      ? `You have ${count} ${count === 1 ? "class" : "classes"} today`
      : `${count} ${count === 1 ? "class" : "classes"} on ${fullDayName}`;
  }

  return (
    <View className="flex-1">
      <WeekStrip
        selectedDay={selectedDay}
        todayShort={todayShort}
        daysWithClasses={daysWithClasses}
        onSelect={setSelectedDay}
        summary={summary}
      />
      <ScreenList
        className="mx-auto w-full max-w-3xl"
        style={{ marginBottom: 0 }}
        refreshControl={
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="CalendarBlankIcon"
            title={
              isViewingToday
                ? "No classes today"
                : `No classes on ${fullDayName}`
            }
            description="Tap a day with a dot to see its schedule."
          />
        }
        keyExtractor={(item) => `${item.enrollmentId}-${item.scheduleId}`}
        renderItem={({ item }) => (
          <TimeBlockCard
            item={item}
            onPress={() =>
              item.enrollmentId && router.push(`/course/${item.enrollmentId}`)
            }
          />
        )}
        data={dayItems}
      />
    </View>
  );
};

const WeekStrip = ({
  selectedDay,
  todayShort,
  daysWithClasses,
  onSelect,
  summary,
}: {
  selectedDay: DayShort;
  todayShort: DayShort;
  daysWithClasses: Set<DayShort>;
  onSelect: (day: DayShort) => void;
  summary: string | null;
}) => {
  return (
    <View className="bg-background px-2.5 pt-2 pb-3">
      <View className="flex-row gap-1.5">
        {DAY_NAMES.map((day) => (
          <DayPill
            key={day}
            day={day}
            isSelected={day === selectedDay}
            isToday={day === todayShort}
            hasClasses={daysWithClasses.has(day)}
            onPress={() => onSelect(day)}
          />
        ))}
      </View>
      {summary ? (
        <View className="px-1 pt-3">
          <AppText weight="semibold" className="text-sm text-muted">
            {summary}
          </AppText>
        </View>
      ) : null}
    </View>
  );
};

const DayPill = ({
  day,
  isSelected,
  isToday,
  hasClasses,
  onPress,
}: {
  day: DayShort;
  isSelected: boolean;
  isToday: boolean;
  hasClasses: boolean;
  onPress: () => void;
}) => {
  const containerClass = isSelected
    ? "bg-accent border-accent"
    : isToday
      ? "bg-accent/15 border-accent/30"
      : "bg-surface border-border";

  const labelClass = isSelected
    ? "text-accent-foreground"
    : isToday
      ? "text-accent"
      : "text-muted";

  const dotClass = !hasClasses
    ? "bg-transparent"
    : isSelected
      ? "bg-accent-foreground"
      : isToday
        ? "bg-accent"
        : "bg-muted";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Show schedule for ${DAY_NAMES_LONG[DAY_NAMES.indexOf(day)]}`}
      accessibilityState={{ selected: isSelected }}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className={`flex-1 items-center justify-center py-2.5 rounded-xl border ${containerClass}`}
    >
      <AppText
        weight="semibold"
        className={`text-[11px] uppercase tracking-wider ${labelClass}`}
      >
        {day}
      </AppText>
      <View className={`mt-1 w-1.5 h-1.5 rounded-full ${dotClass}`} />
    </Pressable>
  );
};

const TimeBlockCard = ({
  item,
  onPress,
}: {
  item: DayItem;
  onPress: () => void;
}) => {
  const timeLabel = formatTimeRange(item.startTime, item.endTime);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open course ${item.subjectName}`}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="active:opacity-80 rounded-xl overflow-hidden mb-3"
    >
      <Card className="shadow-none rounded-xl border border-border">
        <Card.Body className="gap-2">
          <AppText
            weight="semibold"
            className="text-xs uppercase tracking-wider text-accent"
          >
            {timeLabel}
          </AppText>
          <AppText
            weight="semibold"
            className="text-base text-foreground"
            numberOfLines={2}
          >
            {item.subjectName}
          </AppText>
          <Separator className="my-1" />
          <View className="gap-1.5">
            <MetaRow
              icon="UserIcon"
              value={item.teacherName ?? "No teacher assigned"}
            />
            <MetaRow icon="MapPinIcon" value={item.roomNumber ?? "N/A"} />
          </View>
        </Card.Body>
      </Card>
    </Pressable>
  );
};

const MetaRow = ({ icon, value }: { icon: IconName; value: string }) => (
  <View className="flex-row items-center gap-2">
    <Icon name={icon} size={16} className="text-muted" />
    <AppText className="text-sm text-foreground flex-1">{value}</AppText>
  </View>
);

const ClassScheduleSkeleton = () => {
  return (
    <View className="mx-auto w-full max-w-3xl gap-3 p-2.5">
      <View className="flex-row gap-1.5 pb-3">
        {DAY_NAMES.map((day) => (
          <View key={day} className="flex-1">
            <Skeleton className="h-12 w-full rounded-xl" />
          </View>
        ))}
      </View>
      {Array(3)
        .fill(0)
        .map((_, index) => (
          <Card
            key={index}
            className="mb-3 rounded-xl shadow-none border border-border"
          >
            <Card.Body className="gap-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-5 w-3/4 rounded" />
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
            </Card.Body>
          </Card>
        ))}
    </View>
  );
};

export default ClassScheduleList;
