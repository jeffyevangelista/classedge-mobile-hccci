# Push-Payload-Hydrated Detail Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the race between OneSignal push delivery and PowerSync replication on every notification-target detail screen, by hydrating the screen from the push payload while PowerSync catches up.

**Architecture:** Three pieces working together. (1) A tiny in-memory cache (`pushPayloadCache.ts`) that the OneSignal click handler writes to before navigating, keyed by `entityType:entityId`. (2) A single resolution hook (`useEntityFromPushOrSync`) that every push-target detail screen uses; it merges three independent sources of truth — payload (first paint), PowerSync `watch()` (canonical), and an optional REST fallback — and exposes a unified loading/missing/error model. (3) Per-screen integration: each detail screen calls the hook with its existing PowerSync watch hook's row data and renders skeleton → payload → canonical without ever flashing "not found" during the replication gap.

**Tech Stack:** `react-native-onesignal` ^5, `@powersync/react-native` ^1.34, `@powersync/tanstack-react-query` (used by `useCourseMaterial`), `@powersync/drizzle-driver`, `expo-router` typed-routes, React 19. No new dependencies.

**Project conventions:**

- No Jest/Vitest setup — there is no `test` script in `package.json`. Verification is `pnpm typecheck` + `pnpm lint` + manual device runs. No test files are added in this plan.
- Per the user's standing instruction, this plan does **not** auto-stage or auto-commit. The user commits between tasks during the checkpoint step.
- Each task ends with a "Checkpoint" step describing what to show the user before the next task begins.
- Follow the existing import convention: `@/` is the alias for the repo root (see `tsconfig.json`).

**Out of scope (deliberately deferred):**

- **Backend payload contract.** This plan ships the client-side resolution machinery and makes it gracefully no-op when no payload is present. The race window only fully collapses once the server starts including `additionalData.payload` on push notifications (see "Server-side coordination" below). Until then, this plan still removes the "brief flash of 'not found'" artifact via the unified loading model.
- **REST fallback endpoints.** The hook's `apiFetch` parameter is optional. None of the three target screens have a per-entity REST endpoint today, so this plan does not add them. The hook is forward-compatible — when endpoints land, screens pass `apiFetch` to gain the cold-start guarantee.
- **`AssessmentDetailsScreen`.** The default branch of `getNotificationHref` routes to `/assessment/[id]`, so assessments are likely a push target too. Adding it follows the identical pattern from Tasks 4-6; confirm path and watch hook with the user before extending.

---

## Server-side coordination (required for full effect)

The race window collapses to zero only once the backend includes a `payload` field in every notification's `additionalData`. The shape **must match** what the watch returns so the hook can swap them transparently. Minimum fields per entity:

| `entityType` | Required `additionalData.payload` fields |
|---|---|
| `announcement` | `id, title, description, createdAt, createdById { firstName, lastName, studentPhoto }, events[]` |
| `event` | `id, title, description, startDate, endDate, time, location, createdAt, createdById { firstName, lastName }` |
| `lesson` / `module` | `id, fileName, file, description, url, iframeCode, startDate, endDate, subjectId` |

When the backend ships these, no client changes are needed — the cache and hook pick them up automatically.

---

## File Structure

**Created files:**

- `features/notifications/pushPayloadCache.ts` — process-local in-memory store, keyed by `entityType:entityId`, with a 5-minute TTL. Three exported functions: `setPushPayload`, `peekPushPayload`, `clearPushPayload`. No React; pure module state.
- `features/notifications/useEntityFromPushOrSync.ts` — the resolution hook. Generic over the row type. Accepts the screen's existing PowerSync watch row as input; owns only the resolution policy (payload → canonical → optional REST → settled).

**Modified files:**

- `providers/OneSignalProvider.tsx` — extend the click handler to `setPushPayload(entityType:entityId, payload)` before navigating.
- `screens/main/announcement/AnnouncementDetailsScreen.tsx` — adopt the hook.
- `screens/main/calendar/EventDetailsScreen.tsx` — adopt the hook.
- `screens/main/courses/course/material/MaterialDetailsScreen.tsx` — adopt the hook.

**No files deleted. No schema changes. No new dependencies.**

---

## Task 1: Create the push payload cache

**Why:** Every other piece in this plan depends on a single shared place to stash and retrieve per-entity payload data within the session. An in-memory `Map` is sufficient — payloads beyond a single session are stale anyway, and persisting to MMKV would just add complexity without value. A 5-minute TTL guards against stale payloads from very old pushes still hanging around if the app was backgrounded long enough for the entity to change server-side.

**Files:**
- Create: `features/notifications/pushPayloadCache.ts`

**Risk:** Very low. Pure module-scoped state with three small functions. No React, no async, no side effects beyond `Map` mutation.

- [ ] **Step 1: Create the file**

Create `features/notifications/pushPayloadCache.ts` with the following exact contents:

```ts
// Process-local cache of push notification payloads, keyed by
// `${entityType}:${entityId}`. Populated by the OneSignal click
// handler before navigation; consumed by useEntityFromPushOrSync to
// hydrate detail screens on first paint while PowerSync catches up.
//
// Lifetime is intentionally per-process. Payloads outlive a single
// screen mount (so back/forward navigation within a session still
// hydrates) but not a process restart. The TTL guards against very
// stale payloads if the app was backgrounded a long time.

const TTL_MS = 5 * 60_000;

type Entry = {
  payload: unknown;
  ts: number;
};

const cache = new Map<string, Entry>();

export const setPushPayload = (key: string, payload: unknown): void => {
  cache.set(key, { payload, ts: Date.now() });
};

export const peekPushPayload = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.payload as T;
};

export const clearPushPayload = (key: string): void => {
  cache.delete(key);
};
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: pass with no new errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: pass with no new warnings on the new file.

- [ ] **Step 4: Checkpoint**

Report to the user:
- Confirmation the file exists at `features/notifications/pushPayloadCache.ts`.
- Output of `pnpm typecheck` and `pnpm lint`.

Pause for user review and commit before starting Task 2.

---

## Task 2: Create the `useEntityFromPushOrSync` hook

**Why:** Centralizing the resolution policy in one hook is what makes this a permanent solution rather than a screen-by-screen patch. The hook merges three independent sources of truth, soft-failing each one: if no payload exists, fall through to watch; if watch returns null, optionally fall through to REST after a grace window; if all three settle empty, expose `isMissing` so the screen can render "not found." Canonical (`watch()`) always wins once it arrives, preserving offline-first single-source-of-truth semantics.

**Files:**
- Create: `features/notifications/useEntityFromPushOrSync.ts`

**Risk:** Low. Pure-React hook with two `useEffect`s and a `useRef` payload latch. No external state. Subtle correctness invariants (covered by the JSDoc in the file).

- [ ] **Step 1: Create the file**

Create `features/notifications/useEntityFromPushOrSync.ts` with the following exact contents:

```ts
import { useEffect, useRef, useState } from "react";
import {
  clearPushPayload,
  peekPushPayload,
} from "./pushPayloadCache";

export type EntitySource = "payload" | "local" | "api" | "none";

export type EntityResolution<T> = {
  /** Best-available data right now. Null only when every source has settled empty. */
  data: T | null;
  /** Which source produced `data`. "none" only when data is null. */
  source: EntitySource;
  /** True while at least one source might still produce data and we don't have any yet. */
  isResolving: boolean;
  /** True iff every source has settled and none returned data. Render the "not found" UI only when this is true. */
  isMissing: boolean;
  /** Error from the apiFetch fallback (if any). Local watch errors are not surfaced here. */
  error: unknown | null;
  /** Retry the apiFetch fallback. No-op if no apiFetch was provided. */
  retry: () => void;
};

export type UseEntityFromPushOrSyncParams<T> = {
  /** `${entityType}:${entityId}` — matches the key written by the OneSignal click handler. */
  entityKey: string;
  /** The row from a PowerSync watch hook. For array-returning hooks, pass `data?.[0] ?? null`. */
  localData: T | null | undefined;
  /** The watch's loading flag — relevant only for the very first paint. */
  localIsLoading: boolean;
  /** Optional REST fallback for the cold-start race. Wrap in `useCallback` at the call site if its identity could change. */
  apiFetch?: () => Promise<T | null>;
  /** How long to wait for watch / payload before firing apiFetch. */
  graceMs?: number;
};

/**
 * Resolves a detail-screen entity from three independent sources:
 *
 *   1. Push payload  — read once on mount from pushPayloadCache. Renders
 *                       first paint instantly if a push delivered the
 *                       entity blob alongside the notification.
 *   2. PowerSync watch — the canonical, reactive source of truth. Wins
 *                         the moment it produces a non-null row.
 *   3. REST apiFetch  — optional. Fires after `graceMs` if neither (1)
 *                         nor (2) produced data yet. Acts as a safety net
 *                         on cold start when PowerSync replication is slow.
 *
 * Priority on every render is `localData ?? apiData ?? payload ?? null`,
 * so canonical always overrides hydration, and the screen never flashes
 * "not found" during the replication gap.
 */
export const useEntityFromPushOrSync = <T>({
  entityKey,
  localData,
  localIsLoading,
  apiFetch,
  graceMs = 2500,
}: UseEntityFromPushOrSyncParams<T>): EntityResolution<T> => {
  // Read the payload exactly once on mount. peekPushPayload does not
  // delete the entry, so a remount during the same session (e.g. nav
  // back-and-forward) still hydrates from cache.
  const payloadRef = useRef<T | null>(null);
  if (payloadRef.current === null) {
    payloadRef.current = peekPushPayload<T>(entityKey);
  }
  const payload = payloadRef.current;

  const [apiData, setApiData] = useState<T | null>(null);
  const [apiSettled, setApiSettled] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Latest apiFetch in a ref so an unstable inline function from the
  // caller doesn't keep retriggering the timer effect on every render.
  const apiFetchRef = useRef(apiFetch);
  useEffect(() => {
    apiFetchRef.current = apiFetch;
  }, [apiFetch]);

  // Cold-start safety net: after graceMs, if neither canonical nor
  // payload covered us, fire the REST fallback.
  useEffect(() => {
    const fetcher = apiFetchRef.current;
    if (!fetcher) return;
    if (localData != null) return;
    if (payload != null) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetcher();
        if (!cancelled) setApiData(res);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setApiSettled(true);
      }
    }, graceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [localData, payload, graceMs, retryNonce]);

  // Once canonical (localData) arrives, free the cached payload. The
  // payloadRef captured at mount is preserved, so this clear has no
  // visible effect on the current screen; it just frees memory and
  // ensures a fresh navigation to the same entity doesn't pick up a
  // stale payload.
  useEffect(() => {
    if (localData != null) clearPushPayload(entityKey);
  }, [entityKey, localData]);

  const data: T | null = localData ?? apiData ?? payload ?? null;
  const source: EntitySource =
    localData != null
      ? "local"
      : apiData != null
        ? "api"
        : payload != null
          ? "payload"
          : "none";

  const apiInactive = apiFetch == null;
  const isResolving =
    data == null && (localIsLoading || (!apiInactive && !apiSettled));
  const isMissing =
    data == null && !localIsLoading && (apiInactive || apiSettled);

  return {
    data,
    source,
    isResolving,
    isMissing,
    error,
    retry: () => {
      setError(null);
      setApiData(null);
      setApiSettled(false);
      setRetryNonce((n) => n + 1);
    },
  };
};
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: pass. The generic `T` and optional `apiFetch` should infer cleanly.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: pass. The two `useEffect` hooks reference `payload` (the ref's `.current`) — this is intentional and safe because `payload` is captured at mount and never reassigned within the hook. Biome should not complain. If it does, add `// biome-ignore lint/correctness/useExhaustiveDependencies: ...` with a brief justification.

- [ ] **Step 4: Checkpoint**

Report to the user:
- Confirmation the file exists at `features/notifications/useEntityFromPushOrSync.ts`.
- Output of `pnpm typecheck` and `pnpm lint`.

Pause for user review and commit before starting Task 3.

---

## Task 3: Stash the payload in the OneSignal click handler

**Why:** Without this step, `peekPushPayload` always returns null and the hook silently degrades to watch-only behavior. This task wires the push handler to the cache, completing the producer side of the contract. The change is additive — if a particular push has no `payload` field in `additionalData`, nothing is stashed and the existing flow is unchanged.

**Files:**
- Modify: `providers/OneSignalProvider.tsx`

**Risk:** Very low. Two-line additive change inside the existing click handler. The `payload` field is destructured optionally, so older notifications without it pass through unchanged.

- [ ] **Step 1: Read the current `OneSignalProvider`**

Open `providers/OneSignalProvider.tsx`. The current click handler is:

```tsx
const clickHandler = (event: any) => {
  const data = event.notification.additionalData;

  if (data && data.entityType && data.entityId) {
    const { entityType, entityId, notificationId } = data;

    // Mark notification as read if notificationId is available
    if (notificationId) {
      readNotification(String(notificationId)).catch((err: any) =>
        console.log("Failed to mark notification as read:", err.message),
      );
    }

    const href = getNotificationHref(entityType, entityId);
    console.log("Redirecting to:", href);
    router.push(href);
  }
};
```

- [ ] **Step 2: Add the import**

At the top of `providers/OneSignalProvider.tsx`, add the following import alongside the existing ones:

```tsx
import { setPushPayload } from "@/features/notifications/pushPayloadCache";
```

- [ ] **Step 3: Modify the click handler**

Replace the entire `clickHandler` constant with:

```tsx
const clickHandler = (event: any) => {
  const data = event.notification.additionalData;

  if (data && data.entityType && data.entityId) {
    const { entityType, entityId, notificationId, payload } = data;

    // Mark notification as read if notificationId is available
    if (notificationId) {
      readNotification(String(notificationId)).catch((err: any) =>
        console.log("Failed to mark notification as read:", err.message),
      );
    }

    // Stash the per-entity payload so the target detail screen can
    // hydrate from it on first paint while PowerSync catches up.
    // Backwards-compatible: pushes without a `payload` field skip this.
    if (payload) {
      setPushPayload(`${entityType}:${entityId}`, payload);
    }

    const href = getNotificationHref(entityType, entityId);
    console.log("Redirecting to:", href);
    router.push(href);
  }
};
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: pass. `additionalData` is `any`, so destructuring `payload` is unconstrained at the type level.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: pass.

- [ ] **Step 6: Manual verification — payload is stashed**

This step requires the OneSignal dashboard. The objective is to confirm `setPushPayload` actually fires when a push that includes a `payload` field is tapped.

a. Open the OneSignal dashboard for the `Classedge Dev` app and compose a test notification.

b. Under "Additional Data" / "Custom Data", attach this JSON (any `entityType` is fine — the test only verifies the cache write):

```json
{
  "entityType": "announcement",
  "entityId": 999999,
  "notificationId": null,
  "payload": {
    "id": 999999,
    "title": "Test payload — ignore",
    "description": "If you see this rendered, hydration worked.",
    "createdAt": "2026-05-28T00:00:00Z"
  }
}
```

c. Send the test push to the dev device. Tap the notification.

d. Expected: app navigates to `/announcement/999999`. The screen will show "not found" since that announcement does not exist in the database (Task 4 will fix this) — that's fine. The point of this step is to verify the **cache** received the payload.

e. To confirm the cache write, temporarily add this log inside the new `if (payload)` block, then re-run the test push:

```tsx
if (payload) {
  setPushPayload(`${entityType}:${entityId}`, payload);
  console.log("[push] stashed payload for", `${entityType}:${entityId}`, payload);
}
```

Look for the log line in Metro. Remove the temp `console.log` after confirming.

- [ ] **Step 7: Checkpoint**

Report to the user:
- Diff of `providers/OneSignalProvider.tsx`.
- The Metro log line confirming the payload was stashed during Step 6.
- Confirmation the temp log was removed.

Pause for user review and commit before starting Task 4.

---

## Task 4: Adopt the hook in `AnnouncementDetailsScreen`

**Why:** This is the first screen migration. It demonstrates the call-site pattern for a watch hook that returns an **array** (`useAnnouncement` returns `data: Announcement[]` via Drizzle's `findMany`). Tasks 5 and 6 mirror this pattern with slight variations. After this task, navigating to an announcement detail from a push (or in-app from a list) will show the skeleton instead of "not found" during the replication gap, and — once the server ships payloads — will hydrate instantly from the payload.

**Files:**
- Modify: `screens/main/announcement/AnnouncementDetailsScreen.tsx`

**Risk:** Low. The new branches preserve the existing skeleton / error / not-found components — only the *trigger conditions* change. The render of the announcement body is unchanged.

- [ ] **Step 1: Read the current screen**

Open `screens/main/announcement/AnnouncementDetailsScreen.tsx`. The current component head is at lines 18-53; the announcement render is lines 55-112. Confirm the current shape before editing.

- [ ] **Step 2: Add the hook import**

In `screens/main/announcement/AnnouncementDetailsScreen.tsx`, add this import next to the existing `useAnnouncement` import:

```tsx
import { useEntityFromPushOrSync } from "@/features/notifications/useEntityFromPushOrSync";
```

- [ ] **Step 3: Replace the data-loading block**

Replace lines 18-53 of `AnnouncementDetailsScreen.tsx` (from `const AnnouncementDetailsScreen = () => {` through the closing `}` of the final `if (!announcement) {` block) with:

```tsx
const AnnouncementDetailsScreen = () => {
  const { announcementId } = useLocalSearchParams<{ announcementId: string }>();
  const numericId = Number(announcementId);
  const router = useRouter();

  const watch = useAnnouncement(numericId);
  const localAnnouncement = watch.data?.[0] ?? null;

  const {
    data: announcement,
    isResolving,
    isMissing,
    error,
    retry,
  } = useEntityFromPushOrSync({
    entityKey: `announcement:${numericId}`,
    localData: localAnnouncement,
    localIsLoading: watch.isLoading,
    // apiFetch intentionally omitted: no REST endpoint exists for a
    // single announcement today. Payload + watch are sufficient.
  });

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <NoDataFallback
        icon="MegaphoneIcon"
        title="Announcement not found"
        description="The announcement you're looking for doesn't exist"
      />
    );
  }

  if (!announcement && isResolving) return <AnnouncementDetailsSkeleton />;

  if (!announcement && (watch.error ?? error)) {
    return (
      <ErrorFallback
        message={getApiErrorMessage(watch.error ?? error)}
        onRefetch={() => {
          watch.refresh?.();
          retry();
        }}
      />
    );
  }

  if (!announcement && isMissing) {
    return (
      <NoDataFallback
        icon="MegaphoneIcon"
        title="Announcement not found"
        description="This announcement may have been removed"
      />
    );
  }

  if (!announcement) return <AnnouncementDetailsSkeleton />;
```

The rest of the file (lines 55-177 — `authorName` computation, the ScrollView render, `EventCard`, `AnnouncementDetailsSkeleton`, default export) stays exactly as it is.

Render-order rationale: data wins immediately; otherwise resolving → error → missing → fallback skeleton. The `watch.error ?? error` merge surfaces both Drizzle/PowerSync watch errors (when the local query throws) and `apiFetch` errors (when one is wired up later).

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: pass. `T` infers as the announcement row type from `useAnnouncement`'s return.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: pass. There may be an "unused import" hint if any of `useLocalSearchParams`, `useRouter`, etc. were removed during refactor — verify those are still used (the file still uses `useRouter` for the EventCard `onPress`).

- [ ] **Step 6: Manual verification — in-app navigation**

This step verifies the screen still works for the **non-push** code path, since the server isn't sending payloads yet.

a. Start the app: `pnpm start:dev`. Sign in.
b. Navigate to an announcement from the announcements list (Home / Announcements tab).
c. Expected: skeleton briefly, then the announcement renders. No "not found" flash.
d. Navigate back. Navigate forward to the same announcement.
e. Expected: announcement renders immediately (watch has the row cached from the prior visit).

- [ ] **Step 7: Manual verification — push with payload**

This step verifies the push-payload path using the OneSignal dashboard.

a. Pick a real announcement that exists on the dev server but is NOT yet in the local PowerSync database. (Easiest way: uninstall the app, send the push, install fresh, sign in but don't open the announcements tab — then tap the push immediately.)

b. Send a test push via the OneSignal dashboard with this `additionalData`:

```json
{
  "entityType": "announcement",
  "entityId": <id of the real announcement>,
  "notificationId": null,
  "payload": {
    "id": <id>,
    "title": "<announcement title>",
    "description": "<announcement description>",
    "createdAt": "<announcement createdAt>",
    "createdById": {
      "firstName": "<first>",
      "lastName": "<last>",
      "studentPhoto": "<photo path or empty string>"
    },
    "events": []
  }
}
```

c. Tap the notification.

d. Expected: the announcement renders **immediately** from the payload — title, description, author. No skeleton flash. When PowerSync replicates the row a moment later, the canonical version replaces the payload (typically visually identical; if any field is fresher, it updates).

e. (Optional) To confirm the source switched from `payload` to `local`, temporarily log `source` from the hook's return next to the JSX render:

```tsx
console.log("[announcement]", { source, hasData: !!announcement });
```

Expected log sequence: `payload, true` → `local, true`. Remove the log after verifying.

- [ ] **Step 8: Checkpoint**

Report to the user:
- Diff of `screens/main/announcement/AnnouncementDetailsScreen.tsx`.
- Confirmation from Step 6 (in-app navigation still works).
- Confirmation from Step 7 (push hydration works), or note that Step 7 was skipped pending server-side payload contract.

Pause for user review and commit before starting Task 5.

---

## Task 5: Adopt the hook in `EventDetailsScreen`

**Why:** Same pattern as Task 4, applied to events. `useEvent` returns an array (via Drizzle `findMany`) so the call-site shape is identical. Events are notification targets via the `event` `entityType` (see `getNotificationHref` in `features/notifications/notifications.service.ts:54`).

**Files:**
- Modify: `screens/main/calendar/EventDetailsScreen.tsx`

**Risk:** Low. Mirrors Task 4.

- [ ] **Step 1: Read the current screen**

Open `screens/main/calendar/EventDetailsScreen.tsx`. The current data-loading block is lines 16-50. Confirm the current shape before editing.

- [ ] **Step 2: Add the hook import**

Add to `screens/main/calendar/EventDetailsScreen.tsx`:

```tsx
import { useEntityFromPushOrSync } from "@/features/notifications/useEntityFromPushOrSync";
```

- [ ] **Step 3: Replace the data-loading block**

Replace lines 16-50 of `EventDetailsScreen.tsx` (from `const EventDetailsScreen = () => {` through the closing `}` of the final `if (!event) {` block) with:

```tsx
const EventDetailsScreen = () => {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const numericId = Number(eventId);
  const accentColor = useThemeColor("accent");

  const watch = useEvent(numericId);
  const localEvent = watch.data?.[0] ?? null;

  const {
    data: event,
    isResolving,
    isMissing,
    error,
    retry,
  } = useEntityFromPushOrSync({
    entityKey: `event:${numericId}`,
    localData: localEvent,
    localIsLoading: watch.isLoading,
    // apiFetch intentionally omitted: no REST endpoint exists for a
    // single event today. Payload + watch are sufficient.
  });

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <NoDataFallback
        icon="CalendarIcon"
        title="Event not found"
        description="The event you're looking for doesn't exist"
      />
    );
  }

  if (!event && isResolving) return <EventDetailsSkeleton />;

  if (!event && (watch.error ?? error)) {
    return (
      <ErrorFallback
        message={getApiErrorMessage(watch.error ?? error)}
        onRefetch={() => {
          watch.refetch?.();
          retry();
        }}
      />
    );
  }

  if (!event && isMissing) {
    return (
      <NoDataFallback
        icon="CalendarIcon"
        title="Event not found"
        description="This event may have been removed"
      />
    );
  }

  if (!event) return <EventDetailsSkeleton />;
```

The rest of the file (lines 52-171 — `startDate`/`endDate`/`dateText` derivation, ScrollView render, `DetailRow`, `EventDetailsSkeleton`, default export) stays exactly as it is.

Note: `useEvent` exposes `refetch` (not `refresh`) per its hook definition — that's why the on-refetch handler calls `watch.refetch?.()` here instead of `watch.refresh?.()` like in Task 4.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: pass.

- [ ] **Step 6: Manual verification — in-app navigation**

a. From the Calendar tab, tap an event.
b. Expected: skeleton briefly, then event renders. No "not found" flash.

- [ ] **Step 7: Manual verification — push with payload**

Same procedure as Task 4 Step 7, but with `entityType: "event"` and the event-specific payload shape:

```json
{
  "entityType": "event",
  "entityId": <id>,
  "notificationId": null,
  "payload": {
    "id": <id>,
    "title": "<event title>",
    "description": "<event description>",
    "startDate": "<startDate>",
    "endDate": "<endDate>",
    "time": "<time or null>",
    "location": "<location or null>",
    "createdAt": "<createdAt>",
    "createdById": {
      "firstName": "<first>",
      "lastName": "<last>"
    }
  }
}
```

Expected: event renders immediately from payload, then canonical takes over.

- [ ] **Step 8: Checkpoint**

Report to the user:
- Diff of `screens/main/calendar/EventDetailsScreen.tsx`.
- Confirmation Steps 6 and 7 pass.

Pause for user review and commit before starting Task 6.

---

## Task 6: Adopt the hook in `MaterialDetailsScreen`

**Why:** Same pattern, but the watch hook here (`useCourseMaterial`) is wrapped by `@powersync/tanstack-react-query` and returns a **single** row directly (not an array). The call site is slightly different — no `?.[0]` indexing. This task covers the `lesson` / `module` `entityType`.

**Files:**
- Modify: `screens/main/courses/course/material/MaterialDetailsScreen.tsx`

**Risk:** Low.

- [ ] **Step 1: Read the current screen**

Open `screens/main/courses/course/material/MaterialDetailsScreen.tsx`. The current data-loading block is lines 25-39. Confirm the shape before editing.

- [ ] **Step 2: Add the hook import**

Add to `screens/main/courses/course/material/MaterialDetailsScreen.tsx`:

```tsx
import { useEntityFromPushOrSync } from "@/features/notifications/useEntityFromPushOrSync";
```

- [ ] **Step 3: Replace the data-loading block**

Replace lines 25-39 of `MaterialDetailsScreen.tsx` (from `const MaterialDetailsScreen = () => {` through the closing `);` of the `if (!data)` `NoDataFallback` return) with:

```tsx
const MaterialDetailsScreen = () => {
  const { materialId } = useLocalSearchParams();
  const watch = useCourseMaterial(materialId as string);

  const {
    data,
    isResolving,
    isMissing,
    error,
    retry,
  } = useEntityFromPushOrSync({
    entityKey: `material:${materialId}`,
    localData: watch.data ?? null,
    localIsLoading: watch.isLoading,
    // apiFetch intentionally omitted: no REST endpoint exists for a
    // single material today. Payload + watch are sufficient.
  });

  if (!data && isResolving) return <MaterialDetailsSkeleton />;

  if (!data && (watch.error ?? error)) {
    return (
      <ErrorFallback
        message={getApiErrorMessage(watch.error ?? error)}
      />
    );
  }

  if (!data && isMissing) {
    return (
      <NoDataFallback
        title="Material not found"
        description="The material you're looking for doesn't exist"
      />
    );
  }

  if (!data) return <MaterialDetailsSkeleton />;
```

The rest of the file (lines 41-269 — `formatDate`, Screen / ScrollView render, `IFrameViewer`, `LinkCard`, `MaterialDetailsSkeleton`, default export) stays exactly as it is.

Notes:
- `useCourseMaterial` returns `data` as a single row (not an array), so `watch.data ?? null` is the local row — no `[0]` indexing.
- The original screen didn't pass an `onRefetch` to `ErrorFallback`. Preserve that — `useCourseMaterial` doesn't expose a manual refetch handle on the destructured shape currently used. If a retry button is desired later, switch to React Query's `refetch` from the hook.
- The original screen didn't validate `materialId` (it's a CUID string, not a number), so no `Number.isFinite` guard is added.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: pass.

- [ ] **Step 6: Manual verification — in-app navigation**

a. Open a course, navigate to a material from the materials list.
b. Expected: skeleton briefly, then material renders. No "not found" flash.

- [ ] **Step 7: Manual verification — push with payload**

Same procedure as Task 4 Step 7, but `entityType: "lesson"` (or `"module"` — both route to `/material/[id]`) and the material payload shape:

```json
{
  "entityType": "lesson",
  "entityId": "<material id — string CUID>",
  "notificationId": null,
  "payload": {
    "id": "<id>",
    "fileName": "<file name>",
    "file": "<file path or empty>",
    "description": "<description>",
    "url": "<url or empty>",
    "iframeCode": "<iframe html or empty>",
    "startDate": "<startDate>",
    "endDate": "<endDate>",
    "subjectId": <number>
  }
}
```

Expected: material renders immediately from payload, canonical takes over once replicated.

- [ ] **Step 8: Checkpoint**

Report to the user:
- Diff of `screens/main/courses/course/material/MaterialDetailsScreen.tsx`.
- Confirmation Steps 6 and 7 pass.
- A note on whether `AssessmentDetailsScreen` should be added as a follow-up plan (the default branch of `getNotificationHref` routes assessment notifications to `/assessment/[id]` — same race condition likely applies there).

Pause for user review and commit. Implementation is complete after this task.

---

## Self-Review

Re-reading against the spec:

- ✅ **Item 1 of design (server contract):** Documented in the "Server-side coordination" section. The hook + handler are forward-compatible — they no-op when no payload is present, so the client can ship today and the race window collapses as soon as the backend ships payloads.
- ✅ **Item 2 of design (`useEntityFromPushOrSync` hook):** Task 2 creates the full hook, including the three-source priority chain, optional REST fallback, retry, and source attribution.
- ✅ **Item 3 of design (`pushPayloadCache`):** Task 1 creates the cache with TTL.
- ✅ **Item 4 of design (OneSignal handler stash):** Task 3, single additive change.
- ✅ **Item 5 of design (per-screen integration):** Tasks 4, 5, 6 cover announcement, event, material.
- ⚠️ **`AssessmentDetailsScreen`:** Deliberately deferred per "Out of scope" — flagged in Task 6's checkpoint so the user can decide whether to extend.

**Placeholder scan:** Every step has either a full code block or an exact command. No "TBD" / "add appropriate" / "similar to" references. Task 6 says "same procedure as Task 4 Step 7" but explicitly provides the substituted JSON payload — that's a parameterization, not a placeholder.

**Type consistency:** `EntityResolution<T>`, `EntitySource`, `UseEntityFromPushOrSyncParams<T>`, `setPushPayload`, `peekPushPayload`, `clearPushPayload`, and the `useEntityFromPushOrSync` export name all appear consistently across Tasks 1, 2, 3, 4, 5, 6. The `entityKey` format (`${entityType}:${entityId}`) is produced identically in Task 3 (handler) and consumed in Tasks 4, 5, 6 (screens).

**Naming consistency:** Hook destructure uses `data: announcement` (Task 4), `data: event` (Task 5), and `data` (Task 6 — material screen already used `data` for the row variable). The body JSX in each screen continues to reference the same identifier the rest of the file expects.

**Edge cases verified in the hook design:**
- No payload, watch resolves to row: `source = local`, instant render.
- No payload, watch resolves to null, no apiFetch: `isMissing` true after `localIsLoading` flips false. Screen shows NoDataFallback.
- Payload present, watch resolves to row: payload renders first paint, replaced by canonical when watch arrives (single re-render, no flicker).
- Payload present, watch resolves to null: payload remains rendered (entity may have been server-deleted between push and tap — graceful stale display, not error).
- Cold start with apiFetch: payload first, then canonical or REST, whichever wins.

No gaps found.
