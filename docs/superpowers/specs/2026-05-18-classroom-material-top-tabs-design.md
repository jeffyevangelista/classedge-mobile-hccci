# Classroom Material Top Tabs — Design

**Date:** 2026-05-18
**Scope:** Replace HeroUI Native `Tabs` in the classroom screen with `@react-navigation/material-top-tabs` (backed by `react-native-tab-view` + `react-native-pager-view`), wired as file-based Expo Router routes.

## Motivation

The classroom screen currently uses HeroUI Native's `Tabs` component rendered inside `ClassroomScreen.tsx`. Switching to `@react-navigation/material-top-tabs` provides:
- Native swipe gestures via `react-native-pager-view`
- File-based tab routes (each tab becomes a real URL) — consistent with the rest of the Expo Router app
- One less dependency on HeroUI's tab implementation for a core navigation surface

## Current State

```
app/(main)/classroom/[classroomId]/
  _layout.tsx          ← Stack: index, create-activity, input-grades/[activityId], course-details
  index.tsx            ← renders <ClassroomScreen />
  course-details.tsx
  create-activity.tsx
  input-grades/[activityId]/

screens/main/classroom/
  ClassroomScreen.tsx  ← HeroUI <Tabs> with Materials, Courseworks, RapidGrader panels
```

`ClassroomScreen.tsx` also owns:
- `useClassroom(classroomId)` lookup
- Dynamic header title via `navigation.setOptions({ headerTitle: subjectName })`

The "Create Activity" button lives inside the RapidGrader tab content and navigates to `/classroom/[id]/create-activity`.

## Target State

### File layout

```
app/(main)/classroom/[classroomId]/
  _layout.tsx               ← Stack — Stack.Screen "index" renamed to "(tabs)"
  (tabs)/
    _layout.tsx             ← MaterialTopTabs navigator + dynamic header title
    index.tsx               ← Materials tab (LessonList)
    courseworks.tsx         ← Courseworks tab (CourseworkList)
    rapid-grader.tsx        ← RapidGrader tab (Create Activity button + ClassroomActivitiyList)
  course-details.tsx        ← unchanged
  create-activity.tsx       ← unchanged
  input-grades/[activityId]/← unchanged
```

### Deletions
- `app/(main)/classroom/[classroomId]/index.tsx`
- `screens/main/classroom/ClassroomScreen.tsx`

### Why the Materials tab is `index.tsx`

The `(tabs)` route group is invisible in URLs. Visiting `/classroom/[id]` must resolve to a default tab. The idiomatic Expo Router solution is to name the default tab's file `index.tsx`. The visible tab label remains "Materials" via `screenOptions.title`.

## Component Details

### `(tabs)/_layout.tsx`

Wraps `createMaterialTopTabNavigator()` with `withLayoutContext` so it integrates with Expo Router's file-based routing.

```tsx
import { withLayoutContext, useLocalSearchParams, useNavigation } from "expo-router";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
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
        tabBarLabelStyle: { fontFamily: "Poppins-Medium", textTransform: "none" },
      }}
    >
      <MaterialTopTabs.Screen name="index" options={{ title: "Materials" }} />
      <MaterialTopTabs.Screen name="courseworks" options={{ title: "Courseworks" }} />
      <MaterialTopTabs.Screen name="rapid-grader" options={{ title: "RapidGrader" }} />
    </MaterialTopTabs>
  );
};

export default ClassroomTabsLayout;
```

Key points:
- `navigation.getParent()?.setOptions` sets the header on the **outer Stack**, not the tabs navigator (which has no header of its own).
- Theme tokens via `useThemeColor` to match the existing `(main)/(tabs)` styling.
- `textTransform: "none"` overrides Material Top Tabs' default uppercase labels.

### `[classroomId]/_layout.tsx` edit

Single change — rename the index screen reference:

```tsx
<Stack.Screen
  name="(tabs)"      // was "index"
  options={{
    headerRight: ({ tintColor }) => (
      <Pressable onPress={() => router.push(`/(main)/classroom/${classroomId}/course-details`)} ...>
        <Icon name="InfoIcon" color={tintColor} ... />
      </Pressable>
    ),
  }}
/>
```

All other `Stack.Screen` entries (`create-activity`, `input-grades/[activityId]`, `course-details`) are unchanged.

### `(tabs)/index.tsx` — Materials

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

### `(tabs)/courseworks.tsx` — Courseworks

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

### `(tabs)/rapid-grader.tsx` — RapidGrader

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

## Data Flow

```
[classroomId]/_layout (Stack)
    └── (tabs)/_layout (MaterialTopTabs)
            ├── useClassroom(classroomId) → subjectName
            ├── effect: parent.setOptions({ headerTitle: subjectName })
            └── pager-view swipeable container
                    ├── index.tsx        (Materials)
                    ├── courseworks.tsx  (Courseworks)
                    └── rapid-grader.tsx (RapidGrader)
                              └── router.push → create-activity
```

The outer Stack still owns the header (back button, info-button on the right, dynamic title). The inner MaterialTopTabs only renders the tab bar + swipeable pages.

## Dependencies

All three already in `package.json` — no install step:
- `@react-navigation/material-top-tabs` ^7.4.27
- `react-native-tab-view` ^4.3.0
- `react-native-pager-view` 6.9.1

## Testing / Verification

Manual verification on a device:
1. Open a classroom from the teaching/courses list → header shows the subject name; Materials tab is active by default.
2. Tap the tab bar labels → active tab switches with indicator animation.
3. Swipe horizontally between tabs → pager-view gesture works.
4. RapidGrader tab → "Create Activity" button navigates to the create-activity screen and back.
5. Header back button returns to the previous screen.
6. Header info-button still navigates to course-details.
7. URL routing: navigating directly to `/classroom/[id]/courseworks` lands on the Courseworks tab.

## Out of Scope

- Per-tab headers (the outer Stack header is shared)
- Lazy mounting / unmount-on-blur tuning (default behavior is acceptable)
- Tab badge counts or icons (text labels only, matching the current HeroUI design)
- Refactoring `LessonList`, `CourseworkList`, or `ClassroomActivitiyList` internals
