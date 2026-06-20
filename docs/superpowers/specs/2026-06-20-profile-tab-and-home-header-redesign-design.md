# Profile Tab + Home Header Redesign

**Date:** 2026-06-20
**Status:** Draft — pending implementation plan
**Scope:** mobile client (`client-mobile`)

## Problem

Today, the Profile screen is reachable only by tapping the avatar in `TabsHeader`,
and `TabsHeader` is rendered only on `HomeScreen`. From any other tab (Teaching,
Courses, Calendar, Notifications) the user must first navigate back to Home and
then tap the avatar — two taps and a context shift — before reaching their
profile.

This hurts the app on four fronts:

- **Discoverability.** The avatar isn't an obvious nav target; new users don't
  realize it's the entry to Profile.
- **Frequency.** Profile is opened often enough (records, settings, logout) that
  two taps from non-Home tabs feels like friction.
- **Convention.** Modern apps (Instagram, Threads, LinkedIn) treat Profile as a
  primary tab destination.
- **Layout / clutter.** The avatar + greeting in the fixed top header is the
  only piece of "school identity" the user ever sees in-app — and it isn't
  school identity, it's *personal* identity. The school's logo and name have
  no home.

## Goal

1. Make Profile reachable from anywhere in one tap.
2. Give the Home tab a clear school-identity header (logo + "HCCCI" + sync).
3. Preserve the personal greeting + avatar warmth, but as a scrolling element,
   not part of the fixed chrome.

## Design

### Navigation

Add `Profile` as a **rightmost tab** in `app/(main)/(drawer)/(tabs)/_layout.tsx`,
visible to every role (no `Tabs.Protected` wrapper), icon `UserIcon` via the
existing `TabIcon` component, `headerShown: false` (the screen has its own
animated nav bar).

The existing stack route `app/(main)/profile/index.tsx` is removed — the new
tab serves as the Profile root. All sub-routes under `app/(main)/profile/*`
(profile-info, academic-records, financial-records, class-schedule) remain
unchanged and continue to push as stack screens from the tab.

**Route resolution:** Expo Router groups (`(drawer)`, `(tabs)`) don't affect
the URL, so both `app/(main)/(drawer)/(tabs)/profile.tsx` and
`app/(main)/profile/index.tsx` would map to `/profile` and conflict. Deleting
`app/(main)/profile/index.tsx` resolves the collision; the tab owns `/profile`
and sibling files (`profile-info.tsx`, etc.) continue to own
`/profile/<sub-route>` as today.

Deep links to `/(main)/profile` continue to resolve, now landing on the tab
instead of the stack route.

### Home tab header

Two visually-connected layers sharing `bg-surface`:

**Fixed layer — `HomeTabHeader` (renamed from `TabsHeader`):**

- Left: `assets/logo.png` (32px) + `<AppText weight="semibold">HCCCI</AppText>`
- Right: `<SyncCenter />`
- `paddingTop: insets.top`, same horizontal padding as today.
- No bottom border — visually flows into the greeting band below.
- Rendered only on `HomeScreen` (other tabs use the standard Expo Router header
  as today).

**Scrolling layer — `GreetingBand` (new):**

- First child inside `HomeScreen`'s `ScreenScrollView`.
- Same `bg-surface` as `HomeTabHeader` → reads as one connected zone until
  scrolled.
- **`rounded-b-3xl` (24px bottom corners)** — gives the header + band the
  silhouette of a "header shelf" hanging over the feed; harmonizes with the
  rounded cards (`rounded-xl`, `rounded-2xl`) used throughout.
- Content: heroui-native `<Avatar size="lg">` (one step bigger than today's
  `md` for a hero feel) + greeting + first name. Greeting + name typography
  matches today's `TabsHeader`.
- Uses `useUserDetails` for the name; shows the same skeleton fallback while
  loading.
- **Decoration only** — no `Pressable`, no `Link`. The avatar is no longer the
  Profile entry point.
- `mb-2` separates the band from the first scroll section.

### Profile screen adjustments

`ProfileScreen.tsx` (the parallax screen used by the new tab):

- Remove `BackButton` from the animated nav bar — a tab root has no "back."
- Keep the parallax image header and the nav-title fade-in on scroll
  (still useful as the user scrolls down past the hero).
- Right slot of the nav bar stays empty (as today).

## File-level changes

| File | Action |
|------|--------|
| `app/(main)/(drawer)/(tabs)/profile.tsx` | **New** — renders `ProfileScreen`. |
| `app/(main)/(drawer)/(tabs)/_layout.tsx` | **Edit** — add `Tabs.Screen name="profile"` after `notifications`, icon `UserIcon`, `headerShown: false`. |
| `app/(main)/profile/index.tsx` | **Delete** — tab now serves as Profile root. |
| `screens/profile/ProfileScreen.tsx` | **Edit** — remove `BackButton` from animated nav bar. |
| `components/TabsHeader.tsx` → `components/HomeTabHeader.tsx` | **Rename + rewrite** — logo + "HCCCI" + `SyncCenter`. |
| `features/home/components/GreetingBand.tsx` | **New** — avatar + greeting + first name, `bg-surface`, `rounded-b-3xl`. |
| `screens/main/HomeScreen.tsx` | **Edit** — import `HomeTabHeader`; render `<GreetingBand />` as first child of `ScreenScrollView`. |

## Out of scope

- Drawer changes (drawer remains the view-switcher for current/archived courses;
  no Profile entry added there).
- Other tabs' headers (Teaching, Courses, Oversight, Calendar, Notifications)
  continue to use the standard Expo Router header.
- `roleNav.ts` and role-aware drawer items.
- Notification badge / placement (kept as a tab today).

## Edge cases

- **Time Keeper.** Sees Profile tab like every other role. Drawer/hamburger
  visibility unchanged.
- **Deep links.** External links targeting `/(main)/profile` resolve to the
  tab; sub-routes resolve as today.
- **Loading state.** `GreetingBand` shows the same skeleton (avatar circle +
  two text bars) the old `TabsHeader` does while `useUserDetails` is pending.
- **Hot reload.** Deleting `app/(main)/profile/index.tsx` may produce a
  transient "not found" until Metro rebuilds — dev only, no runtime concern.

## Risks

- **Tab density.** Adding Profile pushes Students/Teachers to 5 tabs (6 with
  Chat in dev). The bar is dense but still within the 5–6 ceiling that platform
  guidelines tolerate. Tab labels remain short (one word each).
- **Visual continuity.** The "extension of the tab header" effect depends on
  `HomeTabHeader` and `GreetingBand` using the exact same surface color. Any
  drift (theme refactor, opacity tweak) will break the illusion. Both
  components should pull from the same `bg-surface` token.

## Success criteria

- Profile is reachable from any tab in one tap.
- Home header shows school logo + "HCCCI" as fixed identity; greeting + avatar
  appears as a scrolling band that disappears with the feed.
- Greeting band and fixed header read as one connected shelf at rest; band has
  a clear rounded bottom against the feed below.
- No regressions in Profile sub-routes, drawer behavior, or other tabs.
