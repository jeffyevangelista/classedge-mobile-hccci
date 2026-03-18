import { View, Text, useColorScheme } from "react-native";
import React, { useMemo } from "react";
import { useClock } from "@/hooks/useClock";
import { useClassSchedule } from "@/features/profile/profile.hooks";
import { Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import { colors } from "@/utils/colors";

const ScheduleComponent = () => {
  const now = useClock();
  const isDark = useColorScheme() === "dark";

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

  return (
    <Skeleton isLoading={isLoading}>
      <View className="flex-row gap-3">
        {/* Left Card — Current Class */}
        <View
          className="flex-1 rounded-2xl p-4 justify-between"
          style={{
            backgroundColor: currentClass
              ? colors.primary[700]
              : isDark
                ? "#1e293b"
                : colors.primary[50],
            minHeight: 160,
          }}
        >
          <View className="flex-row items-center gap-1.5 mb-2">
            <Icon
              name="CircleIcon"
              weight="fill"
              size={8}
              color={
                currentClass
                  ? "#4ade80"
                  : isDark
                    ? colors.primary[400]
                    : colors.primary[300]
              }
            />
            <Text
              className="uppercase text-[10px] font-bold tracking-widest"
              style={{
                color: currentClass
                  ? "rgba(255,255,255,0.7)"
                  : isDark
                    ? colors.primary[300]
                    : colors.primary[400],
              }}
            >
              {currentClass ? "Now" : "No Class"}
            </Text>
          </View>

          <View className="flex-1 justify-center">
            <Text
              className="text-base font-bold leading-5"
              style={{
                color: currentClass
                  ? "#ffffff"
                  : isDark
                    ? colors.primary[100]
                    : colors.primary[800],
              }}
              numberOfLines={2}
            >
              {currentClass
                ? currentClass.subject.subjectId.subjectName
                : "You're free right now"}
            </Text>

            {currentClass && (
              <View className="flex-row items-center gap-1 mt-1.5">
                <Icon
                  name="MapPinIcon"
                  size={12}
                  color="rgba(255,255,255,0.7)"
                />
                <Text
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  {currentClass.subject.subjectId.roomNumber}
                </Text>
              </View>
            )}
          </View>

          <View
            className="rounded-lg px-2.5 py-1.5 mt-2 self-start"
            style={{
              backgroundColor: currentClass
                ? "rgba(255,255,255,0.15)"
                : isDark
                  ? colors.primary[900]
                  : colors.primary[100],
            }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{
                color: currentClass
                  ? "#ffffff"
                  : isDark
                    ? colors.primary[300]
                    : colors.primary[600],
              }}
            >
              {currentClass
                ? `${currentClass.scheduleStartTime.slice(0, 5)} – ${currentClass.scheduleEndTime.slice(0, 5)}`
                : "Enjoy your break"}
            </Text>
          </View>
        </View>

        {/* Right Card — Upcoming Class */}
        <View
          className="flex-1 rounded-2xl p-4 justify-between border"
          style={{
            borderColor: nextClass
              ? isDark
                ? colors.primary[800]
                : colors.primary[200]
              : isDark
                ? "#374151"
                : "#e5e7eb",
            backgroundColor: nextClass
              ? isDark
                ? colors.primary[950]
                : colors.primary[50]
              : isDark
                ? "#111827"
                : "#f9fafb",
            minHeight: 160,
          }}
        >
          <View className="flex-row items-center gap-1.5 mb-2">
            <Icon
              name="FastForwardIcon"
              size={12}
              color={
                nextClass
                  ? isDark
                    ? colors.primary[400]
                    : colors.primary[500]
                  : isDark
                    ? "#6b7280"
                    : "#9ca3af"
              }
            />
            <Text
              className="uppercase text-[10px] font-bold tracking-widest"
              style={{
                color: nextClass
                  ? isDark
                    ? colors.primary[400]
                    : colors.primary[500]
                  : isDark
                    ? "#6b7280"
                    : "#9ca3af",
              }}
            >
              Up Next
            </Text>
          </View>

          <View className="flex-1 justify-center">
            <Text
              className="text-base font-bold leading-5"
              style={{
                color: nextClass
                  ? isDark
                    ? colors.primary[100]
                    : colors.primary[900]
                  : isDark
                    ? "#9ca3af"
                    : "#6b7280",
              }}
              numberOfLines={2}
            >
              {nextClass
                ? nextClass.subject.subjectId.subjectName
                : todayHasClasses
                  ? "Done for today"
                  : "No classes today"}
            </Text>

            {nextClass && (
              <View className="flex-row items-center gap-1 mt-1.5">
                <Icon
                  name="MapPinIcon"
                  size={12}
                  color={isDark ? colors.primary[500] : colors.primary[400]}
                />
                <Text
                  className="text-[11px]"
                  style={{
                    color: isDark ? colors.primary[400] : colors.primary[500],
                  }}
                >
                  {nextClass.subject.subjectId.roomNumber}
                </Text>
              </View>
            )}
          </View>

          <View
            className="rounded-lg px-2.5 py-1.5 mt-2 self-start"
            style={{
              backgroundColor: nextClass
                ? isDark
                  ? colors.primary[900]
                  : colors.primary[100]
                : isDark
                  ? "#1f2937"
                  : "#f3f4f6",
            }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{
                color: nextClass
                  ? isDark
                    ? colors.primary[300]
                    : colors.primary[700]
                  : isDark
                    ? "#6b7280"
                    : "#9ca3af",
              }}
            >
              {nextClass
                ? `Starts ${nextClass.scheduleStartTime.slice(0, 5)}`
                : "Rest & recharge"}
            </Text>
          </View>
        </View>
      </View>
    </Skeleton>
  );
};

export default ScheduleComponent;
