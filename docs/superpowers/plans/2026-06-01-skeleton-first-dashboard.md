# Skeleton-First Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the post-login full-screen sync splash. Users land in the dashboard immediately. Each section transitions through `loading → ready | empty | offline-empty` independently.

**Architecture:** Add `useSectionStatus` hook + `SectionView` compound component + `OfflineEmpty` shared component. Wire existing React-Query-backed screens (which already have skeletons) into the new pattern. Delete `SyncGate`/`SyncSplash`. Extend Sentry telemetry with three new events.

**Tech Stack:** React Native (Expo), PowerSync, TanStack Query, Zustand, Sentry, heroui-native, expo-router. **No automated test infrastructure** — verification per task is `tsc --noEmit` + manual dev-build smoke test.

**Source documents:**
- Spec: `docs/superpowers/specs/2026-06-01-skeleton-first-dashboard-design.md`
- Existing telemetry: `lib/telemetry.ts`
- Existing gate (to be deleted): `features/sync/components/SyncGate.tsx`, `features/sync/components/SyncSplash.tsx`

**Commit policy:** Standing user preference is no auto-commit. Each task ends with a suggested commit message. The implementer should stage the files and either commit or batch with adjacent tasks at their discretion.

---

## Phase 1 — Foundation (no behavior change yet)

These five tasks build the new primitives without removing anything. After Phase 1, the app still uses `SyncGate` — Phase 2 migrates screens, Phase 3 removes the gate.

### Task 1: Create offline copy map

**Files:**
- Create: `features/sync/offlineCopy.ts`

- [ ] **Step 1: Write the file**

```ts
// features/sync/offlineCopy.ts

export type OfflineSection =
  | "home"
  | "courses"
  | "calendar"
  | "notifications"
  | "oversight"
  | "teaching"
  | "announcements"
  | "schedule"
  | "campus-news";

export const offlineCopy: Record<OfflineSection, string> = {
  home: "Connect to load your dashboard",
  courses: "Connect to load your courses",
  calendar: "Connect to load your schedule",
  notifications: "Connect to load your notifications",
  oversight: "Connect to load your oversight data",
  teaching: "Connect to load your classes",
  announcements: "Connect to load announcements",
  schedule: "Connect to load your class schedule",
  "campus-news": "Connect to load campus news",
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Stage**

```bash
git add features/sync/offlineCopy.ts
```

Suggested commit message: `feat(sync): add offline-state copy map for section empty states`

---

### Task 2: Create OfflineEmpty component

**Files:**
- Create: `features/sync/components/OfflineEmpty.tsx`

- [ ] **Step 1: Write the file**

```tsx
// features/sync/components/OfflineEmpty.tsx

import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useThemeColor } from "heroui-native";
import { offlineCopy, type OfflineSection } from "../offlineCopy";

type Props = {
  section: OfflineSection;
};

export const OfflineEmpty = ({ section }: Props) => {
  const mutedColor = useThemeColor("muted");
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <Icon name="CloudSlashIcon" size={40} color={mutedColor} />
      <AppText weight="semibold" className="text-base text-center">
        {offlineCopy[section]}
      </AppText>
      <AppText className="text-xs text-muted text-center">
        We'll sync this automatically when you're back online.
      </AppText>
    </View>
  );
};

export default OfflineEmpty;
```

- [ ] **Step 2: Verify icon name exists**

Run: `grep -r "CloudSlashIcon" components/Icon.tsx`
Expected: at least one match. If no match, swap to an available icon by inspecting `components/Icon.tsx` exports — `BellSlashIcon` or `WifiSlashIcon` are likely available substitutes. Use whichever exists.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Stage**

```bash
git add features/sync/components/OfflineEmpty.tsx
```

Suggested commit message: `feat(sync): add OfflineEmpty component for cold-offline section state`

---

### Task 3: Create SectionView compound component

**Files:**
- Create: `features/sync/components/SectionView.tsx`

- [ ] **Step 1: Write the file**

```tsx
// features/sync/components/SectionView.tsx

import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import type { SectionStatus } from "../useSectionStatus";

type SlotProps = {
  children: ReactNode;
};

const Loading = (_props: SlotProps) => null;
const Empty = (_props: SlotProps) => null;
const OfflineEmpty = (_props: SlotProps) => null;
const Ready = (_props: SlotProps) => null;

type SectionViewProps<T> = {
  status: SectionStatus<T>;
  children: ReactNode;
};

function SectionViewRoot<T>({ status, children }: SectionViewProps<T>) {
  let loadingSlot: ReactNode = null;
  let emptySlot: ReactNode = null;
  let offlineEmptySlot: ReactNode = null;
  let readySlot: ReactNode = null;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<SlotProps>;
    if (element.type === Loading) loadingSlot = element.props.children;
    else if (element.type === Empty) emptySlot = element.props.children;
    else if (element.type === OfflineEmpty)
      offlineEmptySlot = element.props.children;
    else if (element.type === Ready) readySlot = element.props.children;
  });

  switch (status.phase) {
    case "loading":
      return <>{loadingSlot}</>;
    case "empty":
      return <>{emptySlot}</>;
    case "offline-empty":
      return <>{offlineEmptySlot}</>;
    case "ready":
      return <>{readySlot}</>;
  }
}

export const SectionView = Object.assign(SectionViewRoot, {
  Loading,
  Empty,
  OfflineEmpty,
  Ready,
});

export default SectionView;
```

**Design note:** slots accept plain `ReactNode` children, not render props. Consumers access their already-typed data from outer scope (the same `data` they destructured from their query hook). This trades a small ergonomic loss (consumers must use `data ?? []` defensively) for substantial type-system simplicity — no generics on slots, no inference gymnastics.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: error about `useSectionStatus` not existing (Task 4 creates it). This is fine — we'll resolve it after Task 4.

- [ ] **Step 3: Stage**

```bash
git add features/sync/components/SectionView.tsx
```

Suggested commit message: `feat(sync): add SectionView compound component for phase-based rendering`

---

### Task 4: Create useSectionStatus hook

**Files:**
- Create: `features/sync/useSectionStatus.ts`

- [ ] **Step 1: Write the file**

```ts
// features/sync/useSectionStatus.ts

import { useStatus } from "@powersync/react-native";
import useStore from "@/lib/store";

export type SectionPhase = "loading" | "ready" | "empty" | "offline-empty";

export type SectionStatus<T> = {
  phase: SectionPhase;
  data: T;
  hasSynced: boolean;
  isOnline: boolean;
};

export type UseSectionStatusOpts<T> = {
  data: T;
  isEmpty: (data: T) => boolean;
  isLoading?: boolean;
};

/**
 * Classify a section's render state. Pass in the data + an emptiness predicate
 * and optionally an `isLoading` flag from a React Query hook. Resolves to one
 * of {loading, ready, empty, offline-empty}. Non-empty data always wins.
 *
 * Resolution order (first match):
 *   1. !isEmpty(data) → ready  (non-empty data always wins)
 *   2. isLoading      → loading
 *   3. !hasSynced & online  → loading
 *   4. !hasSynced & offline → offline-empty
 *   5. hasSynced            → empty
 */
export function useSectionStatus<T>(
  opts: UseSectionStatusOpts<T>,
): SectionStatus<T> {
  const status = useStatus();
  const isConnected = useStore((s) => s.isConnected);
  const isInternetReachable = useStore((s) => s.isInternetReachable);

  const isOnline = Boolean(isConnected && isInternetReachable);
  const hasSynced = status.hasSynced === true;
  const empty = opts.isEmpty(opts.data);

  let phase: SectionPhase;
  if (!empty) phase = "ready";
  else if (opts.isLoading) phase = "loading";
  else if (!hasSynced && isOnline) phase = "loading";
  else if (!hasSynced && !isOnline) phase = "offline-empty";
  else phase = "empty";

  return { phase, data: opts.data, hasSynced, isOnline };
}

export default useSectionStatus;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (both Task 3's `SectionView` and this hook now compile).

- [ ] **Step 3: Stage**

```bash
git add features/sync/useSectionStatus.ts
```

Suggested commit message: `feat(sync): add useSectionStatus hook for per-section phase classification`

---

### Task 5: Extend telemetry with new event types + post-login marker

**Files:**
- Modify: `lib/telemetry.ts` (replace AuthEvent union with TelemetryEvent, add `markPostLoginReady`)

- [ ] **Step 1: Read current file to confirm structure**

Run: `cat lib/telemetry.ts`
Expected: file exports `initTelemetry`, `captureAuthError`, `captureAuthMessage` with an `AuthEvent` union of four names.

- [ ] **Step 2: Replace the AuthEvent union + helpers with the extended version**

Replace this block (current content of `lib/telemetry.ts`):

```ts
type AuthEvent =
  | "ms_token_exchange_failed"
  | "silent_refresh_failed"
  | "forced_logout"
  | "account_switch_detected";

/**
 * Report an auth-flow failure. Tagged so Sentry can group/filter by event type.
 */
export function captureAuthError(
  event: AuthEvent,
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  Sentry.captureException(error, {
    tags: { auth_event: event },
    extra: extras,
  });
}

/**
 * Report a non-error auth-flow signal (e.g. account switch). Surfaced as a
 * message so it shows up in Sentry without being treated as an exception.
 */
export function captureAuthMessage(
  event: AuthEvent,
  extras?: Record<string, unknown>,
): void {
  Sentry.captureMessage(event, {
    level: "info",
    tags: { auth_event: event },
    extra: extras,
  });
}
```

…with:

```ts
export type TelemetryEvent =
  // auth flow
  | "ms_token_exchange_failed"
  | "silent_refresh_failed"
  | "forced_logout"
  | "account_switch_detected"
  // section rendering
  | "section_loading_slow"
  | "section_offline_empty"
  | "post_login_ready";

// Backwards-compat alias for existing call sites — TelemetryEvent is a superset.
export type AuthEvent = TelemetryEvent;

/**
 * Report a telemetry-worthy error (auth failure, section render fault, etc.).
 * Tagged so Sentry can group/filter by event type.
 */
export function captureAuthError(
  event: TelemetryEvent,
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  Sentry.captureException(error, {
    tags: { event },
    extra: extras,
  });
}

/**
 * Report a non-error telemetry signal (account switch, slow section, etc.).
 * Surfaced as a message so it shows up in Sentry without being treated as an
 * exception.
 */
export function captureAuthMessage(
  event: TelemetryEvent,
  extras?: Record<string, unknown>,
): void {
  Sentry.captureMessage(event, {
    level: "info",
    tags: { event },
    extra: extras,
  });
}

// --- Post-login readiness tracking ---

let loginReadyArmed = false;
let loginAuthenticatedAt: number | null = null;

/**
 * Call when `isAuthenticated` flips to true. Arms the post-login timer so the
 * NEXT `markPostLoginReady()` call records the elapsed time. Idempotent — calling
 * again before `markPostLoginReady` fires resets the timer.
 */
export function armPostLoginReady(): void {
  loginReadyArmed = true;
  loginAuthenticatedAt = Date.now();
}

/**
 * Call once a section finishes its first non-loading render after login. Fires
 * a one-shot `post_login_ready` Sentry event with elapsed ms. No-op if not
 * armed or already fired.
 */
export function markPostLoginReady(): void {
  if (!loginReadyArmed || loginAuthenticatedAt === null) return;
  const elapsedMs = Date.now() - loginAuthenticatedAt;
  loginReadyArmed = false;
  loginAuthenticatedAt = null;
  captureAuthMessage("post_login_ready", { elapsedMs });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. The `AuthEvent` alias keeps existing call sites (`MSAuthButton.tsx`, `useTokenRefresh.ts`, `hydrateSession.ts`) compiling without change.

- [ ] **Step 4: Stage**

```bash
git add lib/telemetry.ts
```

Suggested commit message: `feat(telemetry): extend events with section + post-login signals, add markPostLoginReady`

---

## Phase 2 — Migrate screens to SectionView

These eight tasks each migrate one screen/sub-section. Order is least-risk-first (simplest screens first). After each task: typecheck passes AND the screen visually renders skeleton → data on a dev build. **SyncGate still wraps everything during Phase 2** — that's intentional. Phase 3 removes it.

### Task 6: Migrate NotificationList

**Files:**
- Modify: `features/notifications/components/NotificationList.tsx`

- [ ] **Step 1: Apply edit**

Replace this block (lines 24-62 of the current file, the `NotificationList` body):

```tsx
const NotificationList = () => {
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useNotifications();
  if (isLoading) {
    return <NotificationListSkeleton />;
  }

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <ScreenList
      refreshControl={
        <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
      }
      ListEmptyComponent={
        <View className="max-w-3xl w-full mx-auto">
          <EmptyState
            icon="BellSlashIcon"
            title="You have no notifications yet"
          />
        </View>
      }
      ItemSeparatorComponent={() => (
        <View className="max-w-3xl w-full mx-auto">
          <View className="h-px bg-border" />
        </View>
      )}
      renderItem={({ item }) => (
        <View className="max-w-3xl w-full mx-auto">
          <NotificationItem {...item} />
        </View>
      )}
      data={data}
    />
  );
};
```

…with:

```tsx
const NotificationList = () => {
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useNotifications();

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <SectionView status={status}>
      <SectionView.Loading>
        <NotificationListSkeleton />
      </SectionView.Loading>
      <SectionView.Empty>
        <View className="max-w-3xl w-full mx-auto">
          <EmptyState
            icon="BellSlashIcon"
            title="You have no notifications yet"
          />
        </View>
      </SectionView.Empty>
      <SectionView.OfflineEmpty>
        <OfflineEmpty section="notifications" />
      </SectionView.OfflineEmpty>
      <SectionView.Ready>
        <ScreenList
          refreshControl={
            <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
          }
          ItemSeparatorComponent={() => (
            <View className="max-w-3xl w-full mx-auto">
              <View className="h-px bg-border" />
            </View>
          )}
          renderItem={({ item }) => (
            <View className="max-w-3xl w-full mx-auto">
              <NotificationItem {...item} />
            </View>
          )}
          data={data ?? []}
        />
      </SectionView.Ready>
    </SectionView>
  );
};
```

- [ ] **Step 2: Add the new imports at the top of the file**

Insert after the existing `useNotifications` import line (around line 16):

```tsx
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Run dev build, navigate to Notifications tab. Verify:
- Skeleton appears during initial load
- Notifications render once loaded
- (Optional) Toggle airplane mode before login → expect `OfflineEmpty` on this tab (only meaningful after Phase 3 removes SyncGate; for now, SyncGate may still gate this — that's OK)

- [ ] **Step 5: Stage**

```bash
git add features/notifications/components/NotificationList.tsx
```

Suggested commit message: `refactor(notifications): migrate NotificationList to useSectionStatus + SectionView`

---

### Task 7: Migrate CalendarComponent

**Files:**
- Modify: `features/calendar/components/CalendarComponent.tsx`

- [ ] **Step 1: Add imports**

Insert near the existing imports (after the `useEvents` import line, around line 14):

```tsx
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
```

- [ ] **Step 2: Replace the loading/error conditionals + return body**

Find this block (around line 222-226 in the current file):

```tsx
  if (isLoading) return <CalendarSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );
```

Replace with:

```tsx
  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: () => false, // calendar renders the grid even with zero events — never "empty"
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  if (status.phase === "loading") return <CalendarSkeleton />;
  if (status.phase === "offline-empty") return <OfflineEmpty section="calendar" />;
```

**Why `isEmpty: () => false`:** the calendar grid itself is meaningful UX even when no events exist (the date picker is the primary surface). So we never want to show an "empty" placeholder — only loading vs offline-empty vs the grid itself. This is a legitimate per-screen choice; other screens use `(d) => d.length === 0`.

**Note on SectionView usage:** for calendar we deliberately use the imperative `status.phase ===` checks instead of `<SectionView>` slots because the existing CalendarComponent has a single large return block; splitting it into slots would be invasive. The `useSectionStatus` hook still provides the phase classification — we just consume it imperatively here. This is allowed and documented.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Dev build → Calendar tab. Verify calendar skeleton → calendar grid renders. Date selection still works. Event details still open.

- [ ] **Step 5: Stage**

```bash
git add features/calendar/components/CalendarComponent.tsx
```

Suggested commit message: `refactor(calendar): use useSectionStatus for phase classification`

---

### Task 8: Migrate OversighCourseList

**Files:**
- Modify: `features/oversight/components/OversighCourseList.tsx`

- [ ] **Step 1: Add imports**

Insert after existing `useGetSubjects` import (around line 22):

```tsx
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
```

- [ ] **Step 2: Replace the loading/return block**

Find this block (around lines 51-85 in the current file):

```tsx
  if (isLoading) return <SubjectsListSkeleton numColumns={numColumns} />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <View className="w-full max-w-6xl mx-auto flex-1">
      <SubjectsToolbar search={search} onSearchChange={setSearch} />
      <ScreenList
        refreshControl={
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="BookOpenIcon"
            title={search ? "No matching courses" : "No courses found"}
            description={
              search
                ? "Try a different search term"
                : "You are not enrolled in any courses yet"
            }
          />
        }
        key={numColumns}
        numColumns={numColumns}
        data={visible}
        className="p-1"
        renderItem={({ item }) => (
          <Subject subject={item} numColumns={numColumns} />
        )}
      />
    </View>
  );
};
```

Replace with:

```tsx
  const status = useSectionStatus({
    data: subjects,
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <SectionView status={status}>
      <SectionView.Loading>
        <SubjectsListSkeleton numColumns={numColumns} />
      </SectionView.Loading>
      <SectionView.Empty>
        <View className="w-full max-w-6xl mx-auto flex-1">
          <SubjectsToolbar search={search} onSearchChange={setSearch} />
          <EmptyState
            icon="BookOpenIcon"
            title="No courses found"
            description="You are not enrolled in any courses yet"
          />
        </View>
      </SectionView.Empty>
      <SectionView.OfflineEmpty>
        <OfflineEmpty section="oversight" />
      </SectionView.OfflineEmpty>
      <SectionView.Ready>
        <View className="w-full max-w-6xl mx-auto flex-1">
          <SubjectsToolbar search={search} onSearchChange={setSearch} />
          <ScreenList
            refreshControl={
              <RefreshIndicator
                refreshing={isRefetching}
                onRefresh={refetch}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="BookOpenIcon"
                title="No matching courses"
                description="Try a different search term"
              />
            }
            key={numColumns}
            numColumns={numColumns}
            data={visible}
            className="p-1"
            renderItem={({ item }) => (
              <Subject subject={item} numColumns={numColumns} />
            )}
          />
        </View>
      </SectionView.Ready>
    </SectionView>
  );
};
```

**Note:** the original `ListEmptyComponent` switched copy on `search`. After migration, the SectionView empty slot covers "no courses at all", and the `ListEmptyComponent` inside `<Ready>` covers "no matches for current search". This is the right split: search-filter emptiness is not the same as global emptiness.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Dev build → Oversight tab (must be logged in as Academic Director or Program Head). Verify skeleton → list. Search still filters. Empty search results show "No matching courses".

- [ ] **Step 5: Stage**

```bash
git add features/oversight/components/OversighCourseList.tsx
```

Suggested commit message: `refactor(oversight): migrate SubjectsList to useSectionStatus + SectionView`

---

### Task 9: Migrate CourseList

**Files:**
- Modify: `features/courses/components/CourseList.tsx`

- [ ] **Step 1: Add imports**

Insert after existing `useStudentCourses` import (around line 26):

```tsx
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
```

- [ ] **Step 2: Replace the loading/return block**

Find this block (around lines 66-109 in the current file):

```tsx
  if (isLoading) return <CourseListSkeleton numColumns={numColumns} />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <View className="w-full max-w-6xl mx-auto flex-1">
      <CourseListToolbar
        search={search}
        onSearchChange={setSearch}
        sortMode={sortMode}
        onSortChange={setSortMode}
      />
      <ScreenList
        refreshControl={
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="BookOpenIcon"
            title={search ? "No matching courses" : "No courses found"}
            description={
              search
                ? "Try a different search term"
                : "You are not enrolled in any courses yet"
            }
          />
        }
        key={numColumns}
        numColumns={numColumns}
        data={visible}
        className="p-1"
        renderItem={({ item }) => (
          <Course
            item={item}
            numColumns={numColumns}
            counts={pendingCounts.get(item.subjectId.id)}
          />
        )}
      />
    </View>
  );
};
```

Replace with:

```tsx
  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <SectionView status={status}>
      <SectionView.Loading>
        <CourseListSkeleton numColumns={numColumns} />
      </SectionView.Loading>
      <SectionView.Empty>
        <View className="w-full max-w-6xl mx-auto flex-1">
          <CourseListToolbar
            search={search}
            onSearchChange={setSearch}
            sortMode={sortMode}
            onSortChange={setSortMode}
          />
          <EmptyState
            icon="BookOpenIcon"
            title="No courses found"
            description="You are not enrolled in any courses yet"
          />
        </View>
      </SectionView.Empty>
      <SectionView.OfflineEmpty>
        <OfflineEmpty section="courses" />
      </SectionView.OfflineEmpty>
      <SectionView.Ready>
        <View className="w-full max-w-6xl mx-auto flex-1">
          <CourseListToolbar
            search={search}
            onSearchChange={setSearch}
            sortMode={sortMode}
            onSortChange={setSortMode}
          />
          <ScreenList
            refreshControl={
              <RefreshIndicator
                refreshing={isRefetching}
                onRefresh={refetch}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="BookOpenIcon"
                title="No matching courses"
                description="Try a different search term"
              />
            }
            key={numColumns}
            numColumns={numColumns}
            data={visible}
            className="p-1"
            renderItem={({ item }) => (
              <Course
                item={item}
                numColumns={numColumns}
                counts={pendingCounts.get(item.subjectId.id)}
              />
            )}
          />
        </View>
      </SectionView.Ready>
    </SectionView>
  );
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Dev build (logged in as Student) → Courses tab. Verify skeleton → course cards. Search/sort still work.

- [ ] **Step 5: Stage**

```bash
git add features/courses/components/CourseList.tsx
```

Suggested commit message: `refactor(courses): migrate CourseList to useSectionStatus + SectionView`

---

### Task 10: Migrate TeachingScreen

**Files:**
- Modify: `screens/main/TeachingScreen.tsx`

- [ ] **Step 1: Add imports**

Insert after existing `useTeachingCourses` import (around line 10):

```tsx
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
```

- [ ] **Step 2: Replace the loading/return block**

Find this block (around lines 48-85 in the current file):

```tsx
  if (isLoading) return <TeachingListSkeleton numColumns={numColumns} />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <Screen className="">
      <View className="w-full max-w-6xl mx-auto flex-1">
        <TeachingToolbar search={search} onSearchChange={setSearch} />
        <FlashList
          refreshControl={
            <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="BookOpenIcon"
              title={search ? "No matching courses" : "No courses found"}
              description={
                search
                  ? "Try a different search term"
                  : "You have no assigned courses yet"
              }
            />
          }
          key={numColumns}
          numColumns={numColumns}
          data={visible}
          className="p-1"
          contentContainerStyle={{ paddingBottom: 15 }}
          renderItem={({ item }) => (
            <TeachingCourse item={item} numColumns={numColumns} />
          )}
        />
      </View>
    </Screen>
  );
};
```

Replace with:

```tsx
  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <Screen className="">
      <SectionView status={status}>
        <SectionView.Loading>
          <TeachingListSkeleton numColumns={numColumns} />
        </SectionView.Loading>
        <SectionView.Empty>
          <View className="w-full max-w-6xl mx-auto flex-1">
            <TeachingToolbar search={search} onSearchChange={setSearch} />
            <EmptyState
              icon="BookOpenIcon"
              title="No courses found"
              description="You have no assigned courses yet"
            />
          </View>
        </SectionView.Empty>
        <SectionView.OfflineEmpty>
          <OfflineEmpty section="teaching" />
        </SectionView.OfflineEmpty>
        <SectionView.Ready>
          <View className="w-full max-w-6xl mx-auto flex-1">
            <TeachingToolbar search={search} onSearchChange={setSearch} />
            <FlashList
              refreshControl={
                <RefreshIndicator
                  refreshing={isRefetching}
                  onRefresh={refetch}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="BookOpenIcon"
                  title="No matching courses"
                  description="Try a different search term"
                />
              }
              key={numColumns}
              numColumns={numColumns}
              data={visible}
              className="p-1"
              contentContainerStyle={{ paddingBottom: 15 }}
              renderItem={({ item }) => (
                <TeachingCourse item={item} numColumns={numColumns} />
              )}
            />
          </View>
        </SectionView.Ready>
      </SectionView>
    </Screen>
  );
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Dev build (logged in as Teacher) → Teaching tab. Verify skeleton → course cards. Search still works.

- [ ] **Step 5: Stage**

```bash
git add screens/main/TeachingScreen.tsx
```

Suggested commit message: `refactor(teaching): migrate TeachingScreen to useSectionStatus + SectionView`

---

### Task 11: Migrate AnnouncementList (Home sub-section)

**Files:**
- Modify: `features/announcements/components/AnnouncementList.tsx`

- [ ] **Step 1: Add imports**

Insert after existing `useAnnouncementsWithEvents` import (around line 14):

```tsx
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
```

- [ ] **Step 2: Replace the loading/return block**

Find this block (around lines 21-115 in the current file):

```tsx
const AnnouncementList = () => {
  const { data, error, isLoading, refresh } = useAnnouncementsWithEvents();
  const [activeEventId, setActiveEventId] = useState<number | null>(null);

  if (isLoading) return <AnnouncementSkeleton />;
  if (error)
    return (
      <ErrorComponent message={getApiErrorMessage(error)} onRetry={refresh} />
    );

  return (
    <>
      <ScreenList
        scrollEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="MegaphoneIcon"
            title="No announcements yet"
            description="Check back later for updates"
          />
        }
        data={data}
        renderItem={({ item }) => {
```

Replace ONLY the early-return block (leave the JSX render below intact, just wrap it). Replace lines 21-29 with:

```tsx
const AnnouncementList = () => {
  const { data, error, isLoading, refresh } = useAnnouncementsWithEvents();
  const [activeEventId, setActiveEventId] = useState<number | null>(null);

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (error)
    return (
      <ErrorComponent message={getApiErrorMessage(error)} onRetry={refresh} />
    );

  if (status.phase === "loading") return <AnnouncementSkeleton />;
  if (status.phase === "offline-empty")
    return <OfflineEmpty section="announcements" />;
  if (status.phase === "empty")
    return (
      <EmptyState
        icon="MegaphoneIcon"
        title="No announcements yet"
        description="Check back later for updates"
      />
    );
```

Then remove the now-redundant `ListEmptyComponent` prop from the `<ScreenList>` below (since SectionView handles emptiness now). Find:

```tsx
      <ScreenList
        scrollEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="MegaphoneIcon"
            title="No announcements yet"
            description="Check back later for updates"
          />
        }
        data={data}
```

Replace with:

```tsx
      <ScreenList
        scrollEnabled={false}
        data={data}
```

**Note:** removing the import of `EmptyState` is also valid if it's no longer used in this file after the refactor. Run `grep "EmptyState" features/announcements/components/AnnouncementList.tsx` to check — if the only remaining reference is the import line, remove the import too. Otherwise leave it.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Dev build → Home tab → scroll to Announcements section. Verify skeleton → announcement cards.

- [ ] **Step 5: Stage**

```bash
git add features/announcements/components/AnnouncementList.tsx
```

Suggested commit message: `refactor(announcements): migrate AnnouncementList to useSectionStatus phase classification`

---

### Task 12: Migrate ScheduleComponent (Home sub-section)

**Files:**
- Modify: `features/announcements/components/ScheduleComponent.tsx`

**Context:** `ScheduleComponent` currently wraps its rendered cards in `<Skeleton isLoading={isLoading}>` from heroui-native, which renders the cards as shimmer until data arrives. This is a different pattern from the other screens — heroui-native's `Skeleton` is a wrapper, not a separate skeleton component. The migration here is lighter: add `useSectionStatus` to surface the offline-empty case, but keep the inline `<Skeleton isLoading>` for the loading shimmer (since rebuilding it as a separate skeleton component is out of scope).

- [ ] **Step 1: Add imports**

Insert after existing `useClassSchedule` import (around line 4):

```tsx
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
```

- [ ] **Step 2: Add phase check before existing early return**

Find this block (around lines 118-124 in the current file):

```tsx
  if (isError)
    return (
      <AppText className="text-red-500 p-4">
        {getApiErrorMessage(error)}
      </AppText>
    );
  if (!data) return null;
```

Replace with:

```tsx
  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError)
    return (
      <AppText className="text-red-500 p-4">
        {getApiErrorMessage(error)}
      </AppText>
    );

  if (status.phase === "offline-empty")
    return <OfflineEmpty section="schedule" />;

  // For phase "loading" we fall through to the existing <Skeleton isLoading> wrapper
  // below, which renders shimmer over the cards.
  if (!data) return null;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Dev build (logged in as Student) → Home tab. Verify Schedule cards shimmer → real schedule. Toggle airplane mode + clear cache → expect `OfflineEmpty` in Schedule section.

- [ ] **Step 5: Stage**

```bash
git add features/announcements/components/ScheduleComponent.tsx
```

Suggested commit message: `refactor(announcements): surface offline-empty state for ScheduleComponent`

---

### Task 13: Migrate CampusNewsSection (Home sub-section)

**Files:**
- Modify: `features/campus-news/components/CampusNewsSection.tsx`

**Context:** `CampusNewsSection` is unusual — its data comes from a REST endpoint (not PowerSync), and when posts are empty it returns `null` (hides the whole section). For this section, the right migration is: keep the "return null when empty" behavior for `ready+empty`, but show `OfflineEmpty` when offline + never loaded.

- [ ] **Step 1: Add imports**

Insert after the existing `useFacebookPosts` import (around line 5):

```tsx
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
```

- [ ] **Step 2: Replace the function body**

Replace the whole `CampusNewsSection` function (lines 9-48):

```tsx
export default function CampusNewsSection() {
  const { data, isLoading, isError, error, refetch } = useFacebookPosts();

  console.log("[CampusNews]", {
    isLoading,
    isError,
    data,
  });

  if (isLoading) {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader />
        <CampusNewsBannerSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader />
        <ErrorComponent
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  const posts = data?.posts ?? [];
  if (posts.length === 0) return null;

  return (
    <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
      <SectionHeader />
      <CampusNewsBanner posts={posts} />
    </View>
  );
}
```

…with:

```tsx
export default function CampusNewsSection() {
  const { data, isLoading, isError, error, refetch } = useFacebookPosts();
  const posts = data?.posts ?? [];

  const status = useSectionStatus({
    data: posts,
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError) {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader />
        <ErrorComponent
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  if (status.phase === "loading") {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader />
        <CampusNewsBannerSkeleton />
      </View>
    );
  }

  if (status.phase === "offline-empty") {
    return (
      <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
        <SectionHeader />
        <OfflineEmpty section="campus-news" />
      </View>
    );
  }

  // phase "empty" → hide section entirely (current behavior preserved)
  if (status.phase === "empty") return null;

  return (
    <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
      <SectionHeader />
      <CampusNewsBanner posts={posts} />
    </View>
  );
}
```

Also remove the `console.log("[CampusNews]", ...)` block — it's debug leftover.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test**

Dev build → Home tab. Verify Campus News skeleton → banner (if posts exist) or hidden (if empty). With airplane mode + cleared cache, verify OfflineEmpty appears under the section header.

- [ ] **Step 5: Stage**

```bash
git add features/campus-news/components/CampusNewsSection.tsx
```

Suggested commit message: `refactor(campus-news): use useSectionStatus, drop debug log, surface offline-empty`

---

## Phase 3 — Remove SyncGate

After Phase 2, every screen handles its own loading/offline state. SyncGate is now redundant.

### Task 14: Verify no remaining SyncGate/SyncSplash references, then delete

**Files:**
- Modify: `app/(main)/_layout.tsx`
- Delete: `features/sync/components/SyncGate.tsx`
- Delete: `features/sync/components/SyncSplash.tsx`

- [ ] **Step 1: Grep for any references**

Run:

```bash
grep -rn "SyncGate\|SyncSplash" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .
```

Expected: matches only inside `app/(main)/_layout.tsx` (the wrapper) and the two files themselves. If matches appear elsewhere, stop and migrate those references first — do not proceed until grep is clean except for the layout + the two source files.

- [ ] **Step 2: Update `app/(main)/_layout.tsx` — remove SyncGate import and wrapper**

Find and remove this import:

```tsx
import SyncGate from "@/features/sync/components/SyncGate";
```

Then find this block (around lines 22-67 in the current file):

```tsx
  return (
    <SyncSheetProvider>
      <SyncGate>
        <Stack screenOptions={{ ...headerOptions, headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          ...
          <Stack.Screen
            name="camera"
            options={{
              headerShown: false,
              animation: "slide_from_bottom",
            }}
          />
        </Stack>
      </SyncGate>
      <SyncSheet />
    </SyncSheetProvider>
  );
```

Replace `<SyncGate>...</SyncGate>` wrapper by removing the opening and closing tags, leaving the `<Stack>` directly inside `<SyncSheetProvider>`. The final shape:

```tsx
  return (
    <SyncSheetProvider>
      <Stack screenOptions={{ ...headerOptions, headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        ...
        <Stack.Screen
          name="camera"
          options={{
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
      <SyncSheet />
    </SyncSheetProvider>
  );
```

(The `...` represents the existing intermediate `<Stack.Screen>` entries — leave them all unchanged.)

- [ ] **Step 3: Delete the two files**

```bash
rm features/sync/components/SyncGate.tsx
rm features/sync/components/SyncSplash.tsx
```

- [ ] **Step 4: Re-grep to confirm**

```bash
grep -rn "SyncGate\|SyncSplash" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .
```

Expected: zero matches.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Manual smoke test (THE BIG ONE)**

Full login flow on a dev build:
- Log out
- Log back in with Microsoft
- Verify: tab bar appears within <1s of MS auth completing — no full-screen splash
- Each tab shows its own skeleton briefly, then real data
- Toggle airplane mode → NetworkBanner appears, tabs still navigable

- [ ] **Step 7: Stage**

```bash
git add app/\(main\)/_layout.tsx
git add -A features/sync/components/SyncGate.tsx features/sync/components/SyncSplash.tsx
```

Suggested commit message: `refactor(sync): remove SyncGate + SyncSplash, screens now self-manage loading`

---

### Task 15: Wire post-login telemetry

**Files:**
- Modify: `app/_layout.tsx` (call `armPostLoginReady` when `isAuthenticated` flips)
- Modify: `features/sync/useSectionStatus.ts` (call `markPostLoginReady` on first non-loading phase)

- [ ] **Step 1: Add `armPostLoginReady` trigger in root layout**

In `app/_layout.tsx`, find the import block at the top:

```tsx
import "@/global.css";
import * as Sentry from "@sentry/react-native";
import { initTelemetry } from "@/lib/telemetry";
```

Replace the `initTelemetry` import with:

```tsx
import { initTelemetry, armPostLoginReady } from "@/lib/telemetry";
```

Then find this destructure (around line 22):

```tsx
  const { restoreSession, clearCredentials, isAuthenticated, authUser } =
    useStore();
```

Immediately after the existing `useEffect(() => { loadSession(); }, []);` block (around line 47), add a new effect:

```tsx
  useEffect(() => {
    if (isAuthenticated) armPostLoginReady();
  }, [isAuthenticated]);
```

- [ ] **Step 2: Add `markPostLoginReady` call in useSectionStatus**

Open `features/sync/useSectionStatus.ts`. Add this import at the top (after the existing imports):

```ts
import { useEffect } from "react";
import { markPostLoginReady } from "@/lib/telemetry";
```

Then add this effect right before the `return` statement at the end of the hook:

```ts
  useEffect(() => {
    if (phase !== "loading") markPostLoginReady();
  }, [phase]);
```

The final hook should end with:

```ts
  useEffect(() => {
    if (phase !== "loading") markPostLoginReady();
  }, [phase]);

  return { phase, data: opts.data, hasSynced, isOnline };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual smoke test (only meaningful if `EXPO_PUBLIC_SENTRY_DSN` is set)**

If DSN is configured on the dev build:
- Trigger a login
- Check Sentry → confirm a `post_login_ready` event appears with `elapsedMs` extra

If no DSN, this is a no-op — the telemetry functions early-return. Move on.

- [ ] **Step 5: Stage**

```bash
git add app/_layout.tsx features/sync/useSectionStatus.ts
```

Suggested commit message: `feat(telemetry): record post_login_ready elapsed time on first non-loading section`

---

## Phase 4 — Verification

### Task 16: Run the spec's acceptance checklist

**Files:** none modified — verification only.

Walk through the checklist from `docs/superpowers/specs/2026-06-01-skeleton-first-dashboard-design.md`:

- [ ] All 6 tabs render their tab bar within ~500ms of `isAuthenticated=true` (eyeball it on a dev build — should feel instant compared to before)
- [ ] Returning user with cached data lands in `ready` state immediately on cold start (close + reopen app while logged in)
- [ ] Brand-new user offline sees `OfflineEmpty` on tabs (manual airplane-mode test: log out, enable airplane mode, log in — every tab should show OfflineEmpty, not skeletons forever)
- [ ] No skeleton persists indefinitely when online with empty data (a Teacher with no assigned courses should see the "No courses found" empty state, not a permanent skeleton)
- [ ] `SyncGate` and `SyncSplash` removed: `grep -rn "SyncGate\|SyncSplash" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .` returns zero hits
- [ ] Sentry events fire correctly on dev build with DSN set: `post_login_ready` appears on each fresh login
- [ ] Typecheck clean: `npx tsc --noEmit` exits 0

If any of these fail, stop and diagnose before declaring the migration done.

---

## Out-of-scope reminder

Per the spec, this PR explicitly does NOT touch:

- Detail screens (assessment, lesson, attempt, material, activity, announcement, event, classroom, course, subject, profile) — they already load on-demand and naturally benefit
- Auth flow (MS button → token write → route swap)
- PowerSync sync rules, priorities, stream definitions
- `NetworkBanner` design
- Sync Center / `SyncSheet` UI
- i18n for offline copy
- Phase-transition animations
- Source map upload to Sentry

If a task above tempts you to touch any of these, stop and ask the user.

---

## Rollback

Single PR — `git revert <merge-commit>` restores `SyncGate`, `SyncSplash`, the layout wrapper, and every screen's original conditional. No DB migrations, no server changes, no feature flag needed.
