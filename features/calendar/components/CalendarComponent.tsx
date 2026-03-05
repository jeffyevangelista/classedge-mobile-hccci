import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(isBetween);
import { Link } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useEvents } from "../calendar.hooks";
import { formatDate } from "./date-formatter";
import { AppText } from "@/components/AppText";
import { Card, Surface } from "heroui-native";
import { Icon } from "@/components/Icon";
import { CalendarDotsIcon, PencilLineIcon } from "phosphor-react-native";
import EventDetailModal from "./EventDetailModal";

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

const EventCard = ({ item }: { item: any }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <React.Fragment key={item.id}>
      <Pressable onPress={() => setIsOpen(true)}>
        <View className=" mx-auto w-full max-w-3xl">
          <Card className="mb-1 flex-row items-center ">
            <View className=" flex-row flex-1">
              <View className={"rounded-full p-2.5 bg-teal-50"}>
                <Icon
                  className={"h-6 w-6 text-teal-600"}
                  name="CalendarDotsIcon"
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-neutral-900 font-poppins-semibold text-lg flex-1"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.title}
                </Text>
                <View className="flex-row items-center">
                  <Text
                    className="text-neutral-500 text-xs"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {formatDate(item.startDate)} - {formatDate(item.endDate)}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </View>
      </Pressable>
      <EventDetailModal
        isOpen={isOpen}
        setOpenChange={setIsOpen}
        eventId={item.id}
      />
    </React.Fragment>
  );
};

const CalendarComponent = () => {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useEvents();
  const today = dayjs().format("YYYY-MM-DD");
  const { width } = useWindowDimensions();

  const [selectedDate, setSelectedDate] = useState<string>(today);

  const dayCellSize = useMemo(() => {
    const horizontalPadding = 20;
    const availableWidth = width - horizontalPadding;
    const cellSize = Math.floor(availableWidth / 7);
    return Math.min(cellSize, 52);
  }, [width]);

  if (isLoading)
    return (
      <View className="h-full items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  if (isError) return <AppText>{error.message}</AppText>;

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
      marks[today].color = "#E3F2FD"; // Light blue background
      marks[today].textColor = "#146BB5";
    }

    return marks;
  }, [data, selectedDate]);

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
    <ScrollView>
      <View className="p-2.5 max-w-3xl mx-auto w-full">
        <Surface>
          <Calendar
            markingType="period"
            markedDates={markedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            theme={
              {
                arrowColor: "#146BB5",
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
                  },
                },
                "stylesheet.calendar.header": {
                  dayTextAtIndex0: {
                    color: "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex1: {
                    color: "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex2: {
                    color: "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex3: {
                    color: "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex4: {
                    color: "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex5: {
                    color: "#146BB5",
                    fontWeight: "600",
                  },
                  dayTextAtIndex6: {
                    color: "#146BB5",
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
          <Text className="text-center text-neutral-500">
            No events or activities for this date.
          </Text>
        ) : (
          itemsForSelected.map((item) => {
            if (item.type === "activity") {
              return (
                <Link
                  key={item.title}
                  href={`/assessment/${item.id}`}
                  className=" mx-auto w-full"
                  asChild
                >
                  <Card className="mb-1 flex-row items-center active:bg-orange-50/50 border-neutral-200 border">
                    <View className="flex-row flex-1 gap-2">
                      <View className={"rounded-full p-2.5 bg-orange-50"}>
                        <Icon
                          className={"h-6 w-6 text-orange-600"}
                          name="PencilLineIcon"
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-neutral-900 font-poppins-semibold text-lg flex-1"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.title}
                        </Text>
                        <View className=" flex-row items-center">
                          <Text
                            className="text-neutral-500 text-xs"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            Due {formatDate(item.endDate)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                </Link>
              );
            }

            if (item.type === "event") {
              return <EventCard key={item.id} item={item} />;
            }

            return null;
          })
        )}
      </View>
    </ScrollView>
  );
};

export default CalendarComponent;
