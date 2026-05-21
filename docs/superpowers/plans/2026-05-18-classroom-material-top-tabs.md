# Classroom Material Top Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the HeroUI Native `Tabs` inside `ClassroomScreen.tsx` with `@react-navigation/material-top-tabs` (file-based Expo Router routes using `withLayoutContext`).

**Architecture:** Convert `app/(main)/classroom/[classroomId]/index.tsx` into a `(tabs)` route group whose `_layout.tsx` mounts a Material Top Tabs navigator. Each tab becomes its own route file. The outer Stack at `[classroomId]/_layout.tsx` still owns the header, back button, and the info-button on the right. Dynamic header title (subject name) moves from `ClassroomScreen.tsx` into the new tabs layout via `navigation.getParent()?.setOptions`.

**Tech Stack:** Expo Router 6, `@react-navigation/material-top-tabs` 7.4, `react-native-tab-view` 4.3, `react-native-pager-view` 6.9 (all already installed), HeroUI Native theme tokens via `useThemeColor`, Tailwind via Uniwind.

**Reference spec:** `docs/superpowers/specs/2026-05-18-classroom-material-top-tabs-design.md`

**Verification approach:** The project has no automated tests. Every task's verification step uses `pnpm typecheck` and `pnpm lint`. The final task is a manual verification pass on a running device/simulator.

**Working directory for all commands:** `client-mobile/`

---

## File Structure

**Create:**
- `app/(main)/classroom/[classroomId]/(tabs)/_layout.tsx` — MaterialTopTabs navigator, dynamic header title, theme-aware tab bar styling
- `app/(main)/classroom/[classroomId]/(tabs)/index.tsx` — Materials tab (default landing)
- `app/(main)/classroom/[classroomId]/(tabs)/courseworks.tsx` — Courseworks tab
- `app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx` — RapidGrader tab + Create Activity button

**Modify:**
- `app/(main)/classroom/[classroomId]/_layout.tsx` — rename `Stack.Screen name="index"` → `"(tabs)"`

**Delete:**
- `app/(main)/classroom/[classroomId]/index.tsx`
- `screens/main/classroom/ClassroomScreen.tsx`

---

## Task 1: Create the three tab route files (placeholders)

Create the three tab content files first so the navigator in Task 2 has real routes to register. Each file is self-contained and importable; they reproduce the panel bodies from the current `ClassroomScreen.tsx`.

**Files:**
- Create: `app/(main)/classroom/[classroomId]/(tabs)/index.tsx`
- Create: `app/(main)/classroom/[classroomId]/(tabs)/courseworks.tsx`
- Create: `app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx`

- [ ] **Step 1: Create the Materials tab file**

Create `app/(main)/classroom/[classroomId]/(tabs)/index.tsx`:

```tsx
import LessonList from "@/features/classroom/components/LessonList";
import Screen from "@/components/screen";

export default function MaterialsTab() {
  return (
    <Screen>
      <LessonList />
    </Screen>
  );
}
```

- [ ] **Step 2: Create the Courseworks tab file**

Create `app/(main)/classroom/[classroomId]/(tabs)/courseworks.tsx`:

```tsx
import CourseworkList from "@/features/classroom/components/CourseworkList";
import Screen from "@/components/screen";

export default function CourseworksTab() {
  return (
    <Screen>
      <CourseworkList />
    </Screen>
  );
}
```

- [ ] **Step 3: Create the RapidGrader tab file**

Create `app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx`:

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "heroui-native";
import ClassroomActivitiyList from "@/features/classroom/components/ClassroomActivitiyList";
import Screen from "@/components/screen";

export default function RapidGraderTab() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const router = useRouter();

  return (
    <Screen className="gap-2 px-2.5">
      <Button
        className="ml-auto"
        onPress={() => router.push(`/classroom/${classroomId}/create-activity`)}
      >
        <Button.Label>Create Activity</Button.Label>
      </Button>
      <ClassroomActivitiyList />
    </Screen>
  );
}
```

- [ ] **Step 4: Verify the three files typecheck**

Run from `client-mobile/`:

```bash
pnpm typecheck
```

Expected: exit code 0, no errors. Note: at this point the old `index.tsx` still exists alongside the new `(tabs)/index.tsx` — Expo Router may warn about this at runtime but it should not cause a TypeScript error. If typecheck fails, fix the reported issue before continuing.

- [ ] **Step 5: Commit**

```bash
git add "app/(main)/classroom/[classroomId]/(tabs)/index.tsx" \
        "app/(main)/classroom/[classroomId]/(tabs)/courseworks.tsx" \
        "app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx"
git commit -m "feat(classroom): scaffold material-top-tabs route files"
```

---

## Task 2: Create the `(tabs)/_layout.tsx` navigator

Wrap `createMaterialTopTabNavigator()` with Expo Router's `withLayoutContext` so the navigator picks up the three route files from Task 1. Move the `useClassroom` + dynamic header title logic from the old `ClassroomScreen.tsx` into this layout. The `navigation.getParent()?.setOptions` call propagates the title to the outer Stack header (set by `[classroomId]/_layout.tsx`).

**Files:**
- Create: `app/(main)/classroom/[classroomId]/(tabs)/_layout.tsx`

- [ ] **Step 1: Create the tabs layout file**

Create `app/(main)/classroom/[classroomId]/(tabs)/_layout.tsx`:

```tsx
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import {
  useLocalSearchParams,
  useNavigation,
  withLayoutContext,
} from "expo-router";
import { useThemeColor } from "heroui-native";
import { useEffect } from "react";
import { useClassroom } from "@/features/classroom/classroom.hooks";

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

const ClassroomTabsLayout = () => {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const navigation = useNavigation();
  const { data } = useClassroom(classroomId);
  const subjectName = data?.[0]?.subjectName;

  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const surface = useThemeColor("surface");
  const border = useThemeColor("border");

  useEffect(() => {
    if (subjectName) {
      navigation.getParent()?.setOptions({ headerTitle: subjectName });
    }
  }, [subjectName, navigation]);

  return (
    <MaterialTopTabs
      screenOptions={{
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
        tabBarIndicatorStyle: { backgroundColor: accent },
        tabBarStyle: {
          backgroundColor: surface,
          borderBottomWidth: 1,
          borderBottomColor: border,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "Poppins-Medium",
          textTransform: "none",
        },
      }}
    >
      <MaterialTopTabs.Screen name="index" options={{ title: "Materials" }} />
      <MaterialTopTabs.Screen
        name="courseworks"
        options={{ title: "Courseworks" }}
      />
      <MaterialTopTabs.Screen
        name="rapid-grader"
        options={{ title: "RapidGrader" }}
      />
    </MaterialTopTabs>
  );
};

export default ClassroomTabsLayout;
```

- [ ] **Step 2: Verify typecheck**

Run from `client-mobile/`:

```bash
pnpm typecheck
```

Expected: exit code 0. Common failure modes:
- `withLayoutContext` type mismatch with the navigator — verify the import path is exactly `expo-router`
- `useThemeColor` key names — if any of `"accent" | "muted" | "surface" | "border"` is not a valid token, the error message will list the allowed keys; pick the closest equivalent

- [ ] **Step 3: Verify lint**

```bash
pnpm lint
```

Expected: exit code 0, no errors on the new file.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/classroom/[classroomId]/(tabs)/_layout.tsx"
git commit -m "feat(classroom): add material-top-tabs layout"
```

---

## Task 3: Switch the outer Stack to point at `(tabs)`

Rename the `Stack.Screen` from `"index"` to `"(tabs)"` so the parent Stack mounts the new tabs navigator instead of the old single-screen file. The `headerRight` info-button and other screen options are unchanged.

**Files:**
- Modify: `app/(main)/classroom/[classroomId]/_layout.tsx`

- [ ] **Step 1: Edit the Stack.Screen name**

In `app/(main)/classroom/[classroomId]/_layout.tsx`, change the screen name:

Find:
```tsx
      <Stack.Screen
        name="index"
        options={{
          headerRight: ({ tintColor }) => (
```

Replace with:
```tsx
      <Stack.Screen
        name="(tabs)"
        options={{
          headerRight: ({ tintColor }) => (
```

The rest of that `<Stack.Screen>` block (the `headerRight` Pressable, the info icon, the closing brace) stays identical.

- [ ] **Step 2: Verify typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/classroom/[classroomId]/_layout.tsx"
git commit -m "refactor(classroom): route stack screen to (tabs) group"
```

---

## Task 4: Delete the old `index.tsx` and `ClassroomScreen.tsx`

Now that `(tabs)/index.tsx` is the new default route inside the group, the old `[classroomId]/index.tsx` is dead. Its only consumer was `ClassroomScreen.tsx`, whose responsibilities (header title, tab content) have been redistributed into the new tab files. Both files can be removed.

**Files:**
- Delete: `app/(main)/classroom/[classroomId]/index.tsx`
- Delete: `screens/main/classroom/ClassroomScreen.tsx`

- [ ] **Step 1: Confirm no other importers of `ClassroomScreen`**

Run from `client-mobile/`:

```bash
grep -r "ClassroomScreen" --include="*.tsx" --include="*.ts" -l . 2>/dev/null | grep -v node_modules
```

Expected output: only `screens/main/classroom/ClassroomScreen.tsx` itself and `app/(main)/classroom/[classroomId]/index.tsx`. If any other file imports `ClassroomScreen`, stop and investigate before deleting.

- [ ] **Step 2: Delete the two files**

```bash
git rm "app/(main)/classroom/[classroomId]/index.tsx" \
       "screens/main/classroom/ClassroomScreen.tsx"
```

- [ ] **Step 3: Verify typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: exit code 0. If typecheck fails citing a missing import of `ClassroomScreen`, the grep in Step 1 missed a consumer — restore the file and investigate.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(classroom): remove legacy classroom screen and index route"
```

---

## Task 5: Manual verification on device/simulator

Run the app and verify the refactor end-to-end. There are no automated tests, so this manual pass is the acceptance gate.

**Files:** none

- [ ] **Step 1: Start the dev server**

From `client-mobile/`:

```bash
pnpm start
```

Open the app on iOS Simulator, Android emulator, or a physical device with Expo Dev Client. Sign in if needed.

- [ ] **Step 2: Navigate to a classroom and verify the landing tab**

Open the Teaching tab (Teacher role) or Courses tab (Student role) and tap into a classroom.

Verify:
- Header shows the subject name (not blank, not "ClassroomScreen")
- The Materials tab is active by default
- Tab bar shows three labels: **Materials**, **Courseworks**, **RapidGrader**
- Labels are NOT uppercased
- The active tab indicator sits under "Materials"

- [ ] **Step 3: Verify tab switching by tap**

Tap each tab label in sequence. Verify:
- Active label color and indicator move to the tapped tab
- Tab content swaps to the corresponding list (LessonList → CourseworkList → ClassroomActivitiyList)

- [ ] **Step 4: Verify swipe gesture**

Swipe horizontally across the tab content area (not the tab bar). Verify pages slide via `react-native-pager-view` — this is the behavior that wasn't possible with the old HeroUI Tabs.

- [ ] **Step 5: Verify RapidGrader actions**

On the RapidGrader tab:
- "Create Activity" button is right-aligned above the activity list
- Tapping it navigates to `/classroom/[id]/create-activity` (header title "Create Activity")
- Header back button returns to the RapidGrader tab (still selected)

- [ ] **Step 6: Verify outer header actions still work**

From any tab:
- Tap the info icon (top right) → navigates to `course-details`
- Tap the back button (top left) → returns to the previous screen (Teaching/Courses list)

- [ ] **Step 7: Verify deep link / direct route**

In the app, push to `/classroom/<id>/courseworks` (use a debug navigator, or paste in a deep link). Verify the app opens directly on the Courseworks tab — proving the tabs are real URL routes.

- [ ] **Step 8: Verify input-grades route is unaffected**

From the RapidGrader tab, tap an activity that has the "Input Grades" entry point. Verify it still opens `/classroom/[id]/input-grades/[activityId]` with header title "Input Grades".

- [ ] **Step 9: If everything passes, commit a note (optional)**

No code change to commit. The previous commits are the deliverable.

---

## Self-Review Notes

Coverage check against the spec (`docs/superpowers/specs/2026-05-18-classroom-material-top-tabs-design.md`):

- **File layout** → Tasks 1, 2, 4 (create tab files, create layout, delete old)
- **`(tabs)/_layout.tsx` shape** → Task 2 (code matches spec verbatim)
- **`[classroomId]/_layout.tsx` rename** → Task 3
- **Three tab files** → Task 1 (code matches spec verbatim)
- **Deletions** → Task 4
- **Testing / verification** → Task 5 (all 8 checks from spec's verification section covered)

No placeholders, no "TODO", no forward references to undefined symbols. Identifier names (`MaterialTopTabs`, `ClassroomTabsLayout`, route names `"index" | "courseworks" | "rapid-grader"`) are consistent across Tasks 1–3.
