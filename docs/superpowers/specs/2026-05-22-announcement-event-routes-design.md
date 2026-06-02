# Announcement & Event Detail Routes — Design

**Date:** 2026-05-22
**Status:** Draft — pending user review

## Goal

Add dedicated routes for announcement and event details so that tapping an announcement-type or event-type push notification (via OneSignal) opens the corresponding detail screen.

Today, `OneSignalProvider` and `NotificationList` only branch on `lesson` / `module` (→ `/material/[id]`) and fall through to `/assessment/[id]` for everything else. Announcement details are only rendered inline inside `AnnouncementList`, and event details are only shown in the in-list `EventDetailModal` bottom sheet. Neither surface is reachable from a notification.

## Non-Goals

- Refactoring the existing `EventDetailModal` bottom sheet. It stays in place for the announcement-list flow.
- Adding read receipts, comments, attachments, or any new fields beyond what the announcement / event tables already expose.
- Backend / OneSignal payload changes. The payload contract (`entityType` ∈ `{lesson, module, assessment, announcement, event}`, plus `entityId`) is assumed to already be in place.

## Routes & File Layout

Two new dynamic routes, following the existing `material` / `assessment` pattern.

```
app/(main)/
  announcement/[announcementId]/index.tsx   → delegates to AnnouncementDetailsScreen
  event/[eventId]/index.tsx                 → delegates to EventDetailsScreen

screens/main/
  announcement/AnnouncementDetailsScreen.tsx
  calendar/EventDetailsScreen.tsx
```

Each route file is a 1-liner that wraps the screen in `<Screen>`, matching `app/(main)/material/[materialId]/index.tsx`.

`app/(main)/_layout.tsx` registers two new `<Stack.Screen>` entries with the same `emptyTitleHeader` config used by the other detail routes:

```tsx
<Stack.Screen options={emptyTitleHeader} name="announcement/[announcementId]/index" />
<Stack.Screen options={emptyTitleHeader} name="event/[eventId]/index" />
```

## Data Layer

### Announcements

A new single-row fetch is needed; today only `getAnnouncementsWithEvents` (list) exists.

`features/announcements/announcements.service.ts` — add:

```ts
export const getAnnouncement = (announcementId: number) => {
  return db.query.announcementsTable.findFirst({
    where: (announcements, { eq }) => eq(announcements.id, announcementId),
    with: {
      createdById: {
        columns: { firstName: true, lastName: true, studentPhoto: true },
      },
      events: {
        with: {
          event: {
            with: {
              createdById: { columns: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
};
```

`features/announcements/announcements.hooks.ts` — add:

```ts
export const useAnnouncement = (announcementId: number) => {
  return useQuery(toCompilableQuery(getAnnouncement(announcementId)));
};
```

### Events

`getEvent(eventId)` and `useEvent(eventId)` already exist in `features/calendar/`. Reused as-is. No new data code for events.

## Screens

### `screens/main/calendar/EventDetailsScreen.tsx`

- Reads `eventId` via `useLocalSearchParams()` and coerces to `number`.
- Calls `useEvent(eventId)`.
- Renders the same field set as `EventDetailModal`'s `BottomSheetContent`: title, description, date/time (`DetailRow`), location, created-by, posted-at.
- Container: regular `ScrollView` (not `BottomSheetScrollView`).
- Loading → skeleton; error → error component; empty data → `EmptyState` ("Event not found").
- The existing `EventDetailModal` and its trigger inside `AnnouncementList` remain unchanged.

### `screens/main/announcement/AnnouncementDetailsScreen.tsx`

- Reads `announcementId` via `useLocalSearchParams()` and coerces to `number`.
- Calls `useAnnouncement(announcementId)`.
- Renders: author avatar + name + posted-date, title, description, and an "Associated Events" section.
- Each associated event renders as a pressable card (same visual as the inline `EventCard` in `AnnouncementList`). Press → `router.push('/event/' + event.id)`.
- Loading → skeleton; error → error component; empty data → `EmptyState` ("Announcement not found").

Both screens use existing primitives (`AppText`, `Icon`, `EmptyState`, `Avatar`, `AttachmentAvatarImage`, `formatDate`, `formatTime`). No new shared components are introduced.

## Notification Routing

A single helper is the source of truth for `entityType → route` mapping, used by both the OneSignal click handler and the in-app notifications list.

`features/notifications/notifications.service.ts` — add:

```ts
export const getNotificationHref = (
  entityType: string,
  entityId: string | number,
): string => {
  switch (entityType) {
    case "lesson":
    case "module":
      return `/material/${entityId}`;
    case "announcement":
      return `/announcement/${entityId}`;
    case "event":
      return `/event/${entityId}`;
    default:
      return `/assessment/${entityId}`;
  }
};
```

### `providers/OneSignalProvider.tsx`

Replace the inline if/else (lines 36–43) with a call to `getNotificationHref`:

```ts
router.push(getNotificationHref(entityType, entityId));
```

### `features/notifications/components/NotificationList.tsx`

Replace the inline ternary `href` (lines 88–94) with `getNotificationHref(entityType, entityId)`.

## Edge Cases

- **Invalid / non-numeric id param** in either route → render `EmptyState` ("not found"). No crash.
- **Query returns `undefined`** (deleted row or out-of-sync PowerSync state) → `EmptyState`.
- **Query error** → render an error component using `getApiErrorMessage`, mirroring the patterns already used in the codebase (`ErrorFallback` / `ErrorComponent`).
- **Notification with an unknown `entityType`** → `getNotificationHref` falls back to `/assessment/${entityId}`, preserving today's behavior. No regression.

## Verification

This project has no automated tests (per project memory). Verification is manual:

- Tap a notification of each type (announcement, event, lesson, module, assessment, unknown) — confirm the right screen opens in both cold-start (OneSignal click handler) and warm in-app (NotificationList) paths.
- Deep-link via an OneSignal payload with `entityType=announcement` / `entityType=event` and confirm the new screens open.
- Visit each new screen with a bad / non-existent id and confirm graceful empty state, not a crash.
- Confirm the announcement-list event modal still opens correctly (regression check).
