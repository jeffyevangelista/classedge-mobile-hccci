import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(isBetween);
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Calendar } from "react-native-calendars";
import { useEvents } from "../calendar.hooks";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { formatDate } from "./date-formatter";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { Card, Skeleton, Surface, useThemeColor } from "heroui-native";
import { Icon } from "@/components/Icon";
import { toTitleCase } from "@/utils/toTitleCase";
import { useUniwind } from "uniwind";

type CustomMarkedDate = {
  marked?: boolean;
  dotColor?: string;

  // period support
  startingDay?: boolean;
  endingDay?: boolean;
  color?: string;
  textColor?: string;

  // custom style support
  customStyles?: {
    container?: object;
    text?: object;
  };
};

type MarkedDates = Record<string, CustomMarkedDate>;

type CalendarItem = {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  createdById?: {
    firstName: string;
    lastName: string;
  } | null;
};

const EVENT_COLOR = "#0d9488";
const EVENT_PERIOD_COLOR = "#50cebb";
const CROWDED_DOT_COLOR = "#6B21A8";

const LegendChip = ({
  color,
  label,
  variant = "fill",
}: {
  color: string;
  label: string;
  variant?: "fill" | "dot" | "ring";
}) => {
  const swatch =
    variant === "dot" ? (
      <View
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    ) : variant === "ring" ? (
      <View
        className="w-3 h-3 rounded-full border-2"
        style={{ borderColor: color }}
      />
    ) : (
      <View
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color }}
      />
    );
  return (
    <View className="flex-row items-center gap-1.5">
      {swatch}
      <AppText className="text-[11px] text-muted">{label}</AppText>
    </View>
  );
};

const CalendarItemCard = ({
  iconName,
  iconColor,
  iconBgClass,
  title,
  subtitle,
  caption,
  onPress,
  accessibilityLabel,
}: {
  iconName: "CalendarDotsIcon";
  iconColor: string;
  iconBgClass: string;
  title: string;
  subtitle: string;
  caption?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="active:opacity-80 rounded-xl overflow-hidden 1"
    >
      <Card className="rounded-xl flex-row items-center gap-2 shadow-none border border-border">
        <View className={`rounded-full p-2.5 ${iconBgClass}`}>
          <Icon name={iconName} size={20} color={iconColor} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </AppText>
          <AppText
            className="text-sm text-muted"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </AppText>
          {caption ? (
            <AppText className="text-muted text-xs" numberOfLines={1}>
              {caption}
            </AppText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
};

const CalendarComponent = () => {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useEvents();
  const today = dayjs().format("YYYY-MM-DD");
  const { width } = useWindowDimensions();
  const { theme } = useUniwind();
  const isDark = theme === "dark";

  const accentColor = useThemeColor("accent");
  const accentForegroundColor = useThemeColor("accent-foreground");
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const todayYearMonth = dayjs().format("YYYY-MM");
  const [viewedYearMonth, setViewedYearMonth] =
    useState<string>(todayYearMonth);
  const [calendarKey, setCalendarKey] = useState(0);
  const isViewingCurrentMonth = viewedYearMonth === todayYearMonth;

  const jumpToToday = () => {
    setSelectedDate(today);
    setViewedYearMonth(todayYearMonth);
    setCalendarKey((k) => k + 1);
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const dayCellSize = useMemo(() => {
    const horizontalPadding = 20;
    const availableWidth = width - horizontalPadding;
    const cellSize = Math.floor(availableWidth / 7);
    return Math.min(cellSize, 52);
  }, [width]);

  const markedDates: MarkedDates = useMemo(() => {
    const marks: MarkedDates = {};

    if (!data) return marks;

    data.forEach((item) => {
      const start = dayjs(item.startDate);
      const end = dayjs(item.endDate);

      const diff = end.diff(start, "day");

      for (let i = 0; i <= diff; i++) {
        const date = start.add(i, "day").format("YYYY-MM-DD");

        if (!marks[date]) marks[date] = {};

        if (i === 0) marks[date].startingDay = true;
        if (i === diff) marks[date].endingDay = true;

        marks[date].color = EVENT_PERIOD_COLOR;
        marks[date].textColor = "white";
      }
    });

    const itemsPerDay: Record<string, number> = {};
    data.forEach((item) => {
      const start = dayjs(item.startDate);
      const diff = dayjs(item.endDate).diff(start, "day");
      for (let i = 0; i <= diff; i++) {
        const d = start.add(i, "day").format("YYYY-MM-DD");
        itemsPerDay[d] = (itemsPerDay[d] ?? 0) + 1;
      }
    });
    Object.entries(itemsPerDay).forEach(([day, count]) => {
      if (count > 1 && day !== selectedDate) {
        if (!marks[day]) marks[day] = {};
        marks[day].marked = true;
        marks[day].dotColor = CROWDED_DOT_COLOR;
      }
    });

    if (!marks[selectedDate]) marks[selectedDate] = {};

    marks[selectedDate].startingDay = true;
    marks[selectedDate].endingDay = true;
    marks[selectedDate].color = accentColor;
    marks[selectedDate].textColor = accentForegroundColor;

    if (!marks[today]) marks[today] = {};

    if (today !== selectedDate) {
      marks[today].startingDay = true;
      marks[today].endingDay = true;
      marks[today].color = isDark ? "#1e3a5f" : "#E3F2FD";
      marks[today].textColor = accentColor;
    }

    return marks;
  }, [data, selectedDate, isDark, today, accentColor, accentForegroundColor]);

  const itemsForSelected = useMemo(() => {
    if (!data) return [];

    return data.filter((item) =>
      dayjs(selectedDate).isBetween(item.startDate, item.endDate, "day", "[]"),
    );
  }, [data, selectedDate]);

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: () => false, // calendar grid is meaningful even with zero events — never "empty"
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  if (status.phase === "loading") return <CalendarSkeleton />;
  if (status.phase === "offline-empty")
    return <OfflineEmpty section="calendar" />;

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View className="p-2.5 max-w-3xl mx-auto w-full">
        <Surface className="rounded-xl shadow-none">
          <Calendar
            key={`${theme}-${calendarKey}`}
            current={selectedDate}
            markingType="period"
            markedDates={markedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            onMonthChange={(month) =>
              setViewedYearMonth(
                `${month.year}-${String(month.month).padStart(2, "0")}`,
              )
            }
            theme={
              {
                calendarBackground: "transparent",
                monthTextColor: foregroundColor,
                dayTextColor: foregroundColor,
                textDisabledColor: mutedColor,
                arrowColor: accentColor,
                textDayFontFamily: "Poppins-Regular",
                textMonthFontFamily: "Poppins-SemiBold",
                textDayHeaderFontFamily: "Poppins-SemiBold",
                textDayFontSize: Math.max(14, dayCellSize * 0.35),
                textDayHeaderFontSize: Math.max(11, dayCellSize * 0.26),
                "stylesheet.day.basic": {
                  base: {
                    width: dayCellSize,
                    height: dayCellSize,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  text: {
                    marginTop: 0,
                    fontFamily: "Poppins-Regular",
                    fontSize: Math.max(14, dayCellSize * 0.35),
                    color: foregroundColor,
                  },
                },
                "stylesheet.calendar.header": Object.fromEntries(
                  Array.from({ length: 7 }, (_, i) => [
                    `dayTextAtIndex${i}`,
                    {
                      color: i === 0 || i === 6 ? accentColor : mutedColor,
                      fontFamily: "Poppins-SemiBold",
                    },
                  ]),
                ),
              } as any
            }
            style={{
              paddingHorizontal: 10,
            }}
          />
        </Surface>
      </View>

      <View className="px-5 max-w-3xl w-full mx-auto flex-row items-center justify-between flex-wrap gap-y-2">
        <View className="flex-row items-center flex-wrap gap-x-3 gap-y-1.5">
          <LegendChip color={accentColor} label="Selected" />
          <LegendChip color={EVENT_PERIOD_COLOR} label="Event" />
          <LegendChip
            color={CROWDED_DOT_COLOR}
            label="Multiple"
            variant="dot"
          />
          <LegendChip color={accentColor} label="Today" variant="ring" />
        </View>
        {!isViewingCurrentMonth && (
          <Pressable
            onPress={jumpToToday}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            className="active:opacity-60"
          >
            <AppText weight="semibold" className="text-xs text-accent">
              Today
            </AppText>
          </Pressable>
        )}
      </View>

      <View className="mt-4 px-5 max-w-3xl w-full mx-auto flex-row items-center justify-between mb-1">
        <AppText weight="semibold" className="text-base">
          {selectedDate === today
            ? "Today"
            : dayjs(selectedDate).format("dddd, MMM D")}
        </AppText>
        {itemsForSelected.length > 0 && (
          <AppText className="text-xs text-muted">
            {itemsForSelected.length}{" "}
            {itemsForSelected.length === 1 ? "item" : "items"}
          </AppText>
        )}
      </View>

      <Animated.View
        key={selectedDate}
        entering={FadeIn.duration(180)}
        className="px-2.5 max-w-3xl w-full mx-auto"
      >
        {itemsForSelected.length === 0 ? (
          <View className="items-center justify-center py-10 gap-3">
            <View className="p-4 rounded-full bg-accent-soft">
              <Icon
                name="CalendarBlankIcon"
                size={32}
                className="text-accent"
              />
            </View>
            <AppText className="text-center text-sm text-muted">
              No events or activities for this date.
            </AppText>
          </View>
        ) : (
          itemsForSelected.map((item) => {
            const ev = item as CalendarItem;
            const sameDay = dayjs(ev.startDate).isSame(ev.endDate, "day");
            const eventSubtitle = sameDay
              ? formatDate(ev.startDate)
              : `${formatDate(ev.startDate)} - ${formatDate(ev.endDate)}`;
            return (
              <CalendarItemCard
                key={ev.id}
                iconName="CalendarDotsIcon"
                iconColor={EVENT_COLOR}
                iconBgClass="bg-teal-100 dark:bg-teal-500/20"
                title={ev.title}
                subtitle={eventSubtitle}
                caption={
                  ev.createdById
                    ? `By ${toTitleCase(`${ev.createdById.firstName} ${ev.createdById.lastName}`)}`
                    : undefined
                }
                onPress={() => router.push(`/event/${ev.id}`)}
              />
            );
          })
        )}
      </Animated.View>
    </ScreenScrollView>
  );
};

const CalendarSkeleton = () => {
  return (
    <ScreenScrollView>
      <View className="p-2.5 max-w-3xl mx-auto w-full">
        <Surface className="rounded-xl shadow-none p-4">
          <View className="flex-row justify-between items-center mb-4">
            <Skeleton className="h-5 w-32 rounded" />
            <View className="flex-row gap-4">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-6 w-6 rounded" />
            </View>
          </View>
          <View className="flex-row justify-between mb-3">
            {Array(7)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-4 w-8 rounded" />
              ))}
          </View>
          {Array(5)
            .fill(0)
            .map((_, row) => (
              <View key={row} className="flex-row justify-between mb-1">
                {Array(7)
                  .fill(0)
                  .map((_, col) => (
                    <Skeleton key={col} className="h-8 w-8 rounded-full" />
                  ))}
              </View>
            ))}
        </Surface>
      </View>
      <View className="px-5 max-w-3xl w-full mx-auto flex-row items-center gap-3">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <View key={i} className="flex-row items-center gap-1.5">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-3 w-12 rounded" />
            </View>
          ))}
      </View>
      <View className="mt-4 px-5 max-w-3xl w-full mx-auto flex-row items-center justify-between mb-1">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
      </View>
      <View className="px-2.5 max-w-3xl w-full mx-auto gap-2">
        {Array(3)
          .fill(0)
          .map((_, index) => (
            <Card
              key={index}
              className="mb-1 rounded-xl flex-row items-center shadow-none"
            >
              <View className="flex-row flex-1 gap-2">
                <Skeleton className="w-10 h-10 rounded-full" />
                <View className="flex-1 gap-1.5">
                  <Skeleton className="h-5 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </View>
              </View>
            </Card>
          ))}
      </View>
    </ScreenScrollView>
  );
};

export default CalendarComponent;
