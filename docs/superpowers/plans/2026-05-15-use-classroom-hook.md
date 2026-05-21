# Reactive `useClassroom` Hook for ClassroomScreen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference:** This user does NOT auto-commit. Each "Commit" step is a pause-point: print the suggested `git add` + `git commit` command but do NOT execute it. The user runs commits manually.

**Goal:** Replace the imperative `useEffect` + Drizzle query in `ClassroomScreen.tsx` with a reactive PowerSync hook (`useClassroom`) so the header title stays in sync with `subject_subject.subject_name`, and narrow the route param via the TypeScript generic on `useLocalSearchParams`.

**Architecture:** Add one hook to the existing `features/classroom/classroom.hooks.ts` that mirrors the established `useClassroomActivity` pattern (raw SQL + `snakeToCamel` + `wrap()`). Consume it from `ClassroomScreen.tsx`, dropping the inline `db` import and the imperative fetch.

**Tech Stack:** React Native + Expo Router, PowerSync (`@powersync/react-native`), Drizzle ORM (type derivation only via `InferSelectModel`).

**Spec:** `docs/superpowers/specs/2026-05-15-use-classroom-hook-design.md`

**Testing note:** This feature has no existing component-test scaffolding. Each task ends with `pnpm typecheck`. End-to-end verification is manual via Task 3.

---

## File Structure

**Modify:**
- `features/classroom/classroom.hooks.ts` — add `coursesTable` to the schema import, add a local `Course` type alias, append `useClassroom` after `useStudentScoresForActivity`.
- `screens/main/classroom/ClassroomScreen.tsx` — drop `db` import, add `useClassroom` import, type the route param, replace the imperative effect with the reactive hook + derived `subjectName`.

No new files.

---

## Task 1: Add `useClassroom` to `classroom.hooks.ts`

**Files:**
- Modify: `features/classroom/classroom.hooks.ts`

- [ ] **Step 1: Extend the schema import to include `coursesTable`**

In `features/classroom/classroom.hooks.ts`, locate line 10:

```ts
import { studentAssessment } from "@/powersync/schema";
```

Replace with:

```ts
import { studentAssessment, coursesTable } from "@/powersync/schema";
```

- [ ] **Step 2: Add the `Course` type alias next to `StudentAssessment`**

Locate line 13:

```ts
type StudentAssessment = InferSelectModel<typeof studentAssessment>;
```

Add immediately after it:

```ts
type Course = InferSelectModel<typeof coursesTable>;
```

The resulting two-line block:

```ts
type StudentAssessment = InferSelectModel<typeof studentAssessment>;
type Course = InferSelectModel<typeof coursesTable>;
```

- [ ] **Step 3: Append `useClassroom` at the end of the file**

After the existing `useStudentScoresForActivity` hook (currently ending around line 68), append:

```ts

export const useClassroom = (classroomId: string) => {
  const result = useQuery(
    "SELECT * FROM subject_subject WHERE id = ? LIMIT 1",
    [parseInt(classroomId)],
  );

  return { ...wrap(result), data: snakeToCamel<Course[]>(result.data) };
};
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS — no new errors.

- [ ] **Step 5: Commit (user runs manually)**

Print this command for the user; do not execute:

```bash
git add features/classroom/classroom.hooks.ts
git commit -m "feat(classroom): add reactive useClassroom hook"
```

---

## Task 2: Wire `useClassroom` into `ClassroomScreen.tsx`

**Files:**
- Modify: `screens/main/classroom/ClassroomScreen.tsx`

- [ ] **Step 1: Replace the imports block + the `db`-using effect**

Open `screens/main/classroom/ClassroomScreen.tsx`. Replace lines 1-29 with the block below. Lines 30 onward (the `return ( <Screen> ... )` JSX through the closing `};` and `export default`) are unchanged.

OLD (lines 1-29):

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

NEW:

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

- [ ] **Step 2: Confirm the rest of the file is unchanged**

After the edit, the file ends with the existing JSX from `return ( <Screen>` (~line 31 in the new numbering) through `export default ClassroomScreen;`. Read the file to confirm no other lines were touched.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Run biome (lint + format)**

Run: `pnpm lint`
Expected: PASS for `ClassroomScreen.tsx` and `classroom.hooks.ts`. If any unused-import error is flagged in either file from your edits, remove the unused import. Pre-existing lint errors elsewhere in the repo are not your concern.

- [ ] **Step 5: Commit (user runs manually)**

```bash
git add screens/main/classroom/ClassroomScreen.tsx
git commit -m "refactor(classroom): use reactive useClassroom for header title"
```

---

## Task 3: Manual smoke verification

**Files:** none modified — runs the app and validates behavior.

- [ ] **Step 1: Start the dev client**

Run: `pnpm start` (then launch on iOS sim, Android emulator, or device).

- [ ] **Step 2: Smoke scenarios**

Tick each as you verify:

- [ ] Open a classroom → header shows the classroom's subject name (not blank, not a numeric ID).
- [ ] Switch between Materials / Courseworks / RapidGrader tabs → header stays correct.
- [ ] Navigate back to the classroom list → tap a *different* classroom → header updates to the new subject name.
- [ ] Force-quit and reopen the app → return to the same classroom → header renders the subject name (no flicker showing an empty title for more than the initial loading moment).
- [ ] (If easy to simulate) Trigger a PowerSync update that changes the row's `subject_name` while the screen is mounted → header re-renders to the new value without a remount. This is the reactivity win — skip if you can't easily produce the update.

- [ ] **Step 3: Report any failure**

If a scenario fails, capture the console output and stop here.

---

## Self-Review Notes

**Spec coverage:**
- Goal (reactive header + param narrowing) → Task 1 (hook) + Task 2 (consumption). ✓
- Non-goals (typo, button placement, shared util, mass migration) → none of those touched. ✓
- Architecture (mirror `useClassroomActivity`, local `Course` type) → Task 1 Steps 1-3. ✓
- Implementation code (hook + screen diff) → Task 1, Task 2. ✓
- Behavior table → covered by manual smoke (Task 3). ✓
- Error handling decision (no new UI) → preserved by the Task 2 edit (no error-rendering added). ✓
- Testing → Task 3. ✓

**Type consistency:** Hook returns `{ ...wrap(result), data: Course[] }`. Screen consumes via `data?.[0]?.subjectName`. Signatures match.

**No placeholders, no "similar to Task N" deferrals.**
