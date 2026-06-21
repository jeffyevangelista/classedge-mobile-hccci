# Profile Tab + Home Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Profile to a rightmost tab (one-tap from anywhere) and rebuild Home's header into a school-identity bar (logo + "HCCCI" + Sync) plus a scrolling personal-greeting band with a rounded bottom.

**Architecture:** Three independent units. (a) A new tab screen at `(tabs)/profile.tsx` plus a one-line edit in the tabs `_layout.tsx`; the old stack index for Profile is deleted to free the URL. (b) A new `GreetingBand` component that renders inside Home's scroll content. (c) A renamed `HomeTabHeader` (replacing `TabsHeader`) carrying school branding only. Visual continuity between the fixed header and the scrolling band comes from both sharing `bg-surface` and the band's `rounded-b-3xl` silhouette.

**Tech Stack:** Expo Router 4 (file-based routing), React Native, NativeWind/Uniwind, heroui-native (`Avatar`, `useThemeColor`), `@shopify/flash-list` (downstream consumers — no direct changes here), `expo-image` via `@/components/Image`. Spec reference: `docs/superpowers/specs/2026-06-20-profile-tab-and-home-header-redesign-design.md`.

## Global Constraints

- **Spec source:** `docs/superpowers/specs/2026-06-20-profile-tab-and-home-header-redesign-design.md` — every behavior, copy string, and class name comes from there.
- **Logo asset:** `assets/logo.png` (1024×1024, RGBA). Render via `@/components/Image` with `contentFit="contain"`. Square render box.
- **School name string:** literal `"HCCCI"` (not the full name).
- **Profile tab visibility:** all roles. No `Tabs.Protected` wrapper.
- **Profile tab icon:** `UserIcon` via the existing `TabIcon` component (matches the other tabs' focused/unfocused treatment).
- **Color tokens:** `bg-surface` (header + band), `bg-background` (feed). Both come from existing theme tokens — never hard-code colors.
- **Rounded bottom radius:** Tailwind `rounded-b-3xl` (24px).
- **Avatar size in band:** heroui-native `size="lg"` (one step up from today's `md`).
- **Greeting copy:** reuse `getGreeting()` from `@/utils/getGreeting` — same text/refresh-on-AppState behavior as today's `TabsHeader`.
- **No auto-commit:** Do not run `git add` or `git commit` in any task. The user stages and commits manually.
- **Don't break PowerSync schema or anything outside the spec's scope.** No drive-by refactors.
- **Verification baseline:** `pnpm tsc --noEmit` must pass with no new errors after every task. (Pre-existing errors in `features/classroom/components/StudentScoreItem.tsx` lines 119 are known and unrelated — ignore them.)

---

## File Structure

| Path | Action | Responsibility |
|------|--------|----------------|
| `app/(main)/(drawer)/(tabs)/profile.tsx` | **Create** | Tab screen — renders `<ProfileScreen />`. |
| `app/(main)/(drawer)/(tabs)/_layout.tsx` | **Edit** | Append a `<Tabs.Screen name="profile" />` after Notifications, `headerShown: false`, icon `UserIcon`. |
| `app/(main)/profile/index.tsx` | **Delete** | Replaced by the tab; deleting frees the `/profile` URL for the tab. |
| `screens/profile/ProfileScreen.tsx` | **Edit** | Strip the `BackButton` and its `floatingBtn` background from the animated nav bar (tab root → no back). |
| `components/TabsHeader.tsx` | **Delete** | Replaced by `HomeTabHeader`. |
| `components/HomeTabHeader.tsx` | **Create** | Fixed top header for Home only: logo + "HCCCI" (left), `SyncCenter` (right). Bg `surface`, no bottom border. |
| `features/home/components/GreetingBand.tsx` | **Create** | Scrolling band: `Avatar(lg)` + greeting + first name. Bg `surface`, `rounded-b-3xl`, decoration-only. Has its own skeleton fallback. |
| `screens/main/HomeScreen.tsx` | **Edit** | Swap `TabsHeader` import → `HomeTabHeader`. Render `<GreetingBand />` as the first child of `ScreenScrollView`. |

---

## Task 1 — Profile becomes a tab

**Goal:** Profile is reachable from any screen in one tap; the old stack index for `/profile` is gone; ProfileScreen no longer shows a back button.

**Files:**
- Create: `app/(main)/(drawer)/(tabs)/profile.tsx`
- Modify: `app/(main)/(drawer)/(tabs)/_layout.tsx` (add a Tabs.Screen entry after the Notifications screen)
- Delete: `app/(main)/profile/index.tsx`
- Modify: `screens/profile/ProfileScreen.tsx` (remove `BackButton` import and its render block; remove the `floatingBtn` background animation since it only served the back button)

**Interfaces:**
- Consumes: existing `ProfileScreen` default export from `@/screens/profile/ProfileScreen`; existing `TabIcon` from `@/components/TabIcon`.
- Produces: a `/profile` route resolved to the tab; no exported symbols.

- [ ] **Step 1.1 — Create the tab screen file**

Create `app/(main)/(drawer)/(tabs)/profile.tsx` with exactly this content:

```tsx
import ProfileScreen from "@/screens/profile/ProfileScreen";

const ProfileTab = () => {
  return <ProfileScreen />;
};

export default ProfileTab;
```

- [ ] **Step 1.2 — Register the tab in the tabs layout**

In `app/(main)/(drawer)/(tabs)/_layout.tsx`, immediately AFTER the existing `<Tabs.Screen name="notifications" ... />` block (which currently is the last `Tabs.Screen` before the closing `</Tabs>`), insert this block:

```tsx
<Tabs.Screen
  name="profile"
  options={{
    headerShown: false,
    tabBarIcon: ({ focused, color }) => (
      <TabIcon
        focused={focused}
        color={color}
        IconElement="UserIcon"
      />
    ),
    tabBarLabel: "Profile",
  }}
/>
```

Do NOT wrap it in `<Tabs.Protected>` — Profile is visible to all roles, including Time Keeper.

- [ ] **Step 1.3 — Delete the old Profile stack index**

Delete the file `app/(main)/profile/index.tsx`. Leave the rest of `app/(main)/profile/*` (profile-info, academic-records, financial-records, class-schedule) untouched — these remain stack-pushed sub-routes.

- [ ] **Step 1.4 — Remove the BackButton from ProfileScreen**

In `screens/profile/ProfileScreen.tsx`:

(a) Delete the import line:

```tsx
import BackButton from "@/components/BackButton";
```

(b) Inside the animated nav bar (around lines 192–200), the current JSX is:

```tsx
<View>
  <Animated.View
    style={[styles.floatingBtn, floatingBtnStyle]}
    className="bg-white/70 dark:bg-black/50"
  />
  <View className="w-10 h-10 rounded-full flex justify-center items-center">
    <BackButton tintColor={foregroundColor} />
  </View>
</View>
```

Replace the entire `<View>...</View>` block above (the one wrapping the floating background + back button) with this empty spacer so the layout stays symmetric:

```tsx
<View className="w-10 h-10" />
```

(c) Remove the now-unused `floatingBtnStyle` animated style declaration (around lines 135–142):

```tsx
const floatingBtnStyle = useAnimatedStyle(() => ({
  opacity: interpolate(
    scrollOffset.value,
    [0, IMAGE_HEIGHT],
    [1, 0],
    Extrapolation.CLAMP,
  ),
}));
```

Delete the whole `const floatingBtnStyle = ...` declaration.

(d) Remove the now-unused `floatingBtn` entry from the `styles` `StyleSheet.create` block (bottom of the file):

```tsx
floatingBtn: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  borderRadius: 9999,
},
```

Delete just the `floatingBtn: {...},` entry. Leave `container` and `imageHeader` intact.

- [ ] **Step 1.5 — TypeScript check**

Run: `pnpm tsc --noEmit`

Expected: No new errors. The pre-existing `features/classroom/components/StudentScoreItem.tsx(119,...)` errors are known noise — ignore them. If anything else reports an error referencing `BackButton`, `floatingBtn`, or `floatingBtnStyle`, recheck step 1.4.

- [ ] **Step 1.6 — Manual verification (run app)**

Start the dev client (`pnpm start` or your usual command) and verify on a device/simulator:

1. **New Profile tab appears as the rightmost tab** for every role: Student, Teacher, Program Head, Academic Director, Time Keeper.
2. **Tapping the Profile tab opens the Profile screen** (parallax image, header fade on scroll still work).
3. **No back button** is visible in the Profile screen's top nav strip (in any scroll state).
4. **Sub-routes still work:** From Profile, tap Profile Information → it pushes as a stack screen with a back button → tapping back returns to the Profile tab.
5. **Drawer is unaffected.** The hamburger button still opens the drawer where it did before (Teaching/Courses/Oversight).
6. **No "Unmatched Route" for `/profile`.** Cold-start the app, deep-link to `/profile` if possible, or navigate via the tab — both should land on the tab without error.

If any check fails, stop and reread the spec / this task before moving on.

- [ ] **Step 1.7 — STOP for user review and commit**

Per project convention, do NOT run `git add` or `git commit`. Pause here and report:
- "Task 1 complete: Profile is a tab; back button removed; old stack index deleted."
- List the touched files.
- Wait for the user to inspect/commit before continuing.

---

## Task 2 — GreetingBand component

**Goal:** Build the scrolling greeting band as a standalone component (avatar + greeting + first name, `bg-surface`, `rounded-b-3xl`). Decoration only — no navigation. Includes its own loading skeleton.

**Files:**
- Create: `features/home/components/GreetingBand.tsx`

**Interfaces:**
- Consumes: `useUserDetails` from `@/features/profile/profile.hooks`; `getGreeting` from `@/utils/getGreeting`; `toTitleCase` from `@/utils/toTitleCase`; heroui-native `Avatar`, `Skeleton`; `AttachmentAvatarImage` from `@/features/attachments/components/AttachmentAvatarImage`; `AvatarFallbackImage` from `@/components/AvatarFallbackImage`; `AppText` from `@/components/AppText`.
- Produces: a single default-exported React component `GreetingBand` (no props), suitable as a child of `ScreenScrollView` on `HomeScreen`.

- [ ] **Step 2.1 — Create the GreetingBand component file**

Create `features/home/components/GreetingBand.tsx` with exactly this content (DO NOT add a Pressable, Link, or onPress — band is decoration only):

```tsx
import { AppState, View } from "react-native";
import { Avatar, Skeleton } from "heroui-native";
import { useEffect, useState } from "react";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { getGreeting } from "@/utils/getGreeting";
import { toTitleCase } from "@/utils/toTitleCase";

const GreetingBand = () => {
  const { data, isLoading, error } = useUserDetails();
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setGreeting(getGreeting());
      }
    });
    return () => subscription.remove();
  }, []);

  if (isLoading) return <GreetingBandSkeleton />;

  const userDetails = data?.[0];
  const firstName = userDetails?.firstName;

  return (
    <View className="bg-surface px-5 pt-3 pb-5 rounded-b-3xl flex flex-row items-center gap-3">
      <Avatar size="lg" alt="user-profile" className="border border-border">
        <AttachmentAvatarImage path={userDetails?.studentPhoto} />
        <AvatarFallbackImage />
      </Avatar>
      <View>
        <AppText className="text-[11px] text-muted tracking-wider">
          {greeting},
        </AppText>
        <AppText
          weight="semibold"
          className="text-2xl leading-tight text-foreground"
        >
          {firstName
            ? toTitleCase(firstName.split(" ")[0])
            : error
              ? "—"
              : ""}
        </AppText>
      </View>
    </View>
  );
};

const GreetingBandSkeleton = () => {
  return (
    <View className="bg-surface px-5 pt-3 pb-5 rounded-b-3xl flex flex-row items-center gap-3">
      <Skeleton className="w-14 h-14 rounded-full" />
      <View className="gap-1.5">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-6 w-28 rounded" />
      </View>
    </View>
  );
};

export default GreetingBand;
```

Notes for the implementer:
- `pt-3 pb-5` gives the band a slight asymmetry so the rounded bottom feels like it "hangs" without bumping into the fixed header above.
- `rounded-b-3xl` matches the design (24px). Do not change to `rounded-2xl` or `rounded-b-2xl`.
- Greeting copy ends with a comma (e.g., "GOOD MORNING,") — matches the wireframe and feels conversational with the name below.

- [ ] **Step 2.2 — TypeScript check**

Run: `pnpm tsc --noEmit`

Expected: No new errors. The component is not yet rendered anywhere; this step just guarantees the imports/types resolve.

- [ ] **Step 2.3 — STOP for user review and commit**

Report Task 2 complete and the new file path. Wait for user to commit.

---

## Task 3 — Replace TabsHeader with HomeTabHeader and wire GreetingBand into HomeScreen

**Goal:** Swap Home's fixed header from personal-identity to school-identity, and render the new `GreetingBand` as the first scrolling element. This task MUST be done as one unit — splitting it would leave the home screen in a half-broken state between commits.

**Files:**
- Create: `components/HomeTabHeader.tsx`
- Delete: `components/TabsHeader.tsx`
- Modify: `screens/main/HomeScreen.tsx`

**Interfaces:**
- Consumes: `assets/logo.png`; `@/components/AppText`; `@/components/Image`; `@/features/sync/components/SyncCenter`; `react-native-safe-area-context` (`useSafeAreaInsets`); `GreetingBand` from `@/features/home/components/GreetingBand` (Task 2 deliverable).
- Produces: `HomeTabHeader` default export. Home screen renders this header followed by the scrolling content (greeting band first).

- [ ] **Step 3.1 — Create HomeTabHeader**

Create `components/HomeTabHeader.tsx` with exactly this content:

```tsx
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import SyncCenter from "@/features/sync/components/SyncCenter";

const HomeTabHeader = () => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-surface px-5 pb-2 flex flex-row justify-between items-center"
    >
      <View className="flex flex-row items-center gap-3">
        <Image
          source={require("@/assets/logo.png")}
          style={{ width: 36, height: 36 }}
          contentFit="contain"
        />
        <AppText weight="semibold" className="text-xl text-foreground">
          HCCCI
        </AppText>
      </View>
      <SyncCenter />
    </View>
  );
};

export default HomeTabHeader;
```

Notes:
- `bg-surface` MUST match `GreetingBand`'s background exactly — both pull from the same theme token so they read as one continuous zone.
- No bottom border. The band below uses `rounded-b-3xl` to define the shape boundary.
- Image is rendered via `@/components/Image` (expo-image + Uniwind wrapper used everywhere else in the app).
- No skeleton state needed — there's nothing async to wait for.

- [ ] **Step 3.2 — Delete the old TabsHeader**

Delete the file `components/TabsHeader.tsx`. There should be exactly one consumer in the codebase: `screens/main/HomeScreen.tsx`. The next sub-step swaps that consumer.

If your grep shows additional consumers — STOP. The spec assumed only HomeScreen uses `TabsHeader`; investigate before proceeding.

Verify with: `grep -rn "TabsHeader" --include="*.tsx" --include="*.ts" .`

Expected output before sub-step 3.3: only references inside `screens/main/HomeScreen.tsx`, plus historical doc/spec mentions under `docs/` (those are not code — ignore).

- [ ] **Step 3.3 — Update HomeScreen to use HomeTabHeader and render GreetingBand**

In `screens/main/HomeScreen.tsx`:

(a) Replace this import:

```tsx
import TabsHeader from "@/components/TabsHeader";
```

with:

```tsx
import HomeTabHeader from "@/components/HomeTabHeader";
import GreetingBand from "@/features/home/components/GreetingBand";
```

(b) In the JSX, replace `<TabsHeader />` with `<HomeTabHeader />`.

(c) Render `<GreetingBand />` as the FIRST child inside `<ScreenScrollView>` — before the `isStudent && (<View>...)` schedule block.

After the edits the relevant return block should read (showing context):

```tsx
return (
  <Screen>
    <HomeTabHeader />
    <ScreenScrollView
      showsVerticalScrollIndicator={false}
      className="w-full"
      scrollIndicatorInsets={{ right: 1 }}
      refreshControl={
        <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <GreetingBand />

      {isStudent && (
        <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
          <SectionHeader title="My Schedule" iconName="CalendarIcon" />
          <ScheduleComponent />
        </View>
      )}

      <CampusNewsSection />

      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader
          title="Announcements"
          iconName="MegaphoneIcon"
          actionLabel="See all"
          onAction={() => router.push("/announcement")}
        />
      </View>
      <AnnouncementList preview {...announcements} />
    </ScreenScrollView>
  </Screen>
);
```

No other parts of HomeScreen change.

- [ ] **Step 3.4 — TypeScript check**

Run: `pnpm tsc --noEmit`

Expected: No new errors. Pre-existing `StudentScoreItem.tsx` errors stay as before.

- [ ] **Step 3.5 — Manual verification (run app)**

Start the dev client and verify on a device/simulator. Test as a Student (richest layout):

1. **Fixed top header** shows the school logo (left, 36×36) + "HCCCI" (semibold, foreground color) + SyncCenter (right). Background matches the band below — no visible seam between them at rest.
2. **Greeting band** sits immediately below the header. Avatar (lg) on the left, "GOOD MORNING," (or AFTERNOON/EVENING) on top, first name (semibold, 2xl) below.
3. **The band has a clear rounded bottom (24px).** With the feed at scroll-top, you can see the rounded silhouette curving against `bg-background`.
4. **Scroll behavior:**
   - Pull the feed down → the greeting band scrolls UP and disappears.
   - The fixed `HomeTabHeader` stays put.
   - The feed slides under the fixed header (you'll see `bg-background` items briefly behind it during scroll if there's any transparency — there shouldn't be; both header and band are `bg-surface`).
5. **Tap the avatar in the band.** Nothing should happen — it's decoration only. No navigation, no ripple.
6. **Refresh:** Pull-to-refresh still works.
7. **Loading state:** Force the user query to be slow (e.g., kill network just before opening Home) and confirm the skeleton (avatar circle + two text bars) appears in the band.
8. **Other roles:** Switch to a Teacher account (or simulate). The same Home header + band layout appears (Teacher doesn't get the My Schedule block, but the band stays).
9. **Other tabs unaffected:** Open Teaching/Courses/Calendar/Notifications — their headers are unchanged (standard Expo Router headers with their own titles).
10. **Time Keeper:** No regression — Time Keeper sees the new Profile tab (from Task 1) and the redesigned Home header.

If any check fails, stop and reread the spec / this task before moving on.

- [ ] **Step 3.6 — STOP for user review and commit**

Report Task 3 complete:
- "Home header now shows school branding; greeting moved to scrolling band with rounded bottom; old TabsHeader deleted."
- List the touched files.
- Wait for user to inspect/commit before continuing.

---

## Self-Review (do not skip)

Before handing off, run through this checklist yourself:

- **Spec coverage:**
  - Profile tab added (rightmost, all roles, no `Tabs.Protected`) → Task 1 ✓
  - `headerShown: false` on the Profile tab → Task 1.2 ✓
  - `app/(main)/profile/index.tsx` deleted → Task 1.3 ✓
  - BackButton removed from ProfileScreen → Task 1.4 ✓
  - `TabsHeader` deleted, `HomeTabHeader` created → Task 3.1, 3.2 ✓
  - Logo + "HCCCI" + SyncCenter composition → Task 3.1 ✓
  - `GreetingBand` new component with avatar(lg) + greeting + first name → Task 2.1 ✓
  - `bg-surface` shared between header and band → Tasks 2.1 & 3.1 ✓
  - `rounded-b-3xl` on the band → Task 2.1 ✓
  - Band is decoration only (no Pressable/Link) → Task 2.1 ✓
  - `GreetingBand` rendered as first child of `ScreenScrollView` on Home → Task 3.3 ✓
  - Skeleton fallback for the band → Task 2.1 ✓
  - Sub-routes under `/profile/*` untouched → respected throughout ✓

- **Placeholder scan:** No "TODO", "TBD", "implement later", "similar to Task N" without code, or vague "add error handling" steps. ✓

- **Type/name consistency:** `GreetingBand` (Task 2) is the same identifier imported in Task 3.3. `HomeTabHeader` (Task 3.1) is the same identifier imported in Task 3.3. Avatar size `lg` and `rounded-b-3xl` are used consistently. ✓

- **Scope check:** Three tasks, each with an independently testable deliverable. Task 1 is fully orthogonal to Tasks 2+3. Tasks 2 and 3 are sequential because Task 3 imports from Task 2. ✓

---

## Execution

The plan is ready. Choose how to execute:

1. **Subagent-Driven (recommended for this work)** — fresh subagent per task, review between tasks, fast iteration. Best for the Home redesign because each task ends at a clean UI state the user can verify before the next subagent touches the codebase.

2. **Inline Execution** — execute the three tasks in this session with checkpoints for review.

Which approach?
