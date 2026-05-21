# Classroom Header Create-Action Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the "Create Activity" entry point from the RapidGrader tab content into the classroom header as a + icon that opens a HeroUI Native `Select` (single item: "Create Activity") visible on all three classroom tabs.

**Architecture:** Replace the single info-icon `Pressable` in `headerRight` of the `Stack.Screen name="(tabs)"` block (in `app/(main)/classroom/[classroomId]/_layout.tsx`) with a `View` row containing two elements: a `Select` whose `Select.Trigger` (using `variant="unstyled"`) renders a + icon, and the existing info-icon `Pressable`. Strip the now-redundant create-activity button from `(tabs)/rapid-grader.tsx`.

**Tech Stack:** Expo Router 6, HeroUI Native `Select` (variant `unstyled`, presentation `popover`), Phosphor `PlusIcon`, Tailwind via Uniwind. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-19-classroom-header-create-action-design.md`

**Verification approach:** The project has no automated tests. Every task's verification uses `pnpm typecheck`. The final task is a manual verification pass on a device/simulator.

**Working directory for all commands:** `client-mobile/`

---

## File Structure

**Modify:**
- `app/(main)/classroom/[classroomId]/_layout.tsx` — replace `headerRight` with a row of Select + info icon
- `app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx` — strip the Create Activity button and its dependencies

**No new files. No deletions.**

---

## Task 1: Replace `headerRight` with Select + info row

Update the outer Stack layout so the `(tabs)` screen renders a + Select trigger and the existing info button side-by-side. Selecting "Create Activity" pushes to `/(main)/classroom/[classroomId]/create-activity`. The info icon's behavior is unchanged.

**Files:**
- Modify: `app/(main)/classroom/[classroomId]/_layout.tsx`

- [ ] **Step 1: Replace the file contents**

Open `app/(main)/classroom/[classroomId]/_layout.tsx` and replace its full contents with:

```tsx
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import BackButton from "@/components/BackButton";
import { Platform, Pressable, View } from "react-native";
import { Select } from "heroui-native";
import { Icon } from "@/components/Icon";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";
import { useClassroom } from "@/features/classroom/classroom.hooks";

const ClassroomLayout = () => {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const router = useRouter();
  const headerOptions = useThemedHeaderOptions();
  const { data } = useClassroom(classroomId);
  const subjectName = data?.[0]?.subjectName ?? "";

  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerTitle: "",
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{
          headerTitle: subjectName,
          headerRight: ({ tintColor }) => (
            <View className="flex-row items-center gap-1">
              <Select
                onValueChange={(v) => {
                  const value = Array.isArray(v) ? v[0]?.value : v?.value;
                  if (value === "activity") {
                    router.push(
                      `/(main)/classroom/${classroomId}/create-activity`,
                    );
                  }
                }}
              >
                <Select.Trigger
                  variant="unstyled"
                  className="w-9 h-9 rounded-full justify-center items-center"
                >
                  <Icon name="PlusIcon" color={tintColor} />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="popover">
                    <Select.Item value="activity" label="Create Activity" />
                  </Select.Content>
                </Select.Portal>
              </Select>
              <Pressable
                onPress={() =>
                  router.push(
                    `/(main)/classroom/${classroomId}/course-details`,
                  )
                }
                className="w-9 h-9 rounded-full flex justify-center items-center"
              >
                <Icon
                  name="InfoIcon"
                  color={tintColor}
                  style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="create-activity"
        options={{
          headerTitle: "Create Activity",
        }}
      />
      <Stack.Screen
        name="input-grades/[activityId]"
        options={{
          headerTitle: "Input Grades",
        }}
      />
      <Stack.Screen name="course-details" />
    </Stack>
  );
};

export default ClassroomLayout;
```

Key points:
- `Select.Trigger variant="unstyled"` skips the default input-field chrome so only the + icon renders.
- `onValueChange` typing: HeroUI Native passes either a single `{ value, label }` object or an array; the destructure handles both shapes safely.
- The Select has no controlled `value` prop — it's used as an action menu, not a persistent selection.
- The info-icon `Pressable` block is identical to the previous implementation; only its container changed.

- [ ] **Step 2: Verify typecheck**

Run from `client-mobile/`:

```bash
pnpm typecheck
```

Expected: exit code 0, no errors. Common failure modes:
- `Select` not exported from `heroui-native` — confirm the import line. Existing usage in `screens/profile/AcademicRecordsScreen.tsx:15` proves the export exists.
- `onValueChange` parameter type mismatch — if TS complains, replace the body with `(v: unknown) => { ... }` and refine with a type guard, but the current shape should infer cleanly because we don't pass `value`.
- `variant="unstyled"` not a valid prop — fallback: keep `variant="default"` and pass `className="border-0 bg-transparent px-0 w-9 h-9 justify-center items-center"` to flatten the chrome.

- [ ] **Step 3: Verify lint**

```bash
pnpm lint
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/classroom/[classroomId]/_layout.tsx"
git commit -m "feat(classroom): add header create-action select"
```

---

## Task 2: Strip the Create Activity button from `rapid-grader.tsx`

Now that the header owns the entry point, remove the in-tab button and its dependencies. The RapidGrader tab body becomes the activity list only.

**Files:**
- Modify: `app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx`

- [ ] **Step 1: Replace the file contents**

Open `app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx` and replace its full contents with:

```tsx
import Screen from "@/components/screen";
import ClassroomActivitiyList from "@/features/classroom/components/ClassroomActivitiyList";

export default function RapidGraderTab() {
  return (
    <Screen>
      <ClassroomActivitiyList />
    </Screen>
  );
}
```

Removed: `useGlobalSearchParams`, `useRouter`, `Button` imports; the `gap-2 px-2.5` className; the entire `<Button>` block.

- [ ] **Step 2: Verify typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx"
git commit -m "refactor(classroom): drop in-tab create activity button"
```

---

## Task 3: Manual verification on device/simulator

There are no automated tests for header chrome or navigation. This pass is the acceptance gate.

**Files:** none

- [ ] **Step 1: Start the dev server**

From `client-mobile/`:

```bash
pnpm start
```

Open on iOS Simulator, Android emulator, or a physical device with Expo Dev Client.

- [ ] **Step 2: Open a classroom and verify the header**

Navigate from Teaching/Courses → tap a classroom.

Verify:
- Header shows subject name (left side, after back button)
- Header right shows **two icons in a row**: + (plus) on the left, info (i) on the right
- + icon has no visible border, background, or input-style chrome
- Info icon's position and size match its pre-change appearance

- [ ] **Step 3: Verify the + button opens the Select**

Tap the +.

Verify:
- A popover opens anchored near the + icon
- Popover contains one item: **Create Activity**

- [ ] **Step 4: Verify selecting the item navigates**

Tap **Create Activity**.

Verify:
- Popover closes
- App navigates to `/classroom/[id]/create-activity`
- Header title becomes "Create Activity"
- Back button returns to the classroom (whichever tab was active)

- [ ] **Step 5: Verify info icon still works**

Back on the classroom, tap the info icon.

Verify:
- Navigates to `course-details`
- Back returns to the classroom

- [ ] **Step 6: Verify visibility across tabs**

Switch to Materials, then Courseworks, then RapidGrader.

Verify:
- + and info icons appear in the header on **every** tab
- RapidGrader tab no longer shows the old "Create Activity" button above the activity list — the activity list starts at the top of the screen

- [ ] **Step 7: Verify dismissing the popover**

Tap +, then tap outside the popover (on the activity list or another area of the screen).

Verify:
- Popover closes
- No navigation occurs

---

## Self-Review Notes

Coverage check against the spec (`docs/superpowers/specs/2026-05-19-classroom-header-create-action-design.md`):

- **`[classroomId]/_layout.tsx` headerRight refactor** → Task 1
- **Single Select item: "Create Activity"** → Task 1 (`<Select.Item value="activity" label="Create Activity" />`)
- **Visible on all three tabs** → Task 1 (headerRight is on the `(tabs)` Stack.Screen) + Task 3 Step 6
- **`(tabs)/rapid-grader.tsx` strip** → Task 2
- **HeroUI Trigger styling risk** → Task 1 Step 2 has a documented fallback (`variant="default"` + className flatten)

No placeholders, no "TODO", no forward references to undefined symbols. The Select uses the documented `variant="unstyled"` from `node_modules/heroui-native/src/components/select/select.md` — a real export, not invented.
