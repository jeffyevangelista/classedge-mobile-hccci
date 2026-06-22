import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Separator, Skeleton } from "heroui-native";
import type { FlashListRef } from "@shopify/flash-list";
import { useClassSchedule } from "../profile.hooks";
import { useClock } from "@/hooks/useClock";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
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

  // `todayShort` is driven by a minute-aligned clock so the "Today" ring
  // flips at midnight even on a long-open session. `selectedDay` is
  // independent: seeded to today on mount and only changes on user tap.
  const todayShort = DAY_NAMES[useClock().getDay()];
  const [selectedDay, setSelectedDay] = useState<DayShort>(todayDayShort);
  const listRef = useRef<FlashListRef<DayItem>>(null);

  // FlashList preserves its scroll offset across `data` changes, so switching
  // from a busy day (scrolled down) to a quieter one would leave the few
  // remaining items pushed below the viewport top. Reset the offset on day
  // change so each day's schedule starts at the top.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [selectedDay]);

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

  // Classify the section so we can show the "you're offline and we
  // haven't synced yet" fallback instead of a misleading day-scoped
  // empty state. Emptiness is computed at the enrollment level — once
  // any enrollments are present, the day filter takes over and the
  // per-day empty case is handled by `ListEmptyComponent`.
  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading: isLoading || isFetching,
  });

  if (status.phase === "loading") return <ClassScheduleSkeleton />;

  if (isError)
    return (
      <ErrorComponent
        message={getApiErrorMessage(error)}
        onRetry={() => refetch()}
      />
    );

  if (status.phase === "offline-empty")
    return <OfflineEmpty section="schedule" />;

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
        ref={listRef}
        className="mx-auto w-full max-w-3xl"
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
