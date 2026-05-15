import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(isBetween);
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { Calendar } from "react-native-calendars";
import { useEvents } from "../calendar.hooks";
import { formatDate } from "./date-formatter";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { Card, Skeleton, Surface, useThemeColor } from "heroui-native";
import { Icon } from "@/components/Icon";
import EventDetailModal from "./EventDetailModal";
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
  type: "event" | "activity";
  title: string;
  startDate: string;
  endDate: string;
  createdById?: {
    firstName: string;
    lastName: string;
  } | null;
};

const EVENT_COLOR = "#0d9488";
const ACTIVITY_COLOR = "#f97316";
const EVENT_PERIOD_COLOR = "#50cebb";
const ACTIVITY_DOT_COLOR = "#FF5A5F";

const CalendarItemCard = ({
  iconName,
  iconColor,
  iconBgClass,
  title,
  subtitle,
  caption,
  onPress,
}: {
  iconName: "CalendarDotsIcon" | "PencilLineIcon";
  iconColor: string;
  iconBgClass: string;
  title: string;
  subtitle: string;
  caption?: string;
  onPress: () => void;
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Card className="mb-1 rounded-xl flex-row items-center gap-2 shadow-none border border-border">
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
            className="text-xs text-muted"
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
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

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
      if (item.type === "event") {
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
      }
    });

    data.forEach((item) => {
      if (item.type === "activity") {
        const endDate = dayjs(item.endDate).format("YYYY-MM-DD");

        if (!marks[endDate]) marks[endDate] = {};

        marks[endDate].marked = true;
        marks[endDate].dotColor = ACTIVITY_DOT_COLOR;
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
  }, [
    data,
    selectedDate,
    isDark,
    today,
    accentColor,
    accentForegroundColor,
  ]);

  const itemsForSelected = useMemo(() => {
    if (!data) return [];

    return data.filter((item) => {
      if (item.type === "activity") {
        const actDate = dayjs(item.endDate).format("YYYY-MM-DD");
        return actDate === selectedDate;
      }

      if (item.type === "event") {
        return dayjs(selectedDate).isBetween(
          item.startDate,
          item.endDate,
          "day",
          "[]",
        );
      }

      return false;
    });
  }, [data, selectedDate]);

  if (isLoading) return <CalendarSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <ScrollView
      refreshControl={
        <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View className="p-2.5 max-w-3xl mx-auto w-full">
        <Surface className="rounded-xl shadow-none">
          <Calendar
            key={theme}
            markingType="period"
            markedDates={markedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
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
                "stylesheet.calendar.header": {
                  dayTextAtIndex0: {
                    color: accentColor,
                    fontFamily: "Poppins-SemiBold",
                  },
                  dayTextAtIndex1: {
                    color: accentColor,
                    fontFamily: "Poppins-SemiBold",
                  },
                  dayTextAtIndex2: {
                    color: accentColor,
                    fontFamily: "Poppins-SemiBold",
                  },
                  dayTextAtIndex3: {
                    color: accentColor,
                    fontFamily: "Poppins-SemiBold",
                  },
                  dayTextAtIndex4: {
                    color: accentColor,
                    fontFamily: "Poppins-SemiBold",
                  },
                  dayTextAtIndex5: {
                    color: accentColor,
                    fontFamily: "Poppins-SemiBold",
                  },
                  dayTextAtIndex6: {
                    color: accentColor,
                    fontFamily: "Poppins-SemiBold",
                  },
                },
              } as any
            }
            style={{
              paddingHorizontal: 10,
            }}
          />
        </Surface>
      </View>

      <View className="mt-5 px-5 max-w-3xl w-full mx-auto">
        {itemsForSelected.length === 0 ? (
          <AppText className="text-center text-muted">
            No events or activities for this date.
          </AppText>
        ) : (
          itemsForSelected.map((item) => {
            if (item.type === "activity") {
              return (
                <CalendarItemCard
                  key={item.id}
                  iconName="PencilLineIcon"
                  iconColor={ACTIVITY_COLOR}
                  iconBgClass="bg-orange-50 dark:bg-orange-900"
                  title={item.title}
                  subtitle={`Due ${formatDate(item.endDate)}`}
                  onPress={() => router.push(`/assessment/${item.id}`)}
                />
              );
            }

            if (item.type === "event") {
              const ev = item as CalendarItem;
              return (
                <CalendarItemCard
                  key={ev.id}
                  iconName="CalendarDotsIcon"
                  iconColor={EVENT_COLOR}
                  iconBgClass="bg-teal-50 dark:bg-teal-900"
                  title={ev.title}
                  subtitle={`${formatDate(ev.startDate)} - ${formatDate(ev.endDate)}`}
                  caption={
                    ev.createdById
                      ? `By ${ev.createdById.firstName} ${ev.createdById.lastName}`
                      : undefined
                  }
                  onPress={() => setSelectedEventId(ev.id)}
                />
              );
            }

            return null;
          })
        )}
      </View>

      <EventDetailModal
        isOpen={selectedEventId !== null}
        setOpenChange={(open) => !open && setSelectedEventId(null)}
        eventId={selectedEventId!}
      />
    </ScrollView>
  );
};

const CalendarSkeleton = () => {
  return (
    <ScrollView>
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
              <View key={row} className="flex-row justify-between mb-2">
                {Array(7)
                  .fill(0)
                  .map((_, col) => (
                    <Skeleton key={col} className="h-8 w-8 rounded-full" />
                  ))}
              </View>
            ))}
        </Surface>
      </View>
      <View className="mt-5 px-5 max-w-3xl w-full mx-auto gap-2">
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
    </ScrollView>
  );
};

export default CalendarComponent;
