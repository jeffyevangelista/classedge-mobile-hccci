# Skeleton-First Dashboard

**Date:** 2026-06-01
**Status:** Design — revised after codebase exploration; pending implementation plan

## Revision note (post-exploration)

Original design assumed (a) tabs would need new skeletons built and (b) PowerSync exposed a per-stream `statusForStream(name)` API. Codebase exploration revealed:

- **Every tab already has its own skeleton + isLoading** via React Query wrappers (`useTeachingCourses`, `useNotifications`, `useEvents`, `useStudentCourses`, etc.). We integrate with those rather than rebuild.
- **PowerSync's actual API is `hasSynced` (overall) + `statusForPriority(n)` + `forStream(SyncStreamDescription)`** — not by string name. The existing `SyncGate` uses `statusForPriority(0)`, which a code comment notes currently falls back to overall `hasSynced` because backend priority rules aren't set.

Net change: `useSectionStatus` drops the `streams` parameter and uses overall `hasSynced` + `isOnline` + `isEmpty(data)`. Same effective behavior as today's `SyncGate` but applied per-section. Simpler, more honest to actual API surface.

## Goal

Eliminate the post-login full-screen sync splash. Users land in the dashboard the instant `isAuthenticated` flips true. Each section transitions through `loading → ready | empty | offline-empty`, with no global gate, ever.

## Background

Today, after Microsoft auth completes, the flow is:

1. `MSAuthButton` runs token exchange + backend handshake (button spinner)
2. `hydrateSession` writes tokens, `isAuthenticated` flips true
3. Root layout swaps from `(auth)` to `(main)`
4. `(main)/_layout.tsx` wraps everything in `<SyncGate>`, which renders `<SyncSplash>` ("Connecting…" → "X of Y streams ready") until priority-0 stream sync completes
5. Only then does the tab bar mount and the dashboard appear

The cold-login experience drags: two distinct loading states stitched together, engineer-flavored copy ("X of Y streams ready"), and an all-or-nothing gate. Returning users with cached data are fine (`SyncGate` already short-circuits via `wasSyncedAtMountRef`); first-time users wait.

This migration removes `SyncGate` entirely and replaces it with per-section state classification, matching the UX of modern apps (Notion, Linear, Slack) that never show a post-login splash.

## Success criteria

1. Wall-clock time from `isAuthenticated=true` to "tab bar visible and interactive" drops to <500ms (just the stack swap).
2. No screen shows skeletons indefinitely — every screen renders one of `{ ready, empty, offline-empty }` once its streams report `hasSynced=true` OR `connected=false`.
3. `SyncGate` and `SyncSplash` are deleted from the repo.
4. Offline state is communicated via the existing `NetworkBanner` only — no full-screen takeover.

## Non-goals

- **Detail screens** (assessment, lesson, attempt, material, activity, announcement, event, classroom, course, subject, profile). They already load via React Query / direct PowerSync queries with their own loading states and naturally benefit from earlier navigation access.
- **Auth flow changes.** Everything from MS button → token write → route swap is untouched.
- **PowerSync sync rules, priorities, or stream definitions.** No `sync-rules.yaml` edits, no changes to `streamSubscriptions.ts` role assignments.
- **`NetworkBanner` replacement.** Stays as-is.
- **Sync Center / `SyncSheet` UI.** That's a separate user-facing surface, unrelated to the gate. All its components stay.
- **i18n for `OfflineEmpty` copy.** Single English copy map for now, structured for future translation.
- **Animations between phase transitions.** No cross-fade. Phase switches are instant component swaps.
- **Automated tests.** Codebase has no test infrastructure today. Acceptance is manual (see checklist).
- **Sentry source map upload.** Telemetry events fire and group, just with minified stack traces until source maps are wired separately.

## Architecture

### `useSectionStatus` hook

The single new abstraction every consumer screen uses. Lives at `features/sync/useSectionStatus.ts`.

```ts
type SectionPhase = "loading" | "ready" | "empty" | "offline-empty";

type SectionStatus<T> = {
  phase: SectionPhase;
  data: T;
  hasSynced: boolean;
  isOnline: boolean;
};

function useSectionStatus<T>(opts: {
  data: T;
  isEmpty: (d: T) => boolean;
  isLoading?: boolean; // optional bridge from React Query hooks
}): SectionStatus<T>;
```

Phase resolution (in priority order — first match wins):

1. `isEmpty(data) === false` → **`ready`** (non-empty data always wins)
2. `isLoading === true` → **`loading`**
3. `hasSynced === false` AND `isOnline === true` → **`loading`**
4. `hasSynced === false` AND `isOnline === false` → **`offline-empty`**
5. `hasSynced === true` → **`empty`**

Sources of truth:

| Signal | Source |
|---|---|
| `hasSynced` | `useStatus().hasSynced` (overall PowerSync sync state). Per-stream gating not used — `SyncStatus` exposes `statusForPriority(n)` and `forStream(SyncStreamDescription)`, not by string name, and existing code already relies on overall `hasSynced` via the priority fallback. |
| `isOnline` | `useStore((s) => s.isConnected && s.isInternetReachable)` |
| `isEmpty` | caller-supplied predicate over `data` |
| `isLoading` | caller-supplied, typically from React Query hook (`useTeachingCourses().isLoading` etc.) — covers the cold cache case before PowerSync has populated local tables |

The hook does NOT own data fetching — the caller passes its own query result, the hook classifies. Screens stay in control of how they query (drizzle, raw SQL, React Query, etc.). The `isLoading` bridge lets us reuse the existing React-Query-backed loading signal each screen already produces.

### `SectionView` compound component

Lives at `features/sync/components/SectionView.tsx`. Thin presentation that selects the right slot based on `status.phase`. No logic beyond switching.

```tsx
<SectionView status={status}>
  <SectionView.Loading><CourseListSkeleton /></SectionView.Loading>
  <SectionView.Empty><EmptyState icon="book" message="No courses yet" /></SectionView.Empty>
  <SectionView.OfflineEmpty><OfflineEmpty section="courses" /></SectionView.OfflineEmpty>
  <SectionView.Ready>{(data) => <CourseList data={data} />}</SectionView.Ready>
</SectionView>
```

Reason to be a component (not `if/else`): consistent ordering, impossible to forget a state, easy to swap visual treatment globally later.

### `OfflineEmpty` shared component

Lives at `features/sync/components/OfflineEmpty.tsx`. Shows an icon, a section-specific message ("Connect to load your courses"), and a quiet "We'll sync this automatically when you're back online" subtext.

Takes a `section` prop for copy lookup from a single map (`features/sync/offlineCopy.ts`):

```ts
export const offlineCopy = {
  courses: "Connect to load your courses",
  calendar: "Connect to load your schedule",
  notifications: "Connect to load your notifications",
  oversight: "Connect to load your oversight data",
  teaching: "Connect to load your classes",
  home: "Connect to load your dashboard",
} as const;
```

Single source of truth → easy to audit, translate, or A/B test later.

## Per-screen migration

Each of the 6 main tabs gets the same treatment.

### Touched screens

All listed screens **already have skeletons** built via React Query patterns. Migration = wire each existing screen's `isLoading` + `data` into `useSectionStatus` and replace the current `if (isLoading) return <X />` conditionals with `<SectionView>` slots.

| Tab file | Existing skeleton | Existing data hook |
|---|---|---|
| `screens/main/HomeScreen.tsx` | Per sub-section (`ScheduleComponent`, `CampusNewsSection`, `AnnouncementList`) | n/a — composed of sub-sections; each sub-section migrates independently |
| `screens/main/courses/CoursesScreen.tsx` → `features/courses/components/CourseList.tsx` | Internal to `CourseList` | `useStudentCourses` (in `features/courses/courses.hooks.ts`) |
| `screens/main/CalendarScreen.tsx` → `features/calendar/components/CalendarComponent.tsx` | `CalendarSkeleton` (in same file) | `useEvents` |
| `screens/main/NotificationsScreen.tsx` → `features/notifications/components/NotificationList.tsx` | `NotificationListSkeleton` (in same file) | `useNotifications` |
| `screens/main/oversight/OversightScreen.tsx` → `features/oversight/components/OversighCourseList.tsx` | Internal to list component | (verify hook at plan time) |
| `screens/main/TeachingScreen.tsx` | `TeachingListSkeleton` (in same file) | `useTeachingCourses` |

No new skeletons are created. Existing skeleton components stay, just become the content rendered by `<SectionView.Loading>`.

### Pattern

Before (example: `NotificationList`):

```tsx
const NotificationList = () => {
  const { data, isLoading, isError, error, isRefetching, refetch } = useNotifications();
  if (isLoading) return <NotificationListSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />;
  return <ScreenList data={data} ListEmptyComponent={<EmptyState .../>} renderItem={...} />;
};
```

After:

```tsx
const NotificationList = () => {
  const { data, isLoading, isError, error, isRefetching, refetch } = useNotifications();
  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />;

  return (
    <SectionView status={status}>
      <SectionView.Loading><NotificationListSkeleton /></SectionView.Loading>
      <SectionView.Empty>
        <EmptyState icon="BellSlashIcon" title="You have no notifications yet" />
      </SectionView.Empty>
      <SectionView.OfflineEmpty>
        <OfflineEmpty section="notifications" />
      </SectionView.OfflineEmpty>
      <SectionView.Ready>
        <ScreenList
          data={data ?? []}
          refreshControl={<RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={...}
        />
      </SectionView.Ready>
    </SectionView>
  );
};
```

Key points:
- Existing skeleton component (`NotificationListSkeleton`) is reused as-is — no rebuild.
- Existing `isError` / `ErrorFallback` handling stays unchanged (out of scope for this migration).
- `data ?? []` guards against React Query's `undefined` during initial render.
- `<EmptyState>` (existing component at `components/EmptyState.tsx`) and `<OfflineEmpty>` (new) are visually and copy-wise distinct.

Screen chrome (header, tab bar) always renders. `TabsHeader` (greeting + name + avatar) is part of the chrome and renders immediately. Only the content area below the header transitions through phases.

## Deletion & route layout changes

### Files deleted

- `features/sync/components/SyncGate.tsx`
- `features/sync/components/SyncSplash.tsx`

### `app/(main)/_layout.tsx`

Drop the `<SyncGate>` wrapper:

```tsx
// Before
<SyncSheetProvider>
  <SyncGate>
    <Stack screenOptions={{...}}>...</Stack>
  </SyncGate>
  <SyncSheet />
</SyncSheetProvider>

// After
<SyncSheetProvider>
  <Stack screenOptions={{...}}>...</Stack>
  <SyncSheet />
</SyncSheetProvider>
```

### Files kept

`SyncSheet.tsx`, `SyncStatusCard.tsx`, `SyncCenter.tsx`, `SyncBanner.tsx`, `SyncingPill.tsx`, `StreamList.tsx`, `ForceSyncButton.tsx` — all kept. These are the user-facing Sync Center surface, unrelated to gating.

### Pre-delete verification

Before deleting `SyncGate`/`SyncSplash`, grep the repo for imports. Expected hits: only `(main)/_layout.tsx`. If anywhere else references them, those need migration too.

### No router changes

Route tree stays identical — only the wrapper component is removed.

## Offline & edge-case handling

### Phase truth table

"If we have data, show it" is the dominant rule. Phase resolution evaluates top-to-bottom:

| Order | `isEmpty(data)` | `isLoading` | `hasSynced` | `isOnline` | Phase |
|---|---|---|---|---|---|
| 1 | false | — | — | — | `ready` |
| 2 | true | true | — | — | `loading` |
| 3 | true | false | false | true | `loading` |
| 4 | true | false | false | false | `offline-empty` |
| 5 | true | false | true | — | `empty` |

Rule of thumb: non-empty data always wins. Only when there is literally nothing to render do we ask "loading, empty, or offline-empty?"

### Key invariants

1. **Once `hasSynced` flips true, it stays true for the session.** A returning user (cached data) immediately gets `ready` and never sees `offline-empty`. This is the main mechanism that makes the returning-user path instant.
2. **Brief flicker prevention:** the hook returns the same `data` reference across phase transitions when possible. React Query / PowerSync drivers already memoize, so list components don't unnecessarily re-render on phase change.
3. **Going offline mid-session does NOT regress to `offline-empty`.** If overall `hasSynced=true` and the network drops, phase stays `ready` (or `empty`). `NetworkBanner` informs the user; content stays valid (stale but trusted).
4. **`empty` vs `offline-empty` distinction:** `empty` means "the server says you have nothing." `offline-empty` means "we don't know yet because we can't reach the server." Visually and copy-wise distinct.

### Edge cases

- **Overall `hasSynced` semantics.** `useStatus().hasSynced` flips true after the first complete sync of all subscribed buckets since DB open. For roles with zero role-specific streams (e.g., Academic Director, Program Head per `streamSubscriptions.ts`), `hasSynced` flips true once shared streams complete.
- **React Query + PowerSync stagger.** A screen's `isLoading=false` arrives quickly (local SQL query completes) but PowerSync's `hasSynced=true` may lag if remote sync hasn't finished. The phase resolution prioritises `isLoading` first — if React Query is done and data is non-empty, we show `ready` even if overall `hasSynced` is still false. This is intentional: stale local data is better than a skeleton when both are available.

## Telemetry

Uses the Sentry helper from `lib/telemetry.ts` (set up in the auth-hardening work from 2026-06-01). All events gated on `EXPO_PUBLIC_SENTRY_DSN` — no-op locally.

Requires extending the existing `AuthEvent` union to a broader `TelemetryEvent` union and adding three new event names:

1. **`section_loading_slow`** — fired from `useSectionStatus` when `phase === "loading"` for >10s continuously. Payload: `{ section, elapsedMs, streams }`. Catches "screen stuck on skeleton" regressions that would otherwise go silent. Threshold tunable.
2. **`section_offline_empty`** — fired once when phase transitions to `offline-empty`. Payload: `{ section }`. Lets us see how often users hit the worst-case path, informs future investment in offline handling.
3. **`post_login_ready`** — fired once when the first tab's `phase` flips from `loading` to anything else after login. Payload: `{ elapsedMs }` (wall-clock from `isAuthenticated=true`). The headline metric proving the migration worked.

Implementation: add `markPostLoginReady()` helper to `lib/telemetry.ts` that captures the timestamp of `isAuthenticated=true` and reports elapsed time on first call after that point. Resets on next login.

## Rollback plan

Big-bang migration means rollback = revert the PR.

- PR is the only thing in the branch — no unrelated changes mixed in.
- `SyncGate.tsx` and `SyncSplash.tsx` are deleted, but git history retains them. A revert restores them with the original wiring.
- No database migrations, no schema changes, no server changes — purely client UI. Rollback is `git revert` + ship a hotfix release.

No feature flag — codebase has no flag infrastructure today, adding one solely for this migration is overkill, and the revert path is clean enough.

## Acceptance checklist

Manual (no automated test infrastructure exists today):

- [ ] All 6 tabs render their tab bar within 500ms of `isAuthenticated=true` (manual timing on dev build)
- [ ] Returning user with cached data lands in `ready` state immediately on cold start
- [ ] Brand-new user offline sees `offline-empty` on every tab (manual airplane-mode test)
- [ ] No skeleton persists indefinitely when online with empty data (e.g., a teacher with no courses)
- [ ] `SyncGate` and `SyncSplash` removed; `grep -r "SyncGate\|SyncSplash" --exclude-dir=node_modules` returns zero hits
- [ ] Sentry events fire correctly on dev build with DSN set (`post_login_ready`, optional `section_loading_slow` and `section_offline_empty` if triggered)

## Follow-up work this enables

Out of scope for this PR but unlocked by it:

- Migrating detail screens to `useSectionStatus` for consistency
- Per-section refresh affordances (pull-to-refresh that re-syncs just that stream)
- A/B testing copy variants for `OfflineEmpty`
- Skeleton animation polish
