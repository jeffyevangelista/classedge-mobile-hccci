# Reactive `useClassroom` Hook for ClassroomScreen

**Date:** 2026-05-15
**Scope:** `screens/main/classroom/ClassroomScreen.tsx` and `features/classroom/classroom.hooks.ts`

## Goal

Replace the inline `useEffect` + one-shot Drizzle query that sets the classroom header title in `ClassroomScreen.tsx` with a reactive PowerSync hook (`useClassroom`). Narrow the `classroomId` route param via the TypeScript generic on `useLocalSearchParams`.

## Why

The current code (`ClassroomScreen.tsx:16-29`) runs `db.query.coursesTable.findFirst` once inside `useEffect` and sets the header from the result. Two problems:

1. **Not reactive.** If the row syncs an updated `subjectName` while the screen is mounted, the header stays stale until remount. The rest of this codebase uses PowerSync's `useQuery` for live data; this screen is an outlier.
2. **Untyped param.** `useLocalSearchParams` returns `string | string[]`, then `Number(classroomId)` silently produces `NaN` if the runtime value is ever an array. The neighboring `InputGradeScreen.tsx` already uses the TS generic; this screen does not.

## Non-goals

- The `ClassroomActivitiyList` typo (separate cleanup).
- Moving the "Create Activity" button out of the tab body (separate cleanup).
- Generalizing route-param narrowing into a shared utility (scope creep — 25 other files use the same pattern; standardization is its own project).
- Migrating the 25 other consumers of `useLocalSearchParams` to typed generics. This change touches only `ClassroomScreen.tsx`.

## Architecture

**Files modified:**
- `features/classroom/classroom.hooks.ts` — add `useClassroom`
- `screens/main/classroom/ClassroomScreen.tsx` — consume the hook, narrow the param, drop the inline effect

The hook follows the existing convention in this file (see `useClassroomActivity` at lines 37-44 for the closest analogue): raw SQL via `useQuery`, `parseInt` for the integer primary key, `snakeToCamel` over the result array, and the file-local `wrap()` helper for the standard return shape (`isLoading`, `isError`, `refetch`, `isRefetching`, etc.).

The `Course` type is derived locally from the Drizzle schema via `InferSelectModel<typeof coursesTable>`, matching how `StudentAssessment` is derived at line 13 of the same file.

## Implementation

### `useClassroom` hook

Added to `features/classroom/classroom.hooks.ts`. The existing import line at the top of the file (`import { studentAssessment } from "@/powersync/schema";`) is extended to include `coursesTable`; `InferSelectModel` is already imported in the file. A new local `Course` type alias is added next to the existing `StudentAssessment` alias.

After the edits, the relevant block of the file looks like:

```ts
import { studentAssessment, coursesTable } from "@/powersync/schema";
import type { InferSelectModel } from "drizzle-orm";

type StudentAssessment = InferSelectModel<typeof studentAssessment>;
type Course = InferSelectModel<typeof coursesTable>;

// ...existing hooks unchanged...

export const useClassroom = (classroomId: string) => {
  const result = useQuery(
    "SELECT * FROM subject_subject WHERE id = ? LIMIT 1",
    [parseInt(classroomId)],
  );

  return { ...wrap(result), data: snakeToCamel<Course[]>(result.data) };
};
```

The `useClassroom` hook is appended at the end of the file, after `useStudentScoresForActivity`.

**Return shape:** `{ data: Course[], isLoading, isFetching, error, isError, refetch, isRefetching }` — identical to `useClassroomActivity`.

**Why an array for a primary-key lookup:** consistent with the file's convention. `useClassroomActivity` and `useClassroomActivities` both return arrays; `data?.[0]` at the call site is six characters and matches the surrounding code. A single-row return type was considered and rejected for consistency.

### `ClassroomScreen.tsx` refactor

Replace lines 1-29 of the current file. The remainder (the tabs JSX, lines 31-78) is unchanged.

**Before** (`ClassroomScreen.tsx:1-29`):

```tsx
import { useEffect, useState } from "react";
import Screen from "@/components/screen";
import { Button, Tabs } from "heroui-native";
import LessonList from "@/features/classroom/components/LessonList";
import CourseworkList from "@/features/classroom/components/CourseworkList";
import ClassroomActivitiyList from "@/features/classroom/components/ClassroomActivitiyList";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { db } from "@/powersync/system";

const ClassroomScreen = () => {
  const [activeTab, setActiveTab] = useState("materials");
  const { classroomId } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    const fetchClassroomDetails = async () => {
      const classroom = await db.query.coursesTable.findFirst({
        where: (course, { eq }) => eq(course.id, Number(classroomId)),
        columns: { subjectName: true },
      });

      if (classroom) {
        navigation.setOptions({ headerTitle: classroom.subjectName });
      }
    };

    fetchClassroomDetails();
  }, [classroomId, navigation]);
```

**After:**

```tsx
import { useEffect, useState } from "react";
import Screen from "@/components/screen";
import { Button, Tabs } from "heroui-native";
import LessonList from "@/features/classroom/components/LessonList";
import CourseworkList from "@/features/classroom/components/CourseworkList";
import ClassroomActivitiyList from "@/features/classroom/components/ClassroomActivitiyList";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useClassroom } from "@/features/classroom/classroom.hooks";

const ClassroomScreen = () => {
  const [activeTab, setActiveTab] = useState("materials");
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const { data } = useClassroom(classroomId);
  const subjectName = data?.[0]?.subjectName;

  useEffect(() => {
    if (subjectName) {
      navigation.setOptions({ headerTitle: subjectName });
    }
  }, [subjectName, navigation]);
```

**Changes summarized:**
- Drop `db` import.
- Add `useClassroom` import.
- Generic-type `useLocalSearchParams<{ classroomId: string }>()`.
- Replace the imperative `useEffect` query with the reactive hook + a derived `subjectName`.
- New `useEffect` runs on `subjectName` change rather than on `classroomId` change.

## Behavior

| State | `data?.[0]?.subjectName` | `headerTitle` |
|---|---|---|
| Initial render (hook still loading) | `undefined` | unchanged (whatever expo-router set) |
| Row hydrated from local DB | actual value | updated to `subjectName` |
| Row's `subject_name` updates via PowerSync sync | new value | header re-renders to the new value |
| `classroomId` changes (route nav) | new row's `subjectName` | header updates |
| Row deleted or missing | `undefined` | header stays at last known value |

The "row missing" case is unchanged from current behavior — the old code's `if (classroom)` guard also did nothing on miss.

## Error handling

The hook surfaces `isError` and `error` via `wrap()`, but `ClassroomScreen` does not consume them. The screen's content (Lessons / Courseworks / RapidGrader tabs) renders independently of the header. If the classroom row fails to load, the header simply doesn't update — same end state as the current code's silent-miss behavior. No new error UI is added.

## Testing

No component test scaffolding exists for this screen. Manual smoke check:

1. Open a classroom → header shows the subject name (not blank, not stale).
2. Switch tabs → header stays correct.
3. Navigate back and into a different classroom → header updates to the new subject.
4. (If easy to simulate) Trigger a sync that updates the subject's `subject_name` → header refreshes without a screen remount.

## Open questions

None.
