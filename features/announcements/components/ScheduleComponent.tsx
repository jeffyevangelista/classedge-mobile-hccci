import { View, Pressable } from "react-native";
import React, { useMemo } from "react";
import { useClock } from "@/hooks/useClock";
import { useClassSchedule } from "@/features/profile/profile.hooks";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { Skeleton } from "heroui-native";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { getApiErrorMessage } from "@/lib/api-error";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { Icon } from "@/components/Icon";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatTime = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
};

const formatCountdown = (target: Date, now: Date): string => {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "now";
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return "<1m";
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

const buildDaySchedules = (
  data: NonNullable<ReturnType<typeof useClassSchedule>["data"]>,
  dayIndex: number,
  baseDate: Date,
  dayOffset = 0,
) =>
  data.flatMap((subject) =>
    subject.schedules
      .filter((s) =>
        s.daysOfWeek
          .split(",")
          .map((d) => d.trim())
          .includes(DAY_NAMES[dayIndex]),
      )
      .map((s) => {
        const [h, m] = s.scheduleStartTime.split(":").map(Number);
        const [eh, em] = s.scheduleEndTime.split(":").map(Number);
        const day = new Date(baseDate);
        if (dayOffset !== 0) day.setDate(day.getDate() + dayOffset);
        const start = new Date(day);
        start.setHours(h, m, 0, 0);
        const end = new Date(day);
        end.setHours(eh, em, 0, 0);
        return { ...s, subject, start, end };
      }),
  );

const ScheduleComponent = () => {
  const now = useClock();
  const router = useRouter();

  const currentDay = now.getDay();

  const { data, isError, error, isLoading, isFetching, refetch } =
    useClassSchedule();

  const {
    currentClass,
    nextClass,
    nextClassDayLabel,
    todayHasClasses,
    remainingTodayCount,
  } = useMemo(() => {
    if (!data)
      return {
        currentClass: null,
        nextClass: null,
        nextClassDayLabel: null,
        todayHasClasses: false,
        remainingTodayCount: 0,
      };

    const todaySchedules = buildDaySchedules(data, currentDay, now).sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );

    const current = todaySchedules.find((s) => now >= s.start && now < s.end);
    const upcoming = todaySchedules.filter((s) => s.start > now);

    if (upcoming.length > 0) {
      return {
        currentClass: current,
        nextClass: upcoming[0],
        nextClassDayLabel: null,
        todayHasClasses: todaySchedules.length > 0,
        remainingTodayCount: upcoming.length - 1,
      };
    }

    for (let offset = 1; offset <= 7; offset++) {
      const futureDay = (currentDay + offset) % 7;
      const futureDaySchedules = buildDaySchedules(
        data,
        futureDay,
        now,
        offset,
      ).sort((a, b) => a.start.getTime() - b.start.getTime());

      if (futureDaySchedules.length > 0) {
        return {
          currentClass: current,
          nextClass: futureDaySchedules[0],
          nextClassDayLabel: offset === 1 ? "Tomorrow" : DAY_NAMES[futureDay],
          todayHasClasses: todaySchedules.length > 0,
          remainingTodayCount: 0,
        };
      }
    }

    return {
      currentClass: current,
      nextClass: null,
      nextClassDayLabel: null,
      todayHasClasses: todaySchedules.length > 0,
      remainingTodayCount: 0,
    };
  }, [data, now, currentDay]);

  const currentProgress = useMemo(() => {
    if (!currentClass) return 0;
    const total = currentClass.end.getTime() - currentClass.start.getTime();
    if (total <= 0) return 0;
    const elapsed = now.getTime() - currentClass.start.getTime();
    return Math.max(0, Math.min(1, elapsed / total));
  }, [currentClass, now]);

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading: isLoading || isFetching,
  });

  if (isError)
    return (
      <ErrorComponent
        message={getApiErrorMessage(error)}
        onRetry={() => refetch()}
      />
    );

  if (status.phase === "offline-empty")
    return <OfflineEmpty section="schedule" />;

  if (status.phase === "loading") return <ScheduleSkeleton />;

  const endsInText = currentClass
    ? formatCountdown(currentClass.end, now)
    : null;
  const startsInText =
    nextClass && !nextClassDayLabel
      ? formatCountdown(nextClass.start, now)
      : null;

  const emptyLeft = (() => {
    if (nextClass && !nextClassDayLabel) {
      return {
        label: "Free Now",
        title: `${formatCountdown(nextClass.start, now)} until next class`,
      };
    }
    if (todayHasClasses) {
      return { label: "All Done", title: "No more classes today" };
    }
    return { label: "Free Day", title: "No classes today" };
  })();

  return (
    <View>
      <View className="flex-row gap-3 items-stretch">
        {/* Left Card */}
        {currentClass ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Current class: ${currentClass.subject.subjectId.subjectName}`}
            android_ripple={{
              color: "rgba(255,255,255,0.12)",
              borderless: false,
            }}
            className="flex-1 rounded-2xl overflow-hidden active:opacity-90 min-h-[180px]"
            onPress={() => router.push(`/course/${currentClass.subject.id}`)}
          >
            <LinearGradient
              colors={["#2563eb", "#1e3a8a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                padding: 20,
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  right: -28,
                  bottom: -28,
                  opacity: 0.1,
                }}
                pointerEvents="none"
              >
                <Icon
                  name="BookOpenIcon"
                  size={150}
                  color="#ffffff"
                  weight="fill"
                />
              </View>

              <View className="flex-row items-center gap-2">
                <MotiView
                  from={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: 0.4, scale: 1.5 }}
                  transition={{
                    type: "timing",
                    duration: 1100,
                    loop: true,
                    repeatReverse: true,
                  }}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#ffffff",
                  }}
                />
                <AppText
                  weight="bold"
                  className="uppercase text-[11px] tracking-widest text-accent-foreground/85"
                >
                  In Session
                </AppText>
              </View>

              <View className="flex-1 justify-center">
                <AppText
                  weight="bold"
                  className="text-[15px] leading-5 text-accent-foreground"
                  numberOfLines={2}
                >
                  {currentClass.subject.subjectId.subjectName}
                </AppText>
              </View>

              <View>
                <View className="rounded-xl px-3 py-2 self-start bg-white/20">
                  <AppText
                    weight="bold"
                    className="text-xs text-accent-foreground"
                    numberOfLines={1}
                  >
                    Ends in {endsInText}
                    {currentClass.subject.subjectId.roomNumber
                      ? ` · ${currentClass.subject.subjectId.roomNumber}`
                      : ""}
                  </AppText>
                </View>
                <View className="mt-3 h-1 rounded-full bg-white/20 overflow-hidden">
                  <View
                    className="h-full bg-white/90"
                    style={{ width: `${currentProgress * 100}%` }}
                  />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={emptyLeft.label}
            android_ripple={{
              color: "rgba(0,0,0,0.05)",
              borderless: false,
            }}
            className="flex-1 rounded-2xl border-2 border-border p-4 justify-center min-h-[150px] active:opacity-70 gap-1.5"
            onPress={() => router.push("/(main)/profile/class-schedule")}
          >
            <AppText
              weight="bold"
              className="uppercase text-[11px] tracking-widest text-muted"
            >
              {emptyLeft.label}
            </AppText>
            <AppText
              weight="bold"
              className="text-[15px] leading-5 text-foreground"
              numberOfLines={2}
            >
              {emptyLeft.title}
            </AppText>
          </Pressable>
        )}

        {/* Right Card — Upcoming */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            nextClass
              ? `Up next: ${nextClass.subject.subjectId.subjectName}`
              : "No upcoming classes"
          }
          android_ripple={{
            color: "rgba(0,0,0,0.05)",
            borderless: false,
          }}
          className={`flex-1 rounded-2xl p-5 justify-between border border-border active:opacity-80 overflow-hidden ${
            currentClass ? "min-h-[180px]" : "min-h-[150px]"
          } ${nextClass ? "bg-accent-soft" : "bg-surface-secondary"}`}
          onPress={() =>
            nextClass
              ? router.push(`/course/${nextClass.subject.id}`)
              : router.push("/(main)/profile/class-schedule")
          }
        >
          {nextClass && (
            <View
              style={{
                position: "absolute",
                right: -28,
                bottom: -28,
                opacity: 0.08,
              }}
              pointerEvents="none"
            >
              <Icon
                name="BookOpenIcon"
                size={140}
                color="#2563eb"
                weight="fill"
              />
            </View>
          )}

          <View className="flex-row items-center gap-1.5">
            {nextClass && nextClassDayLabel ? (
              <View className="bg-accent rounded-md px-1.5 py-0.5">
                <AppText
                  weight="bold"
                  className="text-[10px] uppercase tracking-wider text-accent-foreground"
                >
                  {nextClassDayLabel}
                </AppText>
              </View>
            ) : null}
            <AppText
              weight="bold"
              className={`uppercase text-[11px] tracking-widest ${
                nextClass ? "text-accent" : "text-muted"
              }`}
            >
              Up Next
              {nextClass && !nextClassDayLabel ? " · Today" : ""}
            </AppText>
          </View>

          <View className="flex-1 justify-center">
            <AppText
              weight="bold"
              className={`text-[15px] leading-5 ${
                nextClass ? "text-foreground" : "text-muted"
              }`}
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
            className={`rounded-xl px-3 py-2 self-start ${
              nextClass ? "bg-surface" : "bg-default"
            }`}
          >
            <AppText
              weight="bold"
              className={`text-xs ${nextClass ? "text-accent" : "text-muted"}`}
              numberOfLines={2}
            >
              {nextClass
                ? startsInText
                  ? `Starts in ${startsInText}${
                      nextClass.subject.subjectId.roomNumber
                        ? ` · ${nextClass.subject.subjectId.roomNumber}`
                        : ""
                    }`
                  : `${formatTime(nextClass.scheduleStartTime)}${
                      nextClass.subject.subjectId.roomNumber
                        ? ` · ${nextClass.subject.subjectId.roomNumber}`
                        : ""
                    }`
                : "Rest & recharge"}
            </AppText>
          </View>
        </Pressable>
      </View>

      {remainingTodayCount > 0 && (
        <Pressable
          onPress={() => router.push("/(main)/profile/class-schedule")}
          accessibilityRole="button"
          accessibilityLabel={`${remainingTodayCount} more classes today`}
          className="mt-2 self-end active:opacity-60"
        >
          <AppText weight="semibold" className="text-xs text-muted">
            +{remainingTodayCount} more{" "}
            {remainingTodayCount === 1 ? "class" : "classes"} today
          </AppText>
        </Pressable>
      )}
    </View>
  );
};

const ScheduleSkeleton = () => (
  <View className="flex-row gap-3">
    {[0, 1].map((i) => (
      <View
        key={i}
        className="flex-1 rounded-2xl p-5 justify-between bg-surface-secondary min-h-[180px]"
      >
        <Skeleton className="h-3 w-12 rounded" />
        <View className="flex-1 justify-center gap-1.5">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </View>
        <Skeleton className="h-6 w-28 rounded-xl" />
      </View>
    ))}
  </View>
);

export default ScheduleComponent;
