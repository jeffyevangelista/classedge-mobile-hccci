# Class Schedule — Day-Filter View

**Date:** 2026-06-12
**Status:** Design — pending implementation plan
**Touches:** `features/profile/components/ClassScheduleList.tsx`, `screens/profile/ClassScheduleScreen.tsx`

## Goal

Replace the current "all-subjects, today highlighted" card list with a **day-filtered** view: a sticky week strip of seven day pills at the top, and a list of time-block cards for the selected day below. Today is selected on open. The week strip is always visible and is the only control the user needs.

The intent is to match the mental model students bring to this screen ("what's happening today / what's tomorrow look like?") more directly than the current scroll-the-whole-week layout, while keeping the card density and visual language consistent with the rest of the app.

## Non-goals

- No new view modes (no weekly grid, no agenda/timeline view, no calendar export). Day pills are the only selector.
- No data-model change. `course_subjectenrollment` + `subject_schedule` PowerSync tables stay as-is, and `getStudentCourseSchedules` keeps its current shape.
- No teacher photo, syllabus link, attendance indicator, or "next class in 12 minutes" countdown — none of those exist today and they're not in scope.
- No theming or color-token changes. The redesign uses the existing `accent`, `border`, `muted`, `foreground` tokens.
- No course-detail navigation change — tapping a card still goes to `/course/[subjectId]` (kept from the current implementation).
- No bugfix work in this spec. Schedule bugs the user wants to address will get a separate spec/plan after this lands.

## What changes

All changes are inside `features/profile/components/ClassScheduleList.tsx`. `ClassScheduleScreen.tsx` continues to wrap it in `<Screen withPadding>` and is not touched.

### 1. Selected-day state

A single `selectedDay` state of type `DayShort` (the same `"Sun"|"Mon"|...|"Sat"` shape `DAY_NAMES` already defines).

```tsx
const [selectedDay, setSelectedDay] = useState<DayShort>(
  () => DAY_NAMES[new Date().getDay()],
);
```

The existing `todayShort` state + `useFocusEffect` + `AppState` listener stay — they keep "today" current for the *ring indicator* on the today pill, not for filtering. `selectedDay` is initialized to today on mount but is **not** re-synced on focus or foreground (otherwise tapping Wed and backgrounding the app would silently snap back to today).

### 2. Sticky week strip

A new `WeekStrip` component rendered as `ListHeaderComponent` of the existing `ScreenList`.

- 7-column `flex-row` grid, `gap-1.5`, child pills `flex-1`.
- Each pill is a `Pressable` showing the day abbreviation and a 4px dot below it. The dot is rendered only when that day has at least one schedule across all enrolled subjects (`daysWithClasses` set computed once per render). On empty days the dot slot is reserved with `bg-transparent` so pill heights don't jitter.
- **Selected** pill: `bg-accent`, `border-accent`, label `text-accent-foreground`, dot `bg-accent-foreground`.
- **Today** pill (when not selected): 1.5px `border-accent` ring drawn via an absolute-positioned overlay so it sits outside the pill border without affecting layout.
- **Today** pill (when also selected): no ring (the fill already communicates the state).
- Day label uses `AppText weight="semibold" className="text-[11px] tracking-wider uppercase"`.
- Stickiness: `ScreenList` is a thin wrapper around Shopify's `FlashList`, which accepts `stickyHeaderIndices` as a top-level prop. Pass `stickyHeaderIndices={[0]}` to `ScreenList` and keep the strip as `ListHeaderComponent`.

### 3. Day-derived list data

The list is no longer one row per enrolled subject. It's one row per **schedule block on the selected day**, flattened across enrollments.

```ts
type DayItem = {
  enrollmentId: number;       // for keying
  scheduleId: number;
  subjectId: number;
  subjectName: string;
  teacherName: string | null; // toTitleCase'd or null
  roomNumber: string | null;
  startTime: string | null;
  endTime: string | null;
};
```

Build steps inside the component body, memoized with `useMemo` on `[data, selectedDay]`:

1. For each enrollment in `data`, walk `enrollment.schedules`.
2. Keep schedules whose `daysOfWeek` CSV (split + trimmed) includes `selectedDay`.
3. Map each kept schedule into a `DayItem`.
4. Sort the resulting array by `startTime` ascending (empty/null start times sort last).

A second derived value, `daysWithClasses: Set<DayShort>`, is computed in the same `useMemo` block so the week-strip dots and the list share one pass over `data`.

### 4. Time-block card

The card is reshaped from "one card per subject" to "one card per time block".

```tsx
<Pressable
  onPress={() => router.push(`/course/${item.subjectId}`)}
  accessibilityRole="button"
  accessibilityLabel={`Open course ${item.subjectName}`}
  className="active:opacity-80 rounded-xl overflow-hidden mb-3"
>
  <Card className="shadow-none rounded-xl border border-border">
    <Card.Body className="gap-2">
      <AppText
        weight="semibold"
        className="text-xs uppercase tracking-wider text-accent"
      >
        {timeLabel}                {/* "8:00 AM – 9:30 AM" or "N/A" */}
      </AppText>
      <AppText weight="semibold" className="text-base text-foreground" numberOfLines={2}>
        {item.subjectName}
      </AppText>
      <View className="gap-1.5 mt-1">
        <MetaRow icon="UserIcon" value={item.teacherName ?? "No teacher assigned"} />
        <MetaRow icon="MapPinIcon" value={item.roomNumber ?? "N/A"} />
      </View>
    </Card.Body>
  </Card>
</Pressable>
```

Notes:
- Time label uses the existing `safeFormatTime` helper (preserved verbatim from the current file).
- Day chips are **gone** — they were redundant with the day strip.
- "Today" badge is gone — when Today is selected, every card in view is by definition for today.
- Card border stays `border-border` in all states. No `is-now` highlight in this iteration; the mockup-rendered accent border on the current class would require a per-minute clock subscription, which we explicitly avoided in the original code and continue to avoid.
- The teacher icon is `UserIcon`. If it isn't already in the `Icon` name union, `MetaRow`'s prop type widens to accept it.

### 5. Header summary copy

Above the card list but below the sticky strip (inside the strip's component, after the day row):

| Condition | Copy |
|---|---|
| `selectedDay === todayShort` and items > 0 | "You have *N* class(es) today" |
| `selectedDay !== todayShort` and items > 0 | "*N* class(es) on *Wednesday*" (full day name) |
| items === 0 | (nothing — the list shows its own empty state) |

Full day name lookup is a small `DAY_NAMES_LONG` array parallel to `DAY_NAMES`.

### 6. Empty-day state

When `selectedDay` resolves to zero items, the `ListEmptyComponent` renders an `EmptyState` scoped to the day:

```tsx
<EmptyState
  icon="CalendarBlankIcon"
  title={
    selectedDay === todayShort
      ? "No classes today"
      : `No classes on ${DAY_NAMES_LONG[DAY_NAMES.indexOf(selectedDay)]}`
  }
  description="Tap a day with a dot to see its schedule."
/>
```

The "no enrollments at all" state (i.e. `data` is `[]` after loading) collapses into the same empty layout — no separate copy.

### 7. Skeleton

The existing `ClassScheduleSkeleton` is reshaped to match the new card. Specifically:

- Replace the "subject + today badge" header row with a single short skeleton bar (time label).
- Replace the "schedule block" + "day chips" rows with two MetaRow skeletons (teacher, room).
- The week strip above is rendered as a fixed row of seven equal `Skeleton` pills so the strip appears immediately.

### 8. Error state

Unchanged. `ErrorComponent` with `message={getApiErrorMessage(error)}` and `onRetry={refetch}` — same as today.

## What stays the same

- Route, screen file, and screen wrapper. `app/(main)/profile/class-schedule.tsx` → `ClassScheduleScreen` → `<Screen withPadding><ClassScheduleList /></Screen>`.
- The `useClassSchedule` hook, `getStudentCourseSchedules` query, schema. All PowerSync watching semantics carry over for free.
- `RefreshIndicator` pull-to-refresh wired to `refetch` / `isRefetching`.
- `today`-day recomputation on focus + AppState foreground transition.
- Sort tiebreaker: by `startTime` ascending across the day's items.
- Tap navigation: `/course/[subjectId]`.
- All other files under `features/profile/`.

## Edge cases

| Case | Behavior |
|---|---|
| Schedule has empty `daysOfWeek` | Excluded from every day's list and from `daysWithClasses`. (Today's code already handles this with `?.split` chaining.) |
| Schedule has `daysOfWeek="Mon,Wed,Fri"` | Appears on Mon, Wed, Fri lists. Same time block each day. |
| Two schedule rows for one subject on the same day (e.g., a morning lecture + afternoon lab both on Wednesday) | Two cards stack in the Wednesday list, sorted by start time. Tapping either goes to the same `/course/[subjectId]`. |
| Schedule has missing start or end time | `timeLabel` falls back to `"N/A"` (existing `safeFormatTime` returns null; the `&&` collapses to `"N/A"`). The card still renders and is sortable to the end. |
| Subject has no teacher assigned | Meta row reads "No teacher assigned" (existing copy). |
| Subject has no room | Meta row reads "N/A" (existing copy). |
| User opens the screen on a day with no classes (e.g. Sunday) | Today pill is selected by default; list renders the empty state scoped to today; strip dots show which days do have classes — one tap away. |
| User backgrounds the app for hours then returns mid-day | Today pill ring updates via the existing `AppState` listener, but `selectedDay` does **not** auto-snap. If the user was viewing Wed before backgrounding, Wed stays selected on return. |
| Crossing midnight while the screen is open | Same as above: ring moves to the new day, selection stays where the user put it. |
| Refresh resolves to zero enrollments (e.g. between terms) | Week strip renders with no dots, every day shows the empty state. No special "no enrolled subjects" copy. |
| Data still loading after auth (`isLoading || isFetching` and no `data`) | `ClassScheduleSkeleton` (new shape) renders. Existing logic preserved. |
| Error after retry | `ErrorComponent` with retry. Unchanged. |

## File map

- `features/profile/components/ClassScheduleList.tsx` — the entire file is rewritten in place: new `WeekStrip`, new derived `DayItem[]`, new card shape, new skeleton, new empty/summary copy.
- `screens/profile/ClassScheduleScreen.tsx` — unchanged.
- `app/(main)/profile/class-schedule.tsx` — unchanged.

No new files. No new exports. No changes outside `features/profile/components/ClassScheduleList.tsx`.

## Verification

This is presentational + interaction work on a single screen, so verification is visual and behavioral, not a test suite.

1. Run the app on a phone (or simulator), log in as a student with at least one enrolled subject.
2. Open Profile → Class Schedule.
3. Confirm: today's pill is selected and ringed (selected fill, no separate ring); other pills with classes show a small dot; the title summary reads "You have N class(es) today".
4. Tap a different day with classes — list re-renders to that day's blocks, summary copy switches to "N class(es) on *Dayname*", today's pill still shows its ring (now visible because it's no longer the selected fill).
5. Tap an empty day — list shows the day-scoped empty state, no summary line.
6. Pull-to-refresh — `RefreshIndicator` spins, PowerSync `refetch` runs, list updates.
7. Tap any card — navigates to `/course/[subjectId]`.
8. Background the app on a non-today day, return — selected day stays put, today ring still tracks the real day.
9. iOS and Android both render the strip and ring overlay cleanly (the ring is a single absolute View with a border, which is robust on both).

## Open questions

None. Visual + interaction decisions made during brainstorming (default-to-today, sticky week strip, dots for "has classes", no current-class highlight) are reflected above.
