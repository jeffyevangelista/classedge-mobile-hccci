# Classroom Header Create-Action Button — Design

**Date:** 2026-05-19
**Scope:** Move the "Create Activity" entry point from inside the RapidGrader tab content into the classroom header, replacing it with a + icon that opens a HeroUI Native `Select`. The button appears on all three classroom tabs (Materials, Courseworks, RapidGrader).

## Motivation

Today, "Create Activity" is a `Button` rendered at the top of the RapidGrader tab content. Moving the entry point into the header:

- Keeps tab content focused on lists, not actions
- Makes the create-action discoverable from every tab, not just RapidGrader
- Sets up an extensible UI for future create-options (Coursework, Material) by using a `Select` from the start, even though only one option exists today

## Current State

`app/(main)/classroom/[classroomId]/_layout.tsx` — Stack with `headerRight` on the `(tabs)` screen rendering a single `Pressable` info icon that navigates to `course-details`.

`app/(main)/classroom/[classroomId]/(tabs)/rapid-grader.tsx`:

```tsx
<Screen className="gap-2 px-2.5">
  <Button className="ml-auto" onPress={() => router.push(`/classroom/${classroomId}/create-activity`)}>
    <Button.Label>Create Activity</Button.Label>
  </Button>
  <ClassroomActivitiyList />
</Screen>
```

## Target State

### `[classroomId]/_layout.tsx`

`headerRight` becomes a row of two children:

1. **HeroUI Native `Select`** with a custom + icon trigger; one item: "Create Activity"
2. **Info icon** `Pressable` — unchanged from today

Selecting "Create Activity" calls `router.push('/(main)/classroom/[id]/create-activity')`.

```tsx
headerRight: ({ tintColor }) => (
  <View className="flex-row items-center gap-1">
    <Select
      value=""
      onValueChange={(v) => {
        if (v === "activity") {
          router.push(`/(main)/classroom/${classroomId}/create-activity`);
        }
      }}
    >
      <Select.Trigger className="border-0 bg-transparent px-2 w-9 h-9 justify-center items-center">
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
      onPress={() => router.push(`/(main)/classroom/${classroomId}/course-details`)}
      className="w-9 h-9 rounded-full justify-center items-center"
    >
      <Icon
        name="InfoIcon"
        color={tintColor}
        style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
      />
    </Pressable>
  </View>
),
```

### `(tabs)/rapid-grader.tsx`

Strip the button + its dependencies. The tab body becomes:

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

Removed: `useGlobalSearchParams`, `useRouter`, `Button` imports; the `className="gap-2 px-2.5"` tweak.

## HeroUI Native Select reference

Pattern follows `screens/profile/AcademicRecordsScreen.tsx` lines 156–184: `Select` → `Select.Trigger` → `Select.Portal` → `Select.Overlay` → `Select.Content presentation="popover"` → `Select.Item`. The existing usage puts `Select.Value` + `Select.TriggerIndicator` inside `Select.Trigger`; this design puts a bare `Icon` inside instead.

**Risk:** If `Select.Trigger` enforces input-style chrome (border, height, padding) that can't be flattened via className, the fallback is to control the Select imperatively — wrap a `Pressable` icon that toggles `open`/`onOpenChange` on the `Select`, and omit `Select.Trigger` entirely. This will be resolved during implementation by consulting the heroui-native skill or component source.

## Data Flow

```
[classroomId]/_layout (Stack)
   └── headerRight
         ├── Select onValueChange → router.push('/(main)/classroom/[id]/create-activity')
         └── Pressable onPress    → router.push('/(main)/classroom/[id]/course-details')
```

Because `headerRight` is set on the `(tabs)` Stack.Screen, the two icons render on every tab in the group without per-tab wiring.

## Out of Scope

- "Create Coursework" / "Create Material" options (one item only for now)
- Pre-selecting an activity type on the create-activity screen
- Animations / custom open-close transitions for the Select dropdown
- Hiding the + button based on role (teacher vs. student) — not requested
