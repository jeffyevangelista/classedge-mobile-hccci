# Announcement & Event Detail Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/announcement/[id]` and `/event/[id]` routes so push notifications (OneSignal) and in-app notification taps can deep-link to announcement and event details.

**Architecture:** Two new Expo Router dynamic routes under `app/(main)/`, each delegating to a screen in `screens/main/`. A single `getNotificationHref` helper in `features/notifications/notifications.service.ts` is the source of truth for `entityType → route` mapping, consumed by both `OneSignalProvider` and `NotificationList`. The existing `EventDetailModal` bottom-sheet flow inside `AnnouncementList` is unchanged.

**Tech Stack:** Expo Router 6, HeroUI Native, Uniwind (Tailwind v4), PowerSync + Drizzle, pnpm. No automated test suite — verification is by typecheck + manual run in the Expo dev client.

**Project note:** This project has no automated tests (per project memory). TDD steps are replaced with **typecheck + manual verification**. Each task ends with `pnpm tsc --noEmit` and a manual smoke check where applicable.

---

## File Structure

**Create:**
- `app/(main)/event/[eventId]/index.tsx` — route entry, 1-liner that wraps `EventDetailsScreen` in `Screen`.
- `app/(main)/announcement/[announcementId]/index.tsx` — same pattern for announcements.
- `screens/main/calendar/EventDetailsScreen.tsx` — event detail body.
- `screens/main/announcement/AnnouncementDetailsScreen.tsx` — announcement detail body.

**Modify:**
- `features/announcements/announcements.service.ts` — add `getAnnouncement(id)`.
- `features/announcements/announcements.hooks.ts` — add `useAnnouncement(id)`.
- `features/notifications/notifications.service.ts` — add `getNotificationHref` helper.
- `features/notifications/components/NotificationList.tsx` — use `getNotificationHref` for the `Link href`.
- `providers/OneSignalProvider.tsx` — use `getNotificationHref` in click handler.
- `app/(main)/_layout.tsx` — register both new `Stack.Screen` entries.

---

## Task 1: Add single-row announcement service + hook

**Files:**
- Modify: `client-mobile/features/announcements/announcements.service.ts`
- Modify: `client-mobile/features/announcements/announcements.hooks.ts`

- [ ] **Step 1: Add `getAnnouncement(id)` to the service**

In `client-mobile/features/announcements/announcements.service.ts`, append:

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

- [ ] **Step 2: Add `useAnnouncement(id)` to the hooks file**

In `client-mobile/features/announcements/announcements.hooks.ts`, replace the file contents with:

```ts
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react";
import { getAnnouncement, getAnnouncementsWithEvents } from "./announcements.service";

export const useAnnouncementsWithEvents = () => {
  return useQuery(toCompilableQuery(getAnnouncementsWithEvents()));
};

export const useAnnouncement = (announcementId: number) => {
  return useQuery(toCompilableQuery(getAnnouncement(announcementId)));
};
```

- [ ] **Step 3: Typecheck**

Run from `client-mobile/`:
```
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd client-mobile
git add features/announcements/announcements.service.ts features/announcements/announcements.hooks.ts
git commit -m "feat(announcements): add single-row getAnnouncement service and useAnnouncement hook"
```

---

## Task 2: Add `getNotificationHref` helper

**Files:**
- Modify: `client-mobile/features/notifications/notifications.service.ts`

- [ ] **Step 1: Append the helper to the service file**

At the end of `client-mobile/features/notifications/notifications.service.ts`, add:

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

- [ ] **Step 2: Typecheck**

```
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/notifications/notifications.service.ts
git commit -m "feat(notifications): add getNotificationHref entityType→route mapping"
```

---

## Task 3: Use helper in `NotificationList.tsx`

**Files:**
- Modify: `client-mobile/features/notifications/components/NotificationList.tsx:88-94`

- [ ] **Step 1: Add the import**

In `client-mobile/features/notifications/components/NotificationList.tsx`, find the existing import:

```ts
import { readNotification } from "../notifications.service";
```

Replace it with:

```ts
import { getNotificationHref, readNotification } from "../notifications.service";
```

- [ ] **Step 2: Replace the inline href ternary**

In the same file, find the `Link` block (around lines 88–94):

```tsx
<Link
  href={
    entityType === "lesson"
      ? `/material/${entityId}`
      : `/assessment/${entityId}`
  }
  asChild
>
```

Replace it with:

```tsx
<Link href={getNotificationHref(entityType, entityId)} asChild>
```

- [ ] **Step 3: Typecheck**

```
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add features/notifications/components/NotificationList.tsx
git commit -m "refactor(notifications): use getNotificationHref in NotificationList"
```

---

## Task 4: Use helper in `OneSignalProvider.tsx`

**Files:**
- Modify: `client-mobile/providers/OneSignalProvider.tsx:6,36-43`

- [ ] **Step 1: Update the import**

In `client-mobile/providers/OneSignalProvider.tsx`, replace:

```ts
import { readNotification } from "@/features/notifications/notifications.service";
```

with:

```ts
import {
  getNotificationHref,
  readNotification,
} from "@/features/notifications/notifications.service";
```

- [ ] **Step 2: Replace the inline if/else routing block**

In the same file, find the block (around lines 36–43):

```ts
// Route based on entityType, matching NotificationList logic
if (entityType === "lesson" || entityType === "module") {
  console.log("Redirecting to material:", entityId);
  router.push(`/material/${entityId}`);
} else {
  console.log("Redirecting to assessment:", entityId);
  router.push(`/assessment/${entityId}`);
}
```

Replace it with:

```ts
const href = getNotificationHref(entityType, entityId);
console.log("Redirecting to:", href);
router.push(href);
```

- [ ] **Step 3: Typecheck**

```
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add providers/OneSignalProvider.tsx
git commit -m "refactor(onesignal): use getNotificationHref in click handler"
```

---

## Task 5: Create `EventDetailsScreen`

**Files:**
- Create: `client-mobile/screens/main/calendar/EventDetailsScreen.tsx`

- [ ] **Step 1: Create the screen file**

Create `client-mobile/screens/main/calendar/EventDetailsScreen.tsx` with:

```tsx
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { useEvent } from "@/features/calendar/calendar.hooks";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const EventDetailsScreen = () => {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const numericId = Number(eventId);
  const accentColor = useThemeColor("accent");

  const { data, isLoading, isError, error, refetch } = useEvent(numericId);
  const event = data?.[0];

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <NoDataFallback
        icon="CalendarIcon"
        title="Event not found"
        description="The event you're looking for doesn't exist"
      />
    );
  }

  if (isLoading) return <EventDetailsSkeleton />;

  if (isError) {
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );
  }

  if (!event) {
    return (
      <NoDataFallback
        icon="CalendarIcon"
        title="Event not found"
        description="This event may have been removed"
      />
    );
  }

  const startDate = formatDate(event.startDate);
  const endDate = formatDate(event.endDate);
  const dateText =
    startDate === endDate ? startDate : `${startDate} – ${endDate}`;

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-3xl mx-auto px-5 pt-2">
        <View className="mb-6">
          <AppText weight="bold" className="text-2xl text-foreground mb-2">
            {event.title}
          </AppText>
          {event.description ? (
            <AppText className="text-muted leading-relaxed">
              {event.description}
            </AppText>
          ) : null}
        </View>

        <View className="gap-4">
          <DetailRow
            iconName="CalendarIcon"
            iconColor={accentColor}
            label="Date"
            value={dateText}
            extra={event.time ? formatTime(event.time) : undefined}
          />

          {event.location ? (
            <DetailRow
              iconName="MapPinIcon"
              iconColor={accentColor}
              label="Location"
              value={event.location}
            />
          ) : null}

          {event.createdById ? (
            <DetailRow
              iconName="UserIcon"
              iconColor={accentColor}
              label="Created by"
              value={toTitleCase(
                `${event.createdById.firstName} ${event.createdById.lastName}`,
              )}
            />
          ) : null}

          <DetailRow
            iconName="ClockIcon"
            iconColor={accentColor}
            label="Posted"
            value={new Date(event.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const DetailRow = ({
  iconName,
  iconColor,
  label,
  value,
  extra,
}: {
  iconName: "CalendarIcon" | "MapPinIcon" | "UserIcon" | "ClockIcon";
  iconColor: string;
  label: string;
  value: string;
  extra?: string;
}) => (
  <View className="flex-row items-start gap-3">
    <View className="mt-1">
      <Icon name={iconName} size={20} color={iconColor} />
    </View>
    <View className="flex-1">
      <AppText weight="semibold" className="text-foreground mb-1">
        {label}
      </AppText>
      <AppText className="text-muted">{value}</AppText>
      {extra ? <AppText className="text-muted">{extra}</AppText> : null}
    </View>
  </View>
);

const EventDetailsSkeleton = () => (
  <View className="w-full max-w-3xl mx-auto px-5 pt-2">
    <View className="mb-6 gap-2">
      <Skeleton className="h-7 w-3/4 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
    </View>
    <View className="gap-4">
      {Array(3)
        .fill(0)
        .map((_, i) => (
          <View key={i} className="flex-row items-start">
            <Skeleton className="w-5 h-5 rounded mr-3 mt-1" />
            <View className="flex-1 gap-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-36 rounded" />
            </View>
          </View>
        ))}
    </View>
  </View>
);

export default EventDetailsScreen;
```

- [ ] **Step 2: Typecheck**

```
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add screens/main/calendar/EventDetailsScreen.tsx
git commit -m "feat(calendar): add EventDetailsScreen for /event/[id] route"
```

---

## Task 6: Create the `/event/[eventId]` route entry

**Files:**
- Create: `client-mobile/app/(main)/event/[eventId]/index.tsx`

- [ ] **Step 1: Create the route file**

Create `client-mobile/app/(main)/event/[eventId]/index.tsx`:

```tsx
import Screen from "@/components/screen";
import EventDetailsScreen from "@/screens/main/calendar/EventDetailsScreen";

const EventDetailsRoute = () => {
  return (
    <Screen>
      <EventDetailsScreen />
    </Screen>
  );
};

export default EventDetailsRoute;
```

- [ ] **Step 2: Typecheck**

```
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/event/\[eventId\]/index.tsx
git commit -m "feat(routes): add /event/[eventId] route"
```

---

## Task 7: Create `AnnouncementDetailsScreen`

**Files:**
- Create: `client-mobile/screens/main/announcement/AnnouncementDetailsScreen.tsx`

- [ ] **Step 1: Create the screen file**

Create `client-mobile/screens/main/announcement/AnnouncementDetailsScreen.tsx`:

```tsx
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar, Separator, Skeleton, Surface } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { useAnnouncement } from "@/features/announcements/announcements.hooks";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const AnnouncementDetailsScreen = () => {
  const { announcementId } = useLocalSearchParams<{ announcementId: string }>();
  const numericId = Number(announcementId);
  const router = useRouter();

  const { data, isLoading, isError, error, refetch } =
    useAnnouncement(numericId);
  const announcement = data?.[0];

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <NoDataFallback
        icon="MegaphoneIcon"
        title="Announcement not found"
        description="The announcement you're looking for doesn't exist"
      />
    );
  }

  if (isLoading) return <AnnouncementDetailsSkeleton />;

  if (isError) {
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );
  }

  if (!announcement) {
    return (
      <NoDataFallback
        icon="MegaphoneIcon"
        title="Announcement not found"
        description="This announcement may have been removed"
      />
    );
  }

  const authorName = toTitleCase(
    `${announcement.createdById.firstName} ${announcement.createdById.lastName}`,
  );

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-3xl mx-auto px-5 pt-2 gap-4">
        <View className="flex-row items-center gap-2">
          <Avatar
            alt={authorName}
            size="sm"
            className="border border-border"
          >
            <AttachmentAvatarImage path={announcement.createdById.studentPhoto} />
            <AvatarFallbackImage />
          </Avatar>
          <View>
            <AppText weight="semibold" className="text-base">
              {authorName}
            </AppText>
            <AppText className="text-xs text-muted">
              {formatDate(announcement.createdAt)}
            </AppText>
          </View>
        </View>

        <Separator />

        <AppText weight="bold" className="text-2xl text-foreground">
          {announcement.title}
        </AppText>

        <AppText className="text-sm leading-relaxed text-foreground">
          {announcement.description}
        </AppText>

        {announcement.events.length > 0 && (
          <>
            <AppText weight="semibold" className="text-base mt-2">
              Associated Events
            </AppText>
            <View className="gap-2">
              {announcement.events.map((eventLink) => (
                <EventCard
                  key={eventLink.event.id}
                  event={eventLink.event}
                  onPress={() => router.push(`/event/${eventLink.event.id}`)}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

type EventCardProps = {
  event: {
    id: number;
    title: string;
    location: string | null;
    startDate: string;
    time: string | null;
    createdById?: { firstName: string; lastName: string } | null;
  };
  onPress: () => void;
};

const EventCard = ({ event, onPress }: EventCardProps) => (
  <Pressable onPress={onPress} className="active:opacity-80">
    <Surface variant="secondary" className="rounded-xl p-3 gap-2.5">
      <AppText weight="semibold" className="text-base">
        {event.title}
      </AppText>
      {event.createdById ? (
        <AppText className="text-xs text-muted">
          By{" "}
          {toTitleCase(
            `${event.createdById.firstName} ${event.createdById.lastName}`,
          )}
        </AppText>
      ) : null}
      <View className="gap-1">
        {event.location ? (
          <View className="flex-row items-center gap-1">
            <Icon name="MapPinIcon" size={14} className="text-muted" />
            <AppText className="text-xs text-muted">{event.location}</AppText>
          </View>
        ) : null}
        <View className="flex-row items-center gap-1">
          <Icon name="ClockIcon" size={14} className="text-muted" />
          <AppText className="text-xs text-muted">
            {formatDate(event.startDate)}
            {event.time ? ` - ${formatTime(event.time)}` : ""}
          </AppText>
        </View>
      </View>
    </Surface>
  </Pressable>
);

const AnnouncementDetailsSkeleton = () => (
  <View className="w-full max-w-3xl mx-auto px-5 pt-2 gap-4">
    <View className="flex-row items-center gap-2">
      <Skeleton className="w-8 h-8 rounded-full" />
      <View className="flex-1 gap-1">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </View>
    </View>
    <Skeleton className="h-7 w-3/4 rounded" />
    <Skeleton className="h-4 w-full rounded" />
    <Skeleton className="h-4 w-full rounded" />
    <Skeleton className="h-4 w-2/3 rounded" />
    <Skeleton className="h-20 w-full rounded mt-2" />
  </View>
);

export default AnnouncementDetailsScreen;
```

- [ ] **Step 2: Typecheck**

```
pnpm tsc --noEmit
```
Expected: no errors. If `event.location`, `event.time`, or `event.startDate` field types differ from what the `EventCardProps` declares (e.g. non-nullable), tighten/loosen the type to match the schema row — do not change the schema.

- [ ] **Step 3: Commit**

```bash
git add screens/main/announcement/AnnouncementDetailsScreen.tsx
git commit -m "feat(announcements): add AnnouncementDetailsScreen for /announcement/[id] route"
```

---

## Task 8: Create the `/announcement/[announcementId]` route entry

**Files:**
- Create: `client-mobile/app/(main)/announcement/[announcementId]/index.tsx`

- [ ] **Step 1: Create the route file**

Create `client-mobile/app/(main)/announcement/[announcementId]/index.tsx`:

```tsx
import Screen from "@/components/screen";
import AnnouncementDetailsScreen from "@/screens/main/announcement/AnnouncementDetailsScreen";

const AnnouncementDetailsRoute = () => {
  return (
    <Screen>
      <AnnouncementDetailsScreen />
    </Screen>
  );
};

export default AnnouncementDetailsRoute;
```

- [ ] **Step 2: Typecheck**

```
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/announcement/\[announcementId\]/index.tsx
git commit -m "feat(routes): add /announcement/[announcementId] route"
```

---

## Task 9: Register routes in `_layout.tsx`

**Files:**
- Modify: `client-mobile/app/(main)/_layout.tsx`

- [ ] **Step 1: Add the two Stack.Screen entries**

In `client-mobile/app/(main)/_layout.tsx`, find the existing block of `<Stack.Screen options={emptyTitleHeader} ...>` entries (around lines 29–48). After the existing `activity/[activityId]/index` entry, add:

```tsx
<Stack.Screen
  options={emptyTitleHeader}
  name="announcement/[announcementId]/index"
/>
<Stack.Screen
  options={emptyTitleHeader}
  name="event/[eventId]/index"
/>
```

The full updated block should look like:

```tsx
<Stack.Screen
  options={emptyTitleHeader}
  name="assessment/[assessmentId]/index"
/>
<Stack.Screen
  options={emptyTitleHeader}
  name="material/[materialId]/index"
/>
<Stack.Screen
  options={emptyTitleHeader}
  name="attempt/[attemptId]/index"
/>
<Stack.Screen
  options={emptyTitleHeader}
  name="lesson/[lessonId]/index"
/>
<Stack.Screen
  options={emptyTitleHeader}
  name="activity/[activityId]/index"
/>
<Stack.Screen
  options={emptyTitleHeader}
  name="announcement/[announcementId]/index"
/>
<Stack.Screen
  options={emptyTitleHeader}
  name="event/[eventId]/index"
/>
```

- [ ] **Step 2: Typecheck**

```
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/_layout.tsx
git commit -m "feat(routes): register announcement and event detail routes in main layout"
```

---

## Task 10: Manual verification

**Files:** none modified.

- [ ] **Step 1: Start the dev client**

From `client-mobile/`:
```
pnpm start
```
Open the app on a device / simulator.

- [ ] **Step 2: Verify announcement deep-link**

Trigger or simulate an OneSignal notification with `additionalData = { entityType: "announcement", entityId: <known-id>, notificationId: <id> }`. (If you can't trigger a real push, temporarily log in as a user with an existing announcement notification in the in-app list and tap it.) Confirm the announcement detail screen opens with title, description, author, and associated events visible.

- [ ] **Step 3: Verify event deep-link**

Same as above with `entityType: "event"`. Confirm the event detail screen opens with title, date, location, created-by, posted-at.

- [ ] **Step 4: Verify associated-event navigation from announcement detail**

On the announcement detail screen, tap an associated event card. Confirm it navigates to `/event/[id]` and the event detail screen renders.

- [ ] **Step 5: Verify no regressions**

- Tap a `lesson` / `module` notification → still goes to `/material/[id]`.
- Tap an `assessment` notification (or any unknown type) → still goes to `/assessment/[id]`.
- Open the announcements tab — confirm `AnnouncementList` still renders and tapping an event card in the list still opens the `EventDetailModal` bottom sheet (not the new route).

- [ ] **Step 6: Verify bad-id graceful states**

In a temporary build, navigate manually to `/event/999999999` and `/announcement/999999999`. Confirm each shows the "not found" `NoDataFallback`, not a crash.

- [ ] **Step 7: No commit needed**

Manual verification produces no file changes. If any defect surfaces, fix in a follow-up commit before declaring done.

---

## Self-Review Notes

- **Spec coverage:** All five spec sections (routes, data layer, screens, notification routing, edge cases) are mapped to tasks 1–9; verification covers section 6.
- **No tests:** project has no automated suite (per memory) — substituted typecheck + manual checks.
- **Helper naming:** `getNotificationHref` used identically in tasks 2, 3, 4.
- **Field nullability:** `EventCard` in task 7 declares `location`/`time`/`createdById` as nullable; if the Drizzle row types disagree, adjust the prop type to match schema rather than touching the schema.
