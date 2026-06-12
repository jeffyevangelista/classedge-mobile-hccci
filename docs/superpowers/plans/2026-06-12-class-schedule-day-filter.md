# Class Schedule Day-Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-subjects card list in `ClassScheduleList` with a sticky 7-day strip + a day-filtered list of time-block cards (today selected by default). Spec: [docs/superpowers/specs/2026-06-12-class-schedule-day-filter-design.md](../specs/2026-06-12-class-schedule-day-filter-design.md).

**Architecture:** Single-file rewrite of `features/profile/components/ClassScheduleList.tsx`. The `useClassSchedule` PowerSync watch hook stays unchanged. Inside the component we add a `selectedDay` state seeded to today, fold the existing `data` (enrollment → schedules) into a flat `DayItem[]` for the selected day plus a `daysWithClasses` `Set` for strip dots — both computed in one memoized pass. The list switches from "one card per subject with chips" to "one card per time-block on the selected day" with the subject day-chips removed (the strip already conveys that information). A new `WeekStrip` is rendered as the list's `ListHeaderComponent` with `stickyHeaderIndices={[0]}` on the underlying `FlashList`.

**Tech Stack:** React Native, Expo Router, `@powersync/react-native` watch query, `@shopify/flash-list` (under `ScreenList`), `heroui-native` (`Card`, `Skeleton`), `phosphor-react-native` icons via `<Icon>`, NativeWind/Uniwind for Tailwind classes, Poppins via `<AppText>`.

**Repo conventions honored:**
- Typecheck via `npm run typecheck` (= `tsc --noEmit`).
- No automated tests — the change is presentational and the spec opts out. Verification is visual on a real device or simulator.
- Staging and committing left to the user per project preference (`feedback_no_auto_commit.md`). The plan ends with a working tree ready for review.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `features/profile/components/ClassScheduleList.tsx` | Rewrite in place | Day strip + day-filtered time-block list + skeleton + empty state |

Nothing else is touched. `screens/profile/ClassScheduleScreen.tsx` and `app/(main)/profile/class-schedule.tsx` already render this component without prop changes.

---

### Task 1: Rewrite `ClassScheduleList.tsx` end-to-end

**Files:**
- Modify: `features/profile/components/ClassScheduleList.tsx` (whole-file replace)

**Context:** The current file (~310 LOC) sorts enrolled subjects with today first, renders one `Card` per subject with day chips and a "Today" badge. The new file flips the model: pick a day in the strip, see only that day's time blocks. Because the change touches every render branch (header, list data, item, empty, skeleton), splitting into smaller commits would leave intermediate states with dangling unused symbols or a half-converted UI. The cleanest unit of change is the whole file.

Every helper, prop type, and identifier used below is already present in the codebase:
- `Icon`'s `IconName` is `keyof typeof PhosphorIcons` (`components/Icon.tsx`), so `UserIcon`, `MapPinIcon`, `CaretRightIcon`, `CalendarBlankIcon` are all valid string names.
- `EmptyState` accepts `{ icon: IconName; title: string; description?: string }`.
- `ScreenList` is a thin wrapper around `FlashList<T>` and forwards arbitrary props (including `stickyHeaderIndices`).
- `formatTime` lives at `features/calendar/components/date-formatter` and `getApiErrorMessage` at `lib/api-error` — both already imported by the current file.
- `useClassSchedule` returns `{ data, isLoading, isFetching, isError, error, refetch, isRefetching }`.
- `toTitleCase` lives at `utils/toTitleCase`.

- [ ] **Step 1: Open `features/profile/components/ClassScheduleList.tsx` and replace its entire contents**

Paste exactly:

```tsx
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
    <ScreenList
      className="mx-auto w-full max-w-3xl"
      stickyHeaderIndices={[0]}
      refreshControl={
        <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
      }
      ListHeaderComponent={
        <WeekStrip
          selectedDay={selectedDay}
          todayShort={todayShort}
          daysWithClasses={daysWithClasses}
          onSelect={setSelectedDay}
          summary={summary}
        />
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
            item.subjectId && router.push(`/course/${item.subjectId}`)
          }
        />
      )}
      data={dayItems}
    />
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
  const showTodayRing = isToday && !isSelected;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Show schedule for ${DAY_NAMES_LONG[DAY_NAMES.indexOf(day)]}`}
      accessibilityState={{ selected: isSelected }}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className={`flex-1 items-center justify-center py-2.5 rounded-xl border ${
        isSelected
          ? "bg-accent border-accent"
          : "bg-surface border-border"
      }`}
    >
      <AppText
        weight="semibold"
        className={`text-[11px] uppercase tracking-wider ${
          isSelected ? "text-accent-foreground" : "text-muted"
        }`}
      >
        {day}
      </AppText>
      <View
        className={`mt-1 w-1 h-1 rounded-full ${
          hasClasses
            ? isSelected
              ? "bg-accent-foreground"
              : "bg-muted"
            : "bg-transparent"
        }`}
      />
      {showTodayRing ? (
        <View
          pointerEvents="none"
          className="absolute -inset-[3px] rounded-[14px] border-[1.5px] border-accent"
        />
      ) : null}
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors related to `features/profile/components/ClassScheduleList.tsx`. Pre-existing errors elsewhere in the repo, if any, are out of scope — only watch for new ones introduced by this edit.

If `stickyHeaderIndices` flags a type error on `ScreenList`, confirm it: `ScreenList` spreads its props onto `FlashList` (`components/ScreenList.tsx`), which accepts `stickyHeaderIndices: number[]`. If TS complains because `ScreenList`'s generic doesn't surface it, prefer adding `stickyHeaderIndices?: number[]` to the `ScreenList` props extension over working around it at the call site.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new biome warnings for the file. The previous implementation's `subjectHasToday`, `sortByStartTime`, and `sortDays` helpers are gone; biome should not flag the rewrite. If it does, address the specific complaints — do not blanket-ignore.

---

### Task 2: Visual verification on device

**Files:** none (manual check)

**Context:** The spec opts out of automated tests. This is a behavioral check against the spec's verification list.

- [ ] **Step 1: Start the dev build**

Run: `npm run start` (or `APP_VARIANT=development npm run start:dev` depending on your local setup).
Open the app on a real iOS device and a real Android device (a simulator is acceptable if hardware isn't available, but stickiness and ring overlay should be eyeballed on both platforms).

- [ ] **Step 2: Log in as a student with enrolled subjects and open Profile → Class Schedule**

Confirm against the spec's verification checklist:

| Check | Expected |
|---|---|
| Strip renders 7 pills (Sun → Sat) and is pinned to the top of the scroll viewport when scrolling the list. | Pass |
| Today's pill is selected on first open. Its label uses the accent-foreground color and the pill is filled with `bg-accent`. | Pass |
| Days with at least one schedule across enrolled subjects show a small dot below the day label. | Pass |
| Empty days show no dot. | Pass |
| Summary line under the strip reads "You have N class(es) today" when Today is selected and the list has items. | Pass |
| Tap another day with classes → list re-renders to that day's time blocks. Summary reads "N class(es) on *Dayname*". Today's pill (now unselected) shows a 1.5px accent ring around it. | Pass |
| Tap an empty day → list shows `EmptyState` with day-scoped title ("No classes on Sunday") and "Tap a day with a dot..." description. The summary line disappears. | Pass |
| Pull-to-refresh → `RefreshIndicator` spins, PowerSync `refetch` runs. | Pass |
| Tap any card → navigates to `/course/[subjectId]`. | Pass |
| Background the app from a non-today day, return — `selectedDay` stays where the user left it; today's ring still tracks the real day (verify by checking `Date#getDay()` lines up with which pill has the ring). | Pass |
| Skeleton: open the screen before PowerSync resolves (slow network or first cold boot) — the seven Skeleton pills appear immediately and 3 placeholder cards render below. | Pass |

- [ ] **Step 3: Decide — ship or iterate**

If anything in the checklist regresses, capture the platform + repro steps. Most likely places the visual can drift:
- `bg-accent-foreground` may render too low-contrast against `bg-accent` on the active theme; if so, swap the dot color to a literal high-contrast value via Uniwind (e.g. `bg-white`).
- The today-ring overlay's `-inset-[3px]` might clip behind a parent's `overflow-hidden`. If clipped, drop `overflow-hidden` on the `Pressable` (the ripple visual will still be acceptable without it).

---

### Final step: Hand back to the user for staging and commit

The working tree is ready for review. The user reviews `git diff features/profile/components/ClassScheduleList.tsx`, stages, and commits per their normal flow (`feedback_no_auto_commit.md`).

---

## Self-Review

**Spec coverage check (against `2026-06-12-class-schedule-day-filter-design.md`):**

| Spec section | Plan coverage |
|---|---|
| §1 Selected-day state (`selectedDay` seeded to today, not re-synced) | Task 1 — `selectedDay` `useState` + the existing focus/foreground listener only mutates `todayShort` |
| §2 Sticky week strip — 7 pills, dots, today ring, selected fill, stickyHeaderIndices | Task 1 — `WeekStrip` + `DayPill` + `stickyHeaderIndices={[0]}` |
| §3 Day-derived list data — `DayItem`, memoized fold, `daysWithClasses` set, start-time sort | Task 1 — `useMemo` block returns `{ dayItems, daysWithClasses }` with a single pass |
| §4 Time-block card — time label, subject, teacher, room; chips and badge removed | Task 1 — `TimeBlockCard` with no `Chip` import |
| §5 Header summary copy (today / other day / none) | Task 1 — `summary` string passed into `WeekStrip` |
| §6 Empty-day state — day-scoped title, "Tap a day with a dot…" description | Task 1 — `ListEmptyComponent` |
| §7 Skeleton — seven pills + 3 placeholder cards in the new card shape | Task 1 — `ClassScheduleSkeleton` rewritten |
| §8 Error state — unchanged | Task 1 — `ErrorComponent` path retained |
| "What stays the same" — route, screen, hook, refresh, focus/foreground listener, tap → /course/[id] | Task 1 leaves all of these intact |
| Edge cases — empty `daysOfWeek`, multi-day CSV, two blocks/day, missing start/end, no teacher/room, empty day, background-cross-midnight, zero enrollments, loading, error | Memoized fold filters by trimmed CSV; `formatTimeRange` returns "N/A"; teacher/room null-coalesce to existing copy; empty path uses scoped `EmptyState`; `selectedDay` independence keeps the cross-midnight behavior |
| Verification list (9 items) | Task 2 — all 9 in the checklist table |

No spec requirement is unaddressed.

**Placeholder scan:** No "TBD", "TODO", "fill in later", "similar to Task N", or "appropriate error handling" stand-ins. Every code change is shown verbatim.

**Type/symbol consistency:**
- `DayShort` is defined once (Task 1) and used throughout (`selectedDay`, `todayShort`, `daysWithClasses: Set<DayShort>`, `DayPill` props, `WeekStrip` props).
- `DayItem` is defined once and consumed by `TimeBlockCard` and the `keyExtractor`.
- `MetaRow` props use the wide `IconName` type from `components/Icon.tsx` — `UserIcon` and `MapPinIcon` are both members of `keyof typeof PhosphorIcons` and require no Icon-component changes.
- `useClassSchedule`'s return shape (`data, isLoading, isFetching, isError, error, refetch, isRefetching`) matches what the new render path destructures.
- No symbol is referenced before it's introduced; `formatTimeRange` and `safeFormatTime` are declared above their first call site.
