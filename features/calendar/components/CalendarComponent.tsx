import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(isBetween);
import { Link } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useEvents } from "../calendar.hooks";
import { formatDate } from "./date-formatter";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { Card, Skeleton, Surface } from "heroui-native";
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

const EventCard = ({
  item,
  onPress,
}: {
  item: any;
  onPress: (id: number) => void;
}) => {
  return (
    <Pressable onPress={() => onPress(item.id)}>
      <View className="mx-auto w-full max-w-3xl">
        <Card className="mb-1 rounded-xl flex-row items-center shadow-none">
          <View className="flex-row flex-1">
            <View className={"rounded-full p-2.5 bg-teal-50 dark:bg-teal-900"}>
              <Icon
                className={"h-6 w-6 text-teal-600 dark:text-teal-400"}
                name="CalendarDotsIcon"
              />
            </View>
            <View className="flex-1">
              <AppText
                weight="semibold"
                className="text-neutral-900 dark:text-neutral-100 text-lg flex-1"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.title}
              </AppText>
              <View className="flex-row items-center">
                <AppText
                  className="text-neutral-500 dark:text-neutral-400 text-xs"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </AppText>
              </View>
            </View>
          </View>
        </Card>
      </View>
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

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const dayCellSize = useMemo(() => {
    const horizontalPadding = 20;
    const availableWidth = width - horizontalPadding;
    const cellSize = Math.floor(availableWidth / 7);
    return Math.min(cellSize, 52);
  }, [width]);

  if (isLoading) return <CalendarSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  // ----------------------------------------------------
  // BUILD MARKED DATES
  // ----------------------------------------------------
  const markedDates: MarkedDates = useMemo(() => {
    const marks: MarkedDates = {};

    if (!data) return marks;

    // ------------------------------------------------
    // 1. EVENTS (period)
    // ------------------------------------------------
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

          marks[date].color = "#50cebb";
          marks[date].textColor = "white";
        }
      }
    });

    // ------------------------------------------------
    // 2. ACTIVITIES (dot on end)
    // ------------------------------------------------
    data.forEach((item) => {
      if (item.type === "activity") {
        const endDate = dayjs(item.endDate).format("YYYY-MM-DD");

        if (!marks[endDate]) marks[endDate] = {};

        marks[endDate].marked = true;
        marks[endDate].dotColor = "#FF5A5F";
      }
    });

    // ------------------------------------------------
    // 3. SELECTED DATE STYLE (using period properties)
    // ------------------------------------------------
    if (!marks[selectedDate]) marks[selectedDate] = {};

    // Apply selected date styling using period marking properties
    // This ensures it works with markingType="period"
    marks[selectedDate].startingDay = true;
    marks[selectedDate].endingDay = true;
    marks[selectedDate].color = "#146BB5";
    marks[selectedDate].textColor = "white";

    // ------------------------------------------------
    // 4. TODAY STYLE (using period properties)
    // ------------------------------------------------
    if (!marks[today]) marks[today] = {};

    // Only apply today style if it's NOT the selected date
    if (today !== selectedDate) {
      marks[today].startingDay = true;
      marks[today].endingDay = true;
      marks[today].color = isDark ? "#1e3a5f" : "#E3F2FD";
      marks[today].textColor = isDark ? "#90caf9" : "#146BB5";
    }

    return marks;
  }, [data, selectedDate, isDark]);

  // ----------------------------------------------------
  // FILTER ITEMS FOR SELECTED DATE
  // ----------------------------------------------------
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

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
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
                monthTextColor: isDark ? "#e5e5e5" : "#2d4150",
                dayTextColor: isDark ? "#e5e5e5" : "#2d4150",
                textDisabledColor: isDark ? "#555555" : "#d9e1e8",
                arrowColor: isDark ? "#90caf9" : "#146BB5",
                textDayFontSize: Math.max(14, dayCellSize * 0.35),
                textDayFontWeight: "400",
                textDayHeaderFontSize: Math.max(12, dayCellSize * 0.3),
                textDayHeaderFontWeight: "600",
                "stylesheet.day.basic": {
                  base: {
                    width: dayCellSize,
                    height: dayCellSize,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  text: {
                    marginTop: 0,
                    fontSize: Math.max(14, dayCellSize * 0.35),
                    fontWeight: "400",
                    color: isDark ? "#e5e5e5" : "#2d4150",
                  },
                },
                "stylesheet.calendar.header": {
                  dayTextAtIndex0: {
                    color: isDark ? "#90caf9" : "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex1: {
                    color: isDark ? "#90caf9" : "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex2: {
                    color: isDark ? "#90caf9" : "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex3: {
                    color: isDark ? "#90caf9" : "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex4: {
                    color: isDark ? "#90caf9" : "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex5: {
                    color: isDark ? "#90caf9" : "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex6: {
                    color: isDark ? "#90caf9" : "#146BB5",
                    fontWeight: "600",
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

      {/* Items under calendar */}
      <View className="mt-5 mx-5">
        {itemsForSelected.length === 0 ? (
          <Text className="text-center text-neutral-500 dark:text-neutral-400">
            No events or activities for this date.
          </Text>
        ) : (
          itemsForSelected.map((item) => {
            if (item.type === "activity") {
              return (
                <Link
                  key={item.title}
                  href={`/assessment/${item.id}`}
                  className="mx-auto w-full"
                  asChild
                >
                  <Card className="shadow-none rounded-xl mb-1 flex-row items-center active:bg-orange-50/50 dark:active:bg-orange-900/50 border-neutral-200 dark:border-neutral-700 border">
                    <View className="flex-row flex-1 gap-2">
                      <View
                        className={
                          "rounded-full p-2.5 bg-orange-50 dark:bg-orange-900"
                        }
                      >
                        <Icon
                          className={
                            "h-6 w-6 text-orange-600 dark:text-orange-400"
                          }
                          name="PencilLineIcon"
                        />
                      </View>
                      <View className="flex-1">
                        <AppText
                          weight="semibold"
                          className="text-neutral-900 dark:text-neutral-100 text-lg flex-1"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.title}
                        </AppText>
                        <View className="flex-row items-center">
                          <AppText
                            className="text-neutral-500 dark:text-neutral-400 text-xs"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            Due {formatDate(item.endDate)}
                          </AppText>
                        </View>
                      </View>
                    </View>
                  </Card>
                </Link>
              );
            }

            if (item.type === "event") {
              return (
                <EventCard
                  key={item.id}
                  item={item}
                  onPress={setSelectedEventId}
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
      <View className="mt-5 mx-5 gap-2">
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
