import { View, useColorScheme } from "react-native";
import React, { useMemo } from "react";
import { useClock } from "@/hooks/useClock";
import { useClassSchedule } from "@/features/profile/profile.hooks";
import { Skeleton } from "heroui-native";
import { colors } from "@/utils/colors";
import { AppText } from "@/components/AppText";
import { getApiErrorMessage } from "@/lib/api-error";

const formatTime = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
};

const ScheduleComponent = () => {
  const now = useClock();
  const isDark = useColorScheme() === "dark";

  const currentDay = now.getDay();

  const { data, isError, error, isLoading } = useClassSchedule();

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const { currentClass, nextClass, nextClassDayLabel, todayHasClasses } =
    useMemo(() => {
      if (!data)
        return {
          currentClass: null,
          nextClass: null,
          nextClassDayLabel: null,
          todayHasClasses: false,
        };

      // 1. Flatten and filter by day number (0 = Sunday, 1 = Monday, etc.)
      const todaySchedules = data.flatMap((subject) =>
        subject.schedules
          .filter((s) =>
            s.daysOfWeek.split(",").includes(DAY_NAMES[currentDay]),
          )
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

      if (upcoming.length > 0) {
        return {
          currentClass: current,
          nextClass: upcoming[0],
          nextClassDayLabel: null,
          todayHasClasses: todaySchedules.length > 0,
        };
      }

      // 4. No more classes today — look ahead up to 7 days
      for (let offset = 1; offset <= 7; offset++) {
        const futureDay = (currentDay + offset) % 7;
        const futureDaySchedules = data.flatMap((subject) =>
          subject.schedules
            .filter((s) =>
              s.daysOfWeek.split(",").includes(DAY_NAMES[futureDay]),
            )
            .map((s) => {
              const [h, m] = s.scheduleStartTime.split(":").map(Number);
              const [eh, em] = s.scheduleEndTime.split(":").map(Number);

              const futureDate = new Date(now);
              futureDate.setDate(futureDate.getDate() + offset);
              const start = new Date(futureDate);
              start.setHours(h, m, 0, 0);
              const end = new Date(futureDate);
              end.setHours(eh, em, 0, 0);

              return { ...s, subject, start, end };
            }),
        );

        if (futureDaySchedules.length > 0) {
          futureDaySchedules.sort(
            (a, b) => a.start.getTime() - b.start.getTime(),
          );
          return {
            currentClass: current,
            nextClass: futureDaySchedules[0],
            nextClassDayLabel: offset === 1 ? "Tomorrow" : DAY_NAMES[futureDay],
            todayHasClasses: todaySchedules.length > 0,
          };
        }
      }

      return {
        currentClass: current,
        nextClass: null,
        nextClassDayLabel: null,
        todayHasClasses: todaySchedules.length > 0,
      };
    }, [data, now, currentDay]);

  if (isError)
    return (
      <AppText className="text-red-500 p-4">
        {getApiErrorMessage(error)}
      </AppText>
    );
  if (!data) return null;

  return (
    <Skeleton isLoading={isLoading}>
      <View className="flex-row gap-3">
        {/* Left Card — Current Class */}
        <View
          className="flex-1 rounded-2xl p-5 justify-between"
          style={{
            backgroundColor: currentClass
              ? colors.primary[700]
              : isDark
                ? "#1e293b"
                : colors.primary[50],
            minHeight: 180,
          }}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <AppText
              weight="bold"
              className="uppercase text-[11px] tracking-widest"
              style={{
                color: currentClass
                  ? "rgba(255,255,255,0.7)"
                  : isDark
                    ? colors.primary[300]
                    : colors.primary[400],
              }}
            >
              {currentClass ? "Now" : "No Class"}
            </AppText>
          </View>

          <View className="flex-1 justify-center">
            <AppText
              weight="bold"
              className="text-[15px] leading-5"
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
            </AppText>
          </View>

          <View
            className="rounded-xl px-3 py-2 mt-3 self-start"
            style={{
              backgroundColor: currentClass
                ? "rgba(255,255,255,0.15)"
                : isDark
                  ? colors.primary[900]
                  : colors.primary[100],
            }}
          >
            <AppText
              weight="semibold"
              className="text-xs"
              style={{
                color: currentClass
                  ? "#ffffff"
                  : isDark
                    ? colors.primary[300]
                    : colors.primary[600],
              }}
            >
              {currentClass
                ? `${formatTime(currentClass.scheduleStartTime)} – ${formatTime(currentClass.scheduleEndTime)}`
                : "Enjoy your break"}
            </AppText>
          </View>
        </View>

        {/* Right Card — Upcoming Class */}
        <View
          className="flex-1 rounded-2xl p-5 justify-between border"
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
            minHeight: 180,
          }}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <AppText
              weight="bold"
              className="uppercase text-[11px] tracking-widest"
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
            </AppText>
          </View>

          <View className="flex-1 justify-center">
            <AppText
              weight="bold"
              className="text-[15px] leading-5"
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
            </AppText>
          </View>

          <View
            className="rounded-xl px-3 py-2 mt-3 self-start"
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
            <AppText
              weight="semibold"
              className="text-xs"
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
                ? nextClassDayLabel
                  ? `${nextClassDayLabel} · ${formatTime(nextClass.scheduleStartTime)}`
                  : `Starts ${formatTime(nextClass.scheduleStartTime)}`
                : "Rest & recharge"}
            </AppText>
          </View>
        </View>
      </View>
    </Skeleton>
  );
};

export default ScheduleComponent;
