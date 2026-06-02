# Scroll Bottom-Inset Fix

**Date:** 2026-05-28
**Status:** Design — pending implementation plan

## Problem

The Android system navigation bar (gesture pill or 3-button) clips the last row of scrollable content on most screens. Visible on `CourseDetailsScreen` (enrolled-students list cut off) and `CourseScreen` (last timeline row half-hidden behind the nav bar).

Two distinct failure modes:

1. **No bottom inset applied at all.** Most `FlashList` / `ScrollView` consumers never set `contentContainerStyle.paddingBottom`. Example: `features/courses/components/CourseDetails.tsx`.
2. **Bottom inset reduced to zero when the network banner mounts.** `CourseScreen` uses `useSafeBottomInset()`, which returns `0` whenever the banner is visible or the device is offline — correct for *pinned* bottom bars (which sit on top of the banner) but wrong for *scrollable* content (which sits behind the banner and still needs the gesture-bar inset plus banner height).

## Goal

Every scrollable screen ends with the last row fully visible above the Android nav bar — online, offline, banner up, banner down, 3-button nav, gesture nav.

## Non-goals

- Refactor or restyle the screens themselves.
- Change pinned-bar behavior (`AssessmentCtaBar`, etc.). Their existing `useSafeBottomInset` contract is correct.
- Add automated layout tests.

## Root-cause findings

- `app.config.ts:68` already sets `edgeToEdgeEnabled: true`, so `useSafeAreaInsets().bottom` reports the real Android nav-bar height. Infra is fine; consumers are inconsistent.
- `NetworkBanner.tsx:106` paints its background up to `insets.bottom` and the `useSafeBottomInset` hook (`hooks/useSafeBottomInset.ts`) returns `0` while the banner is visible. That is the intended contract for *pinned bars* (so they don't double-pad above the banner). Scroll content has a different need.
- The shared `Screen` wrapper (`components/screen.tsx`) doesn't help scroll content — even with `safeArea` true, the `SafeAreaView` only insets the container; the `FlashList`/`ScrollView` inside still needs `contentContainerStyle.paddingBottom`.

## Design

Three small additions. No changes to the existing `Screen` wrapper or `useSafeBottomInset` hook.

### 1. New hook — `useScrollBottomInset(extra = 0)`

Location: `hooks/useScrollBottomInset.ts`

```ts
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkBannerHeight } from "@/features/network/NetworkBannerContext";

// For scroll containers: always returns the real bottom safe-area inset,
// PLUS the network banner height when it is visible. Scroll content sits
// behind the banner, so it still needs to clear the gesture/nav bar AND
// leave room for the banner.
export function useScrollBottomInset(extra = 0): number {
  const { bottom } = useSafeAreaInsets();
  const { bannerHeight } = useNetworkBannerHeight();
  return bottom + bannerHeight + extra;
}
```

Distinct from `useSafeBottomInset` (which is for pinned bars and returns 0 while the banner is up). Two hooks, two contracts.

### 2. New component — `<ScreenList>`

Location: `components/ScreenList.tsx`

Thin wrapper around `@shopify/flash-list`'s `FlashList`. Applies the bottom inset automatically; merges any caller-provided `contentContainerStyle` with caller wins on overlap.

```tsx
import { FlashList, type FlashListProps } from "@shopify/flash-list";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

export function ScreenList<T>(props: FlashListProps<T>) {
  const paddingBottom = useScrollBottomInset(16);
  return (
    <FlashList
      {...props}
      contentContainerStyle={{ paddingBottom, ...props.contentContainerStyle }}
    />
  );
}
```

### 3. New component — `<ScreenScrollView>`

Location: `components/ScreenScrollView.tsx`

Same idea for `ScrollView` / `Animated.ScrollView` consumers.

```tsx
import { ScrollView, type ScrollViewProps } from "react-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";

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

For screens using `Animated.ScrollView` (e.g. `CourseScreen`), keep the `Animated.ScrollView` and just swap the hook (`useSafeBottomInset` → `useScrollBottomInset`). The wrapper is for plain `ScrollView` consumers.

## Migration plan

### `FlashList` consumers → swap to `<ScreenList>`

- `features/courses/components/CourseDetails.tsx`
- `features/courses/components/CourseList.tsx`
- `features/courses/components/PendingAssessmentList.tsx`
- `features/announcements/components/AnnouncementList.tsx`
- `features/notifications/components/NotificationList.tsx`
- `features/oversight/components/StudentList.tsx`, `OversighCourseList.tsx`, `LessonList.tsx`, `CourseworkList.tsx`
- `features/classroom/components/StudentList.tsx`, `LessonList.tsx`, `CourseworkList.tsx`, `ScoreDisplayList.tsx`, `StudentScoringList.tsx`
- `features/profile/components/ProfileInformation.tsx`, `ClassScheduleList.tsx`
- `features/assessment/components/QuestionList.tsx` *(already uses an inset; just swap to `useScrollBottomInset` so banner is handled)*

### `ScrollView` / `Animated.ScrollView` consumers

Where it's plain `ScrollView`: swap to `<ScreenScrollView>`.
Where it's `Animated.ScrollView` (parallax, etc.): keep the component, swap `useSafeBottomInset` → `useScrollBottomInset`.

- `screens/main/courses/course/CourseScreen.tsx` (Animated — hook swap)
- `screens/main/HomeScreen.tsx` (hook swap — verify it isn't pinning a bar)
- `screens/main/TeachingScreen.tsx`
- `screens/main/announcement/AnnouncementDetailsScreen.tsx`
- `screens/main/calendar/EventDetailsScreen.tsx`
- `screens/main/oversight/SubjectDetailsScreen.tsx`
- `screens/main/oversight/ActivityScreen.tsx`, `LessonScreen.tsx`
- `screens/profile/ProfileScreen.tsx`, `AcademicRecordsScreen.tsx`, `FinancialRecordsScreen.tsx`
- `screens/main/courses/course/CourseDetailsScreen.tsx` (host — verify after `CourseDetails` migrates)
- `screens/main/classroom/CreateActivityScreen.tsx` (form screen — verify scroll content reaches the bottom)

### Leave alone

- `AssessmentCtaBar` and any pinned bottom bar — keep `useSafeBottomInset`.
- Full-screen overlays (`AttachmentVideoCard`, `AttachmentPdfCard`, `CameraViewScreen`, `useImageStaging`) — different concern.
- `LoginScreen`, onboarding, OTP / password-reset — form screens with their own keyboard/safe-area handling. Only patch if visually broken.

## Edge cases & risks

1. **Caller already sets `paddingBottom`.** `<ScreenList>` merges with caller-wins, so an existing `paddingBottom: 0` silently overrides. When migrating each screen, the first thing to check is whether it already sets `paddingBottom`.
2. **Pinned bar + scroll on the same screen.** Would double-pad (list adds inset + bar adds its own). None of the migration-list screens have this today. If we hit one later, that list should keep its own bar-height padding and not use `<ScreenList>`.
3. **iOS regression.** iOS without banner: hook returns `insets.bottom` (home-indicator) — same as today. With banner: adds banner height — correct, banner pushes scroll content up on iOS too. No regression expected.
4. **Re-render during banner animation.** `bannerHeight` shared-value changes for 300 ms during enter/exit. `FlashList` handles it. If profiling later shows jank, memoize the merged style. Don't pre-optimize.

## Verification

Manual on a real Android device — no automated coverage worth the maintenance cost for layout.

| Screen | 3-button nav | Gesture nav | Offline banner up |
|---|---|---|---|
| `CourseDetailsScreen` (FlashList) | ✓ | ✓ | ✓ |
| `CourseScreen` (parallax ScrollView) | ✓ | ✓ | ✓ |
| One classroom list | ✓ | ✓ | ✓ |
| `ProfileScreen` | ✓ | ✓ | ✓ |

Other migrated screens: scroll-to-end sanity check, not the full matrix.

## Out of scope

- Restyling, spacing, typography on the migrated screens.
- Refactoring `Screen` or `useSafeBottomInset`.
- Web layout (the app's edge-to-edge concern is Android-specific).
