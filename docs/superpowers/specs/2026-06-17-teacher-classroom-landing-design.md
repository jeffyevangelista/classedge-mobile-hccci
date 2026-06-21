# Teacher classroom landing — collapsible hero + tab-aware FAB

**Date:** 2026-06-17
**Scope:** Visual restructure of the teacher classroom screen. No changes to the per-tab content (lesson rows, assessment rows, rapid-grader rows) — those stay as-is.

## Background

When a teacher taps a course from the Teaching list, they land on `/classroom/[classroomId]/(tabs)` — three top tabs (Materials, Assessments, In-class) sitting flush against the system status area, with the classroom name in the stack header and a "+" + Info button in the header's right action area.

The screen reads as a list of lists. There's no course identity (no photo, no visual anchor), no parallax, no separation between course context and tab content. Compared to the student `CourseScreen` (which has a parallax photo hero collapsing into a sticky nav), it feels under-built.

The "+" in the header was introduced 2026-05-19 (see `2026-05-19-classroom-header-create-action-design.md`). It opens a `CreateActionSheet` whose only entry today is "In-class assessment" — i.e., the create flow is functionally an in-class flow even though the affordance is shown on every tab. This spec supersedes that placement.

## Goal

Make the teacher's first impression of a course feel as considered as the student's — give it a parallax photo hero that collapses on scroll, make the tab bar feel like navigation rather than the page itself, and surface the Create action only where it's relevant (the In-class tab).

Out of scope: lesson card redesigns, assessment card redesigns, In-class row redesigns. Those are deferred polish.

## Design

### Visual shape

- **Parallax photo hero** — 28% of screen height (matches student `CourseScreen.tsx:38`), backed by `subjectPhoto` via `AttachmentImage`, with a placeholder fallback.
- **Hero text overlay** — `subjectName` (title) and `"{subjectType} · Room {roomNumber}"` (subtitle). No counts, no extra metadata.
- **Floating glass nav buttons** — back + info, sitting on the photo, fading out as the hero collapses (mirrors student CourseScreen pattern).
- **Three tabs** — Materials, Assessments, In-class. Labels and order unchanged. Sticky to the top once the hero finishes collapsing.
- **Sticky collapsed nav** — solid surface row appears as the hero collapses, carrying the back button, classroom title, and info button.
- **Floating Create button (FAB)** — only renders when the In-class tab is active. Cross-fade transition on tab change (180ms). Opens the same `CreateActionSheet` the header "+" used to open.

### Collapse behaviour

Driven by `react-native-collapsible-tab-view` (new dependency). This library:

- Owns a shared scroll value across all three tab lists
- Collapses the header on scroll-down, expands on scroll-up to top
- Renders the tab bar sticky once the header has fully collapsed
- Resets scroll state correctly when tabs switch
- Resolves the cross-tab scroll-snap-back and z-index edge cases that a custom Reanimated solution would need to hand-roll

We use the library's `Tabs.Container` with a custom `renderHeader` and a custom `renderTabBar`. The three tab bodies are rendered as `Tabs.FlatList` (Materials, Assessments, In-class) so the library can track each list's scroll offset.

### Component restructure

`react-native-collapsible-tab-view` is not a React Navigation navigator — its `Tabs.Container` is a single component whose tabs are children, not separate routes. We can't keep expo-router's file-based `(tabs)/_layout.tsx` + per-tab route files for this screen.

The restructure:

- **Delete:** `app/(main)/classroom/[classroomId]/(tabs)/_layout.tsx`, `(tabs)/index.tsx`, `(tabs)/courseworks.tsx`, `(tabs)/rapid-grader.tsx`. The `(tabs)` group goes away.
- **Add:** `app/(main)/classroom/[classroomId]/index.tsx` — thin route file that renders the new `ClassroomScreen`.
- **Add:** `screens/main/classroom/ClassroomScreen.tsx` — owns the hero, the collapsible tabs container, the FAB, and the back/info glass buttons. The component composes `LessonList`, `CourseworkList`, and `ClassroomActivitiyList` directly (no per-tab wrapper files needed — the existing wrappers were one-liners).
- **Modify:** `app/(main)/classroom/[classroomId]/_layout.tsx` — drop the headerRight "+" and Info button (both move into the hero's glass nav). Set `headerShown: false` for the index screen (the hero owns the visual nav). Keep the existing `Stack.Screen` entries for `create-activity`, `course-details`, and `input-grades/[activityId]` with their existing header treatments. The `CreateActionSheet` and `createActions` state stays in this layout file because the screen-owned FAB needs to open it — pass `onPress={openCreateSheet}` down to `ClassroomScreen` as a prop, or lift the sheet open-state into a small context. Concrete wiring deferred to the implementation plan.

### Existing tab content

- **Materials** — `features/classroom/components/LessonList.tsx` — unchanged.
- **Assessments** — `features/classroom/components/CourseworkList.tsx` — unchanged.
- **In-class** — `features/classroom/components/ClassroomActivitiyList.tsx` — unchanged.

Each currently uses a plain `FlatList`. Inside `Tabs.Container`, these become `Tabs.FlatList` (the library's drop-in wrapper that wires up scroll tracking). The list internals — items, refresh control, end-reached pagination, skeletons — stay the same.

### FAB behaviour

- Render only when the active tab is "In-class". The library's `Tabs.Container` exposes an active-tab signal we subscribe to.
- Cross-fade in/out via Reanimated `FadeIn` / `FadeOut` (180ms).
- Positioned bottom-right, respecting `useSafeBottomInset` so it sits above the home indicator.
- onPress opens the `CreateActionSheet` (same sheet, same `createActions` list, same `create-activity` route as today).

### Deep links

The route `/classroom/{id}/(tabs)` (and `/courseworks`, `/rapid-grader`) goes away. We checked: nothing in the app links to these specific tab paths — all internal nav goes to `/classroom/{id}`. So no deep-link migration is required. After the change, `/classroom/{id}` lands on the new screen with Materials tab active by default.

## Non-goals

- **No lesson card / assessment card / In-class row redesigns.** All three lists keep the row designs they have today.
- **No header-control changes for `create-activity`, `course-details`, `input-grades`.** Those stack screens keep their existing per-screen header configurations.
- **No counts or stats in the hero.** No "32 students · 8 materials · 5 assessments" line. The hero stays calm.
- **No changes to student `CourseScreen` or the student-side `CourseTimeline`.**
- **No changes to the `Teaching` / `Archived Courses` list screens upstream.**
- **No backend changes.**

## Risks

- **New dependency.** `react-native-collapsible-tab-view` is well-maintained (active commits, healthy issue tracker) and small (~6 KB). It depends on Reanimated, which we already use heavily. Risk: keeping it in sync with future Reanimated upgrades. Mitigation: pin a known-good version, treat upgrades as a normal dep bump.
- **File-based tab routes removed.** External deep links to `/classroom/{id}/rapid-grader` etc. would 404. Verified above that none exist internally. Acceptable.
- **Create flow ownership split.** The `CreateActionSheet` and `createActions` array currently live in `_layout.tsx` because the header "+" needed them. Moving the affordance to a screen-level FAB means the sheet state has to be accessible from the screen. Two safe wirings exist (lift to context, or pass an open-callback as a screen prop) — pick the simpler one in the implementation plan; either is fine.
- **iOS top-tab feel.** `MaterialTopTabs` (current) and `react-native-collapsible-tab-view`'s `MaterialTabBar` look similar; the underline and label styles are tunable. If the library's default tab bar feels off, override `renderTabBar` with a thin custom one styled like the existing one (`(tabs)/_layout.tsx:30-46`).
- **Photo-less courses.** Courses without `subjectPhoto` fall back to the placeholder image (`bg-placeholder.png`), same convention as the student `CourseScreen`. No new asset.

## Testing

Manual:

- Open a course as a teacher; verify hero photo + title + subtitle render.
- Scroll the Materials list: hero collapses, glass nav fades out, solid nav fades in, tabs stick to top.
- Switch to Assessments: scroll state isolates per tab. FAB does not show.
- Switch to In-class: FAB cross-fades in. Tap FAB → `CreateActionSheet` opens with the "In-class assessment" action. Tapping the action routes to `create-activity`.
- Switch back to Materials: FAB cross-fades out.
- Pull-to-refresh on each tab: works as today.
- Test on a course with no `subjectPhoto`: placeholder image shows in hero.
- Test on a course with a long title: title wraps in expanded hero, truncates in collapsed nav.

No automated tests exist for the classroom screen today; none are added in this pass.

## Supersedes

This spec replaces the placement decision from `2026-05-19-classroom-header-create-action-design.md`. The `CreateActionSheet` infrastructure from that spec is reused as-is — only the affordance (header "+" → tab-aware FAB) moves.
