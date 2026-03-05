import { View, Text } from "react-native";
import React, { useMemo } from "react";
import { useClock } from "@/hooks/useClock";
import { useClassSchedule } from "@/features/profile/profile.hooks";
import { Card, Skeleton } from "heroui-native";
import { colors } from "@/utils/colors";

const ScheduleComponent = () => {
  const now = useClock();

  const currentDay = now.getDay();

  const { data, isError, error, isLoading } = useClassSchedule();

  const { currentClass, nextClass, todayHasClasses } = useMemo(() => {
    if (!data)
      return { currentClass: null, nextClass: null, todayHasClasses: false };

    // 1. Flatten and filter by day number (0 = Sunday, 1 = Monday, etc.)
    const todaySchedules = data.flatMap((subject) =>
      subject.schedules
        .filter((s) => s.daysOfWeek.split(",").includes(currentDay.toString()))
        .map((s) => {
          // Parse HH:mm from "18:00:00.000000"
          const [h, m] = s.scheduleStartTime.split(":").map(Number);
          const [eh, em] = s.scheduleEndTime.split(":").map(Number);

          const start = new Date(now);
          start.setHours(h, m, 0, 0);

          const end = new Date(now);
          end.setHours(eh, em, 0, 0);

          return { ...s, subject, start, end };
        }),
    );

    // 2. Sort by time
    todaySchedules.sort((a, b) => a.start.getTime() - b.start.getTime());

    // 3. Find current and next
    const current = todaySchedules.find((s) => now >= s.start && now < s.end);
    const upcoming = todaySchedules.filter((s) => s.start > now);

    return {
      currentClass: current,
      nextClass: upcoming[0] || null,
      todayHasClasses: todaySchedules.length > 0,
    };
  }, [data, now, currentDay]);

  if (isError) return <Text className="text-red-500 p-4">{error.message}</Text>;
  if (!data) return null;

  // Header Logic
  const getHeaderLabel = () => {
    if (currentClass) return "Ongoing Class";
    if (nextClass) return "Up Next";
    if (!todayHasClasses) return "No Classes Today";
    return "Done for the Day";
  };

  return (
    <Skeleton isLoading={isLoading}>
      <Card className="w-full h-44 rounded-3xl p-6 flex-column justify-between shadow-lg bg-accent">
        <View>
          <View className="flex-row justify-between items-center">
            <Text className="text-white/70 uppercase text-[10px] font-bold tracking-widest">
              {getHeaderLabel()}
            </Text>
            <Text className="text-white/50 text-[10px]">
              {now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <Text
            className="text-white text-2xl font-bold mt-2 leading-7"
            numberOfLines={2}
          >
            {currentClass
              ? currentClass.subject.subjectId.subjectName
              : nextClass?.subject.subjectId.subjectName || "Rest & Recharge"}
          </Text>

          <Text className="text-white/80 text-sm mt-1">
            {currentClass
              ? `📍 ${currentClass.subject.subjectId.roomNumber}`
              : nextClass
                ? `📍 ${nextClass.subject.subjectId.roomNumber}`
                : "No more academic tasks"}
          </Text>
        </View>

        <View className="flex-row justify-between items-end border-t border-white/10 pt-3">
          <View>
            <Text className="text-white/60 text-[10px] mb-0.5">Schedule</Text>
            <Text className="text-white font-semibold">
              {currentClass
                ? `${currentClass.scheduleStartTime.slice(0, 5)} - ${currentClass.scheduleEndTime.slice(0, 5)}`
                : nextClass
                  ? `${nextClass.scheduleStartTime.slice(0, 5)} start`
                  : "--:--"}
            </Text>
          </View>

          {currentClass && nextClass && (
            <View className="bg-white/20 px-3 py-1.5 rounded-xl">
              <Text className="text-white text-[10px] font-medium">
                Next: {nextClass.subject.subjectId.subjectCode || "Class"}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Skeleton>
  );
};

export default ScheduleComponent;
