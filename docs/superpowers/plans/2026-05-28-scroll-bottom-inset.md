# Scroll Bottom-Inset Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on staging/committing:** The user (`jeffthedev`) owns staging and commits in this repo. Do NOT run `git add` or `git commit` in any step. Each task ends at a clean checkpoint — leave the working tree dirty and let the user commit when they want.

**Goal:** Stop the Android system nav bar from clipping the last row on every scrollable screen, online or offline.

**Architecture:** Add a new `useScrollBottomInset` hook (banner-aware for scroll content) plus two thin wrappers — `<ScreenList>` (over `FlashList`) and `<ScreenScrollView>` (over `ScrollView`) — that auto-apply the inset. Migrate every scrollable screen to one of them. Plain-`ScrollView` consumers swap component; `Animated.ScrollView` consumers just swap the hook. The existing `useSafeBottomInset` hook keeps its current contract (pinned bars) untouched.

**Tech Stack:** React Native (Expo SDK 54, `edgeToEdgeEnabled: true`), `@shopify/flash-list` 2.0, `react-native-safe-area-context`, `react-native-reanimated`.

---

## File Structure

**New files:**
- `hooks/useScrollBottomInset.ts` — hook returning `insets.bottom + bannerHeight + extra`
- `components/ScreenList.tsx` — banner-aware `FlashList` wrapper
- `components/ScreenScrollView.tsx` — banner-aware `ScrollView` wrapper

**Modified files (migration):** see Tasks 4–8 for the exact list.

**Untouched:**
- `hooks/useSafeBottomInset.ts` — keep current behavior (zero while banner visible) for pinned bars
- `components/screen.tsx` — unchanged
- `features/network/NetworkBanner.tsx` — unchanged
- `features/network/NetworkBannerContext.tsx` — unchanged (already exposes `bannerHeight`)

---

## Task 1: Create `useScrollBottomInset` hook

**Files:**
- Create: `hooks/useScrollBottomInset.ts`

- [ ] **Step 1: Create the hook file**

Write `hooks/useScrollBottomInset.ts`:

```ts
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkBannerHeight } from "@/features/network/NetworkBannerContext";

/**
 * Bottom inset for scrollable content.
 *
 * Returns the real safe-area bottom (Android nav bar / iOS home indicator)
 * PLUS the current network-banner height. Scroll content sits BEHIND the
 * banner, so it has to clear both the system gesture bar AND the banner.
 *
 * For pinned bottom bars (CTA bars, tab bars, etc.) use `useSafeBottomInset`
 * instead — those sit ON TOP OF the banner and need a different contract.
 */
export function useScrollBottomInset(extra = 0): number {
  const { bottom } = useSafeAreaInsets();
  const { bannerHeight } = useNetworkBannerHeight();
  return bottom + bannerHeight + extra;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS — new file imports resolve, no TS errors.

- [ ] **Step 3: Commit checkpoint** — clean stopping point; user may commit.

---

## Task 2: Create `<ScreenList>` component

**Files:**
- Create: `components/ScreenList.tsx`

- [ ] **Step 1: Create the component file**

Write `components/ScreenList.tsx`:

```tsx
import { FlashList, type FlashListProps } from "@shopify/flash-list";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

/**
 * FlashList wrapper that automatically applies a bottom safe-area inset
 * (plus 16px of breathing room) so the last row clears the Android nav bar
 * and the network banner when it is up.
 *
 * Caller-provided `contentContainerStyle` is merged with caller-wins.
 */
export function ScreenList<T>(props: FlashListProps<T>) {
  const paddingBottom = useScrollBottomInset(16);
  return (
    <FlashList
      {...props}
      contentContainerStyle={{
        paddingBottom,
        ...props.contentContainerStyle,
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit checkpoint.**

---

## Task 3: Create `<ScreenScrollView>` component

**Files:**
- Create: `components/ScreenScrollView.tsx`

- [ ] **Step 1: Create the component file**

Write `components/ScreenScrollView.tsx`:

```tsx
import { ScrollView, type ScrollViewProps } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

/**
 * ScrollView wrapper that automatically applies a bottom safe-area inset
 * (plus 16px) so the last child clears the Android nav bar and the network
 * banner when visible.
 *
 * For `Animated.ScrollView` (parallax screens), don't use this — keep the
 * Animated.ScrollView and just call `useScrollBottomInset` directly.
 *
 * Caller-provided `contentContainerStyle` is merged after ours (caller wins).
 */
export function ScreenScrollView(props: ScrollViewProps) {
  const paddingBottom = useScrollBottomInset(16);
  return (
    <ScrollView
      {...props}
      contentContainerStyle={[{ paddingBottom }, props.contentContainerStyle]}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit checkpoint.**

---

## Task 4: Migrate FlashList consumers — courses + assessment

**Goal:** Replace `FlashList` with `<ScreenList>` in courses and assessment features. Same edit pattern in each file.

**Files to modify:**
- `features/courses/components/CourseDetails.tsx`
- `features/courses/components/CourseList.tsx`
- `features/courses/components/PendingAssessmentList.tsx`
- `features/assessment/components/QuestionList.tsx` *(special — see Step 3)*

- [ ] **Step 1: Apply the standard migration pattern**

For each of `CourseDetails.tsx`, `CourseList.tsx`, `PendingAssessmentList.tsx`:

**Before:**
```tsx
import { FlashList } from "@shopify/flash-list";
// ...
<FlashList
  data={...}
  renderItem={...}
  // other props
/>
```

**After:**
```tsx
import { ScreenList } from "@/components/ScreenList";
// ...
<ScreenList
  data={...}
  renderItem={...}
  // other props
/>
```

Remove the `@shopify/flash-list` import line if the file uses no other types from it. Keep type imports (e.g. `FlashListProps`) if referenced.

- [ ] **Step 2: Handle `CourseDetails.tsx` specifically**

In `features/courses/components/CourseDetails.tsx` the migration is exactly the swap above. Confirm there is no existing `contentContainerStyle` prop (there isn't as of this writing — adding it would conflict). Done.

- [ ] **Step 3: Migrate `QuestionList.tsx` (special case — already uses `useSafeBottomInset`)**

In `features/assessment/components/QuestionList.tsx`:

a. Replace the import on line 19:
```tsx
// BEFORE
import { useSafeBottomInset } from "@/hooks/useSafeBottomInset";
// AFTER
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
```

b. Replace the hook call on line 62:
```tsx
// BEFORE
const safeBottomInset = useSafeBottomInset();
// AFTER
const safeBottomInset = useScrollBottomInset();
```

(Keep the local variable name `safeBottomInset` to minimize diff.) Do **not** convert this file to `<ScreenList>` — it has bespoke list rendering and a different padding formula already.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: PASS (or only pre-existing warnings).

- [ ] **Step 6: Commit checkpoint.**

---

## Task 5: Migrate FlashList consumers — oversight + classroom

**Files to modify:**
- `features/oversight/components/StudentList.tsx`
- `features/oversight/components/OversighCourseList.tsx`
- `features/oversight/components/LessonList.tsx`
- `features/oversight/components/CourseworkList.tsx`
- `features/classroom/components/StudentList.tsx`
- `features/classroom/components/LessonList.tsx`
- `features/classroom/components/CourseworkList.tsx`
- `features/classroom/components/ScoreDisplayList.tsx`
- `features/classroom/components/StudentScoringList.tsx`

- [ ] **Step 1: Apply the standard migration pattern**

For every file above, apply this edit:

**Before:**
```tsx
import { FlashList } from "@shopify/flash-list";
// ...
<FlashList ... />
```

**After:**
```tsx
import { ScreenList } from "@/components/ScreenList";
// ...
<ScreenList ... />
```

Before saving each file, search for an existing `contentContainerStyle` prop on the `FlashList`. If one exists with a `paddingBottom`, leave it (caller-wins rule covers it). If it has other keys (e.g. `paddingHorizontal`), leave it intact — the merge in `<ScreenList>` preserves caller keys.

Remove the `@shopify/flash-list` import line if no other types from it are used.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit checkpoint.**

---

## Task 6: Migrate FlashList consumers — profile / announcements / notifications

**Files to modify:**
- `features/profile/components/ProfileInformation.tsx`
- `features/profile/components/ClassScheduleList.tsx`
- `features/announcements/components/AnnouncementList.tsx`
- `features/notifications/components/NotificationList.tsx`

- [ ] **Step 1: Apply the standard migration pattern**

For every file above:

**Before:**
```tsx
import { FlashList } from "@shopify/flash-list";
// ...
<FlashList ... />
```

**After:**
```tsx
import { ScreenList } from "@/components/ScreenList";
// ...
<ScreenList ... />
```

Same caller-wins rule for any existing `contentContainerStyle`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit checkpoint.**

---

## Task 7: Migrate plain `ScrollView` screens to `<ScreenScrollView>`

**Files to modify:**
- `screens/main/announcement/AnnouncementDetailsScreen.tsx`
- `screens/main/calendar/EventDetailsScreen.tsx`
- `screens/main/oversight/SubjectDetailsScreen.tsx`
- `screens/main/oversight/ActivityScreen.tsx`
- `screens/main/oversight/LessonScreen.tsx`
- `screens/main/TeachingScreen.tsx`
- `screens/profile/ProfileScreen.tsx`
- `screens/profile/AcademicRecordsScreen.tsx`
- `screens/profile/FinancialRecordsScreen.tsx`
- `screens/main/classroom/CreateActivityScreen.tsx`

- [ ] **Step 1: Apply the standard migration pattern**

For each file:

**Before:**
```tsx
import { ScrollView, View } from "react-native";
// ...
<ScrollView
  // props
>
  {/* children */}
</ScrollView>
```

**After:**
```tsx
import { View } from "react-native";
import { ScreenScrollView } from "@/components/ScreenScrollView";
// ...
<ScreenScrollView
  // props
>
  {/* children */}
</ScreenScrollView>
```

If `ScrollView` is the ONLY thing imported from `react-native` on that line, replace the whole import. Otherwise just remove `ScrollView` from the destructured list.

If the file already sets `contentContainerStyle={{ paddingBottom: X }}` with an explicit zero or a small number, audit it: if the value was meant to *prevent* default inset, leave it (caller-wins). Otherwise remove the explicit `paddingBottom` and let the wrapper add it.

- [ ] **Step 2: Concrete example — `EventDetailsScreen.tsx`**

Look at `screens/main/calendar/EventDetailsScreen.tsx` line 1 and line 58:

```tsx
// Line 1 — BEFORE
import { ScrollView, View } from "react-native";
// Line 1 — AFTER
import { View } from "react-native";
import { ScreenScrollView } from "@/components/ScreenScrollView";

// Line 58 — BEFORE
<ScrollView
  // ... existing props
>
// Line 58 — AFTER
<ScreenScrollView
  // ... existing props (unchanged)
>

// Line 117 — BEFORE
</ScrollView>
// Line 117 — AFTER
</ScreenScrollView>
```

Same shape for every other file in the list.

- [ ] **Step 3: Special-case check — `CreateActivityScreen.tsx`**

This is a form. After migration, confirm the keyboard-avoiding-view behavior still works — open the screen, focus a text input near the bottom, confirm the input scrolls above the keyboard without extra clipped padding.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit checkpoint.**

---

## Task 8: Hook swap for `Animated.ScrollView` screens

These screens use parallax / animated scroll and can't be wrapped by `<ScreenScrollView>`. Instead, swap the hook so they pick up banner awareness.

**Files to modify:**
- `screens/main/courses/course/CourseScreen.tsx`
- `screens/main/HomeScreen.tsx`
- `screens/onboarding/OnboardingScreen.tsx` *(verify — only swap if it's a scroll container, leave alone if it's a pinned-bar use)*
- `screens/auth/LoginScreen.tsx` *(verify — same caveat)*

- [ ] **Step 1: Identify whether each file is using `useSafeBottomInset` for a *scroll container* or a *pinned bar***

For each file in the list:

a. Open the file.
b. Find every call to `useSafeBottomInset()`.
c. Trace where the returned value is used:
   - If it's applied to `contentContainerStyle.paddingBottom` of a `ScrollView` / `Animated.ScrollView` / `FlatList` / `FlashList` → that's a **scroll-container** use → swap to `useScrollBottomInset`.
   - If it's applied to a `paddingBottom` on a `View` that acts as a pinned bottom bar (sticky CTA, footer, tab bar) → that's a **pinned-bar** use → **leave it alone**.

- [ ] **Step 2: Apply the swap to scroll-container uses**

For each scroll-container use found:

```tsx
// BEFORE
import { useSafeBottomInset } from "@/hooks/useSafeBottomInset";
// ...
const safeBottom = useSafeBottomInset();
// ...
contentContainerStyle={{ paddingBottom: safeBottom + 16 }}

// AFTER
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
// ...
const safeBottom = useScrollBottomInset(16);
// ...
contentContainerStyle={{ paddingBottom: safeBottom }}
```

(Pass the `+ 16` breathing room into the hook arg; remove it from the inline math. Both forms produce the same number — this just keeps the call-site clean and matches `<ScreenList>` / `<ScreenScrollView>`.)

- [ ] **Step 3: Concrete example — `CourseScreen.tsx`**

`screens/main/courses/course/CourseScreen.tsx` line 30, 39, 198:

```tsx
// Line 30 — BEFORE
import { useSafeBottomInset } from "@/hooks/useSafeBottomInset";
// Line 30 — AFTER
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

// Line 39 — BEFORE
const safeBottom = useSafeBottomInset();
// Line 39 — AFTER
const safeBottom = useScrollBottomInset(16);

// Line 198 — BEFORE
contentContainerStyle={{ paddingBottom: safeBottom + 16 }}
// Line 198 — AFTER
contentContainerStyle={{ paddingBottom: safeBottom }}
```

- [ ] **Step 4: Mixed-use files**

If a file calls `useSafeBottomInset` in multiple places — some for scroll, some for pinned bars — call BOTH hooks in the same component:

```tsx
const safeBottomScroll = useScrollBottomInset(16);
const safeBottomPinned = useSafeBottomInset();
```

…and route each value to its matching consumer.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit checkpoint.**

---

## Task 9: Manual verification

No automated test covers RN layout adequately. Verify on a real Android device.

- [ ] **Step 1: Set up the device**

a. Build and install the dev variant: `pnpm android` (or current build).
b. Enable 3-button navigation in Android Settings → System → Gestures → System navigation.

- [ ] **Step 2: Online verification (full matrix)**

Navigate to each of these screens, scroll to the very end, confirm the last visible row is fully above the system nav buttons (no clipping):

- `CourseDetailsScreen` (open any course → tap info button)
- `CourseScreen` (open any course → scroll the timeline to the end)
- One classroom list (open a classroom → student/lesson/coursework tab → scroll to end)
- `ProfileScreen` (open profile tab → scroll to end)

- [ ] **Step 3: Gesture-nav check**

Switch Android navigation to gestures. Re-test the same four screens. Last row should clear the gesture pill.

- [ ] **Step 4: Offline / banner-up check**

Turn off Wi-Fi and cellular. Wait for the network banner to slide up.
Re-test the same four screens. The last row should now clear BOTH the gesture/nav bar AND the offline banner above it — no row should sit underneath the banner.

- [ ] **Step 5: Sanity-scroll the remaining migrated screens**

For each screen migrated in Tasks 4–8 that wasn't covered in the matrix above, open it once with content present and scroll to the end. Confirm the last row clears the nav bar. Do this online only — the matrix covers the banner case.

- [ ] **Step 6: iOS sanity**

Build for iOS (`pnpm ios`). Open the four matrix screens. Confirm:
- The last row clears the home-indicator area.
- Nothing visually regressed on screens that already worked (e.g. `AssessmentDetailsScreen` with its pinned CTA bar — the bar should still sit above the home indicator, the list above it should not have changed).

- [ ] **Step 7: Final commit checkpoint.**

---

## Self-review

**Spec coverage:**

- "useScrollBottomInset hook" → Task 1 ✓
- "ScreenList component" → Task 2 ✓
- "ScreenScrollView component" → Task 3 ✓
- "Migrate FlashList consumers" (full list in spec) → Tasks 4, 5, 6 ✓
- "Migrate ScrollView consumers" → Task 7 ✓
- "Hook swap for Animated.ScrollView" → Task 8 ✓
- "Manual verification matrix" → Task 9 ✓
- "Leave pinned bars alone" → called out in Task 8 Step 1 ✓
- "QuestionList already uses inset; just hook swap" → Task 4 Step 3 ✓
- "iOS regression check" → Task 9 Step 6 ✓

**Placeholder scan:** No TBD / TODO / "implement later" / vague handwaving. Every code change shows the actual code.

**Type / name consistency:** Hook name `useScrollBottomInset` is used identically across Tasks 1, 4, 7, 8. Component names `ScreenList` / `ScreenScrollView` match across creation and migration tasks. Existing `useSafeBottomInset` is only referenced in `useSafeBottomInset → useScrollBottomInset` swaps and once where we explicitly leave it (pinned bars in Task 8).
