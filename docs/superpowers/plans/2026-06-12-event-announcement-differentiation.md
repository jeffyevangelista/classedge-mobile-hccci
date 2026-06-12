# Event vs Announcement Detail Differentiation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `EventDetailsScreen` and `AnnouncementDetailsScreen` visually and structurally distinct (date-hero vs author-led social) with a shared `<EntityTypePill />` so users can identify what they're looking at within the first glance.

**Architecture:** One new shared component (`EntityTypePill`) plus full presentational rewrites of the two detail screens. Data hooks, push-hydrate flow (`useEntityFromPushOrSync`), routes, and theme tokens are untouched. All new colors come from existing Royal Azure tokens (`accent` blue, `warning` amber) and their well-known tints.

**Tech Stack:** React Native (Expo SDK 54), heroui-native (Avatar/Surface/Skeleton/Separator), uniwind (Tailwind classes), Phosphor icons via `components/Icon.tsx`, dayjs for date formatting.

**Reference spec:** `docs/superpowers/specs/2026-06-12-event-announcement-differentiation-design.md`

**Repo-specific conventions to honor**
- No component test infrastructure exists. Verification is visual via Expo dev server + device/simulator, not unit tests.
- `accent` and `warning` are CSS tokens from `global.css` resolved through uniwind. In TSX, prefer Tailwind utility classes (`bg-accent`, `text-warning`) over hardcoded hex. The brainstorm mockups used hex for browser preview only — never copy hex into TSX.
- The user owns staging/committing. Each task ends with a "show diff, pause for user commit" step — do not run `git add` or `git commit` from this plan.
- The repo uses `bun` as the package manager (per existing scripts). Use `npx expo start` or `bun start` to launch the dev server.

---

## File Map

**Create:**
- `components/EntityTypePill.tsx` — single source of truth for the "Event" / "Announcement" type chip

**Modify:**
- `screens/main/calendar/EventDetailsScreen.tsx` — full presentational rewrite (date-hero composition)
- `screens/main/announcement/AnnouncementDetailsScreen.tsx` — full presentational rewrite (author-led social composition + `<LinkedEventCard />` inline component)

**Do not touch:**
- `app/(main)/_layout.tsx`, `app/(main)/event/[eventId]/index.tsx`, `app/(main)/announcement/[announcementId]/index.tsx` (routing)
- `features/notifications/useEntityFromPushOrSync.ts`, `pushPayloadCache.ts`, `HydrationDebugPill.tsx`
- `features/calendar/components/date-formatter.ts` (per spec: keep as-is; the date-hero composes from dayjs inline rather than introducing new shared helpers)
- `features/calendar/EventDetailModal.*` (out of scope — bottom sheet flow, not full-screen detail)
- `global.css` (no new tokens)

---

## Task 1: Create `<EntityTypePill />` shared component

**Files:**
- Create: `components/EntityTypePill.tsx`

**Why first:** Both screens depend on this. Building it standalone first means Tasks 2 and 3 can import a real, working component rather than scaffolding inline and refactoring out later.

- [ ] **Step 1: Create the component file**

Create `components/EntityTypePill.tsx` with the following content:

```tsx
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

type EntityType = "event" | "announcement";

type EntityTypePillProps = {
  type: EntityType;
};

type PillStyle = {
  iconName: IconName;
  label: string;
  containerClass: string;
  textClass: string;
  iconColorClass: string;
};

const STYLES: Record<EntityType, PillStyle> = {
  event: {
    iconName: "CalendarIcon",
    label: "Event",
    containerClass: "bg-accent/15",
    textClass: "text-accent",
    iconColorClass: "text-accent",
  },
  announcement: {
    iconName: "MegaphoneIcon",
    label: "Announcement",
    containerClass: "bg-warning/15",
    textClass: "text-warning",
    iconColorClass: "text-warning",
  },
};

export const EntityTypePill = ({ type }: EntityTypePillProps) => {
  const style = STYLES[type];
  return (
    <View
      className={`self-start flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${style.containerClass}`}
    >
      <Icon name={style.iconName} size={11} className={style.iconColorClass} />
      <AppText
        weight="semibold"
        className={`text-[10px] tracking-wider uppercase ${style.textClass}`}
      >
        {style.label}
      </AppText>
    </View>
  );
};

export default EntityTypePill;
```

Notes for the engineer:
- `bg-accent/15` / `bg-warning/15` are uniwind opacity utilities — they produce a 15%-opacity tint of the theme token, which matches the spec's "tint of accent / warning" without hardcoding hex. If your version of uniwind/tailwind rejects the `/15` syntax, fall back to `bg-accent/10` first; if that also fails, set `containerClass` to `bg-accent` and add `style={{ opacity: 0.15 }}` to the View as a last resort (and flag to the user — this would be a uniwind config gap worth fixing separately).
- `self-start` keeps the pill snug around its text instead of stretching full-width inside flex parents.
- `Icon` accepts a Tailwind color class via `className` (`text-accent`) because Phosphor RN icons respect the `color` prop and uniwind translates `text-*` classes to that prop. This is how the existing `EventCard` in `AnnouncementDetailsScreen.tsx` already uses `<Icon ... className="text-muted" />`.

- [ ] **Step 2: Sanity-check the import path**

Run from the project root:

```bash
node -e "require.resolve('./components/Icon.tsx')" 2>&1 || true
ls components/EntityTypePill.tsx
```

Expected: the `ls` line prints the file path. (The `node -e` line may fail under JSX — that's fine. The real check is the next step.)

- [ ] **Step 3: Type-check the new file**

Run:

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(EntityTypePill|error TS)" | head -40
```

Expected: zero errors mentioning `EntityTypePill`. If TS complains that `IconName` isn't an export of `@/components/Icon`, open `components/Icon.tsx` and confirm `export type IconName` is there (it is, per line 4 of that file).

- [ ] **Step 4: Visual smoke-test (optional but recommended)**

If the dev server isn't already running, start it:

```bash
bun start  # or: npx expo start
```

Temporarily mount the pill on any screen you're already viewing (e.g., add `<EntityTypePill type="event" />` and `<EntityTypePill type="announcement" />` to a tab screen). Reload and confirm:
- Event pill: blue text + icon on a very light blue background
- Announcement pill: amber text + icon on a very light amber background
- Both pills hug their content (no full-width stretch)
- Dark theme: tints remain readable

Remove the temporary mount before moving on.

- [ ] **Step 5: Pause for user commit**

Run:

```bash
git status
git diff components/EntityTypePill.tsx
```

Then **stop** and let the user stage and commit (e.g. `feat(components): add EntityTypePill for event/announcement type chip`). Do not run `git add` or `git commit` yourself.

---

## Task 2: Restructure `EventDetailsScreen.tsx` (date-hero composition)

**Files:**
- Modify: `screens/main/calendar/EventDetailsScreen.tsx` (full rewrite of the rendered JSX and the local `EventDetailsSkeleton`; delete the local `DetailRow` helper)

**Reference:** The current file as of the start of this plan is at the path above; read it before editing to confirm none of the data-hook plumbing has shifted since the spec was written.

- [ ] **Step 1: Read the current file to lock in the imports and data-hook plumbing you must preserve**

Run:

```bash
cat screens/main/calendar/EventDetailsScreen.tsx
```

Confirm the following remain in place after your edit:
- `useLocalSearchParams<{ eventId: string }>`, `Number(eventId)`, `Number.isFinite(numericId)` guard
- `useEvent(numericId)` watch, `localEvent` fallback to `watch.data?.[0] ?? null`
- `makeEntityKey("event", numericId)`
- `useEntityFromPushOrSync({ entityKey, localData, localIsLoading })` with `apiFetch` intentionally omitted (the comment explaining why must survive)
- The four fallback branches in order: invalid `numericId`, `!event && isResolving`, `!event && (watch.error ?? error)`, `!event && isMissing`, terminal `!event` null guard
- `HydrationDebugPill` invocation with the `[push-hydrate verify]` comment

If any of those have moved or been renamed, stop and ask the user before continuing — the spec assumes today's shape of the file.

- [ ] **Step 2: Replace the file with the new composition**

Overwrite `screens/main/calendar/EventDetailsScreen.tsx` with:

```tsx
import dayjs from "dayjs";
import { useLocalSearchParams } from "expo-router";
import { Skeleton } from "heroui-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { EntityTypePill } from "@/components/EntityTypePill";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import NoDataFallback from "@/components/NoDataFallback";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useEvent } from "@/features/calendar/calendar.hooks";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import HydrationDebugPill from "@/features/notifications/HydrationDebugPill";
import { makeEntityKey } from "@/features/notifications/pushPayloadCache";
import { useEntityFromPushOrSync } from "@/features/notifications/useEntityFromPushOrSync";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const EventDetailsScreen = () => {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const numericId = Number(eventId);

  const watch = useEvent(numericId);
  const localEvent = watch.data?.[0] ?? null;

  const eventEntityKey = makeEntityKey("event", numericId);
  const {
    data: event,
    source, // [push-hydrate verify]
    isResolving,
    isMissing,
    error,
    retry,
  } = useEntityFromPushOrSync({
    entityKey: eventEntityKey,
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

  if (!event) return null;

  const start = dayjs(event.startDate);
  const endsDifferentDay =
    event.endDate && !dayjs(event.endDate).isSame(start, "day");

  return (
    <ScreenScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-3xl mx-auto px-5 pt-2">
        {/* [push-hydrate verify] */}
        <View className="mb-2">
          <HydrationDebugPill
            entityKey={eventEntityKey}
            source={source}
            isResolving={isResolving}
            isMissing={isMissing}
          />
        </View>

        <View className="mb-3">
          <EntityTypePill type="event" />
        </View>

        {/* Date hero card */}
        <View className="flex-row items-center gap-3 bg-surface border border-accent/30 rounded-2xl px-4 py-3 mb-4">
          <View className="w-16 py-2 rounded-xl bg-accent items-center justify-center">
            <AppText
              weight="bold"
              className="text-[10px] tracking-widest uppercase text-accent-foreground opacity-90"
            >
              {start.format("MMM")}
            </AppText>
            <AppText
              weight="bold"
              className="text-[26px] leading-7 text-accent-foreground"
            >
              {start.format("D")}
            </AppText>
          </View>
          <View className="flex-1">
            <AppText weight="semibold" className="text-foreground">
              {start.format("dddd")}
            </AppText>
            {event.time ? (
              <AppText className="text-xs text-muted">
                {formatTime(event.time)}
              </AppText>
            ) : null}
            {endsDifferentDay ? (
              <AppText className="text-xs text-muted mt-0.5">
                to {formatDate(event.endDate)}
              </AppText>
            ) : null}
          </View>
        </View>

        {/* Title + description */}
        <AppText
          weight="bold"
          className="text-2xl text-foreground mb-1"
        >
          {event.title}
        </AppText>
        {event.description ? (
          <AppText className="text-muted leading-relaxed mb-4">
            {event.description}
          </AppText>
        ) : (
          <View className="mb-2" />
        )}

        {/* Location card — only when present */}
        {event.location ? (
          <View className="flex-row items-start gap-3 bg-surface border border-border rounded-xl px-4 py-3 mb-4">
            <View className="mt-0.5">
              <Icon name="MapPinIcon" size={18} className="text-accent" />
            </View>
            <View className="flex-1">
              <AppText
                weight="semibold"
                className="text-[11px] tracking-wider uppercase text-muted mb-0.5"
              >
                Location
              </AppText>
              <AppText className="text-foreground">{event.location}</AppText>
            </View>
          </View>
        ) : null}

        {/* Footer metadata */}
        <View className="mt-4 pt-3 border-t border-border gap-1">
          {event.createdById ? (
            <AppText className="text-xs text-muted">
              Created by{" "}
              <AppText weight="semibold" className="text-xs text-muted">
                {toTitleCase(
                  `${event.createdById.firstName} ${event.createdById.lastName}`,
                )}
              </AppText>
            </AppText>
          ) : null}
          <AppText className="text-xs text-muted">
            Posted{" "}
            {new Date(event.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </AppText>
        </View>
      </View>
    </ScreenScrollView>
  );
};

const EventDetailsSkeleton = () => (
  <View className="w-full max-w-3xl mx-auto px-5 pt-2">
    {/* pill */}
    <Skeleton className="h-5 w-20 rounded-full mb-3" />
    {/* date hero */}
    <View className="flex-row items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 mb-4">
      <Skeleton className="w-16 h-14 rounded-xl" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </View>
    </View>
    {/* title + description */}
    <View className="mb-4 gap-2">
      <Skeleton className="h-7 w-3/4 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
    </View>
    {/* location card */}
    <View className="flex-row items-start gap-3 bg-surface border border-border rounded-xl px-4 py-3 mb-4">
      <Skeleton className="w-5 h-5 rounded mt-0.5" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
      </View>
    </View>
    {/* footer */}
    <View className="mt-4 pt-3 border-t border-border gap-1">
      <Skeleton className="h-3 w-40 rounded" />
      <Skeleton className="h-3 w-52 rounded" />
    </View>
  </View>
);

export default EventDetailsScreen;
```

Notes:
- The old inline `DetailRow` helper is gone — it's locally defined and not exported, so deletion is safe.
- `useThemeColor("accent")` (the old `accentColor` constant) is gone — color is now applied via Tailwind classes (`text-accent`, `bg-accent`, `border-accent/30`), so the hook is no longer needed.
- The "Posted" line preserves the exact `toLocaleDateString("en-US", { year, month, day, hour, minute })` format from the current screen, per spec.
- The two unreachable-by-design comment blocks from the original (`// Unreachable per the hook's isResolving / isMissing invariant…` and `// Show the error fallback only when we have no data to render…`) are dropped only because the surrounding code is unchanged and the reasoning didn't shift. If you prefer to keep them, re-add them verbatim above the corresponding `if`s — they don't lie about the new layout.

- [ ] **Step 3: Type-check**

Run:

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(EventDetailsScreen|error TS)" | head -40
```

Expected: zero errors. If TS complains about `event.endDate` possibly being undefined when `endsDifferentDay` is truthy, add a `event.endDate &&` short-circuit inside the conditional (the spec assumes `endDate` is the same nullable shape as `startDate` from the existing watch query).

- [ ] **Step 4: Visual verification — happy path**

Start dev server (`bun start` if not already running), open the app on simulator or device, and navigate to an event in three ways:

1. From the Calendar tab → tap an event → confirm date-hero composition loads.
2. Send/trigger a push notification for an event → tap it → confirm same date-hero composition (this exercises the push-payload hydration path).
3. From an Announcement that has a linked event → tap the linked event card → confirm same date-hero composition.

For each path, verify:
- Blue Event pill at the top, just under the HydrationDebugPill (dev only).
- Date tile shows `MMM` over the day-of-month in white-on-blue.
- "Posted by … · Posted Mon DD, YYYY · HH:MM AM/PM" sits as small muted text at the bottom, separated by a thin top border.
- Location card appears only when `event.location` is non-empty (find or create an event without a location to confirm it disappears cleanly).

- [ ] **Step 5: Visual verification — loading and error states**

- Force the skeleton: open the screen on a fresh app launch with no PowerSync cache yet (clearing app storage in the simulator is the quickest way). The skeleton should resemble the loaded shape — tile placeholder → title bars → location card placeholder → footer placeholder.
- Force an error: temporarily edit the screen to `throw new Error("test")` inside the render body, or kill the network and clear PowerSync, to land in the `ErrorFallback` branch. Confirm it still renders with a tappable refetch.
- Force the "not found" branch by visiting `/event/999999999` (or any unused id) directly via deep link.

Undo any temporary edits before moving on.

- [ ] **Step 6: Pause for user commit**

Run:

```bash
git status
git diff screens/main/calendar/EventDetailsScreen.tsx
```

Stop and let the user commit (e.g. `feat(event-details): restructure to date-hero composition`).

---

## Task 3: Restructure `AnnouncementDetailsScreen.tsx` (author-led social + `<LinkedEventCard />`)

**Files:**
- Modify: `screens/main/announcement/AnnouncementDetailsScreen.tsx` (full rewrite of the rendered JSX, the local `AnnouncementDetailsSkeleton`, and the local `EventCard` → renamed `LinkedEventCard`)

- [ ] **Step 1: Read the current file to lock in plumbing you must preserve**

Run:

```bash
cat screens/main/announcement/AnnouncementDetailsScreen.tsx
```

Confirm these survive your edit:
- `useLocalSearchParams<{ announcementId: string }>` + `Number(...)` + `Number.isFinite` guard
- `useAnnouncement(numericId)` watch + `localAnnouncement` fallback
- `makeEntityKey("announcement", numericId)`
- `useEntityFromPushOrSync(...)` with `apiFetch` intentionally omitted (preserve the comment)
- All four fallback branches in the same order
- The defensive `validEvents = announcement.events.filter((eventLink) => eventLink?.event?.id != null)` filter and its explanatory comment — **do not remove this**, it guards against in-flight payloads from older server builds
- The `router.push(\`/event/\${eventLink.event.id}\`)` navigation target

- [ ] **Step 2: Replace the file with the new composition**

Overwrite `screens/main/announcement/AnnouncementDetailsScreen.tsx` with:

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar, Skeleton, Surface } from "heroui-native";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { EntityTypePill } from "@/components/EntityTypePill";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import NoDataFallback from "@/components/NoDataFallback";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useAnnouncement } from "@/features/announcements/announcements.hooks";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import HydrationDebugPill from "@/features/notifications/HydrationDebugPill";
import { makeEntityKey } from "@/features/notifications/pushPayloadCache";
import { useEntityFromPushOrSync } from "@/features/notifications/useEntityFromPushOrSync";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const AnnouncementDetailsScreen = () => {
  const { announcementId } = useLocalSearchParams<{ announcementId: string }>();
  const numericId = Number(announcementId);
  const router = useRouter();

  const watch = useAnnouncement(numericId);
  const localAnnouncement = watch.data?.[0] ?? null;

  const announcementEntityKey = makeEntityKey("announcement", numericId);
  const {
    data: announcement,
    source, // [push-hydrate verify]
    isResolving,
    isMissing,
    error,
    retry,
  } = useEntityFromPushOrSync({
    entityKey: announcementEntityKey,
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

  if (!announcement) return null;

  const authorName = toTitleCase(
    `${announcement.createdById.firstName} ${announcement.createdById.lastName}`,
  );
  const postedDate = formatDate(announcement.createdAt);
  const postedTime = new Date(announcement.createdAt).toLocaleTimeString(
    "en-US",
    { hour: "2-digit", minute: "2-digit" },
  );

  // Defensive filter: in-flight push payloads from older server builds
  // shipped `events: [number]` (flat IDs) instead of `[{ event: {...} }]`,
  // which crashed the map below. Filter out any entries missing the nested
  // event before rendering — they hydrate correctly once PowerSync catches up.
  const validEvents = announcement.events.filter(
    (eventLink) => eventLink?.event?.id != null,
  );

  return (
    <ScreenScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-3xl mx-auto px-5 pt-2 gap-4">
        {/* [push-hydrate verify] */}
        <HydrationDebugPill
          entityKey={announcementEntityKey}
          source={source}
          isResolving={isResolving}
          isMissing={isMissing}
        />

        <EntityTypePill type="announcement" />

        {/* Author card */}
        <View className="flex-row items-center gap-3 bg-surface border border-border rounded-2xl px-3.5 py-3">
          <Avatar alt={authorName} size="md" className="border border-border">
            <AttachmentAvatarImage
              path={announcement.createdById.studentPhoto}
            />
            <AvatarFallbackImage />
          </Avatar>
          <View className="flex-1">
            <AppText weight="semibold" className="text-foreground">
              {authorName}
            </AppText>
            <View className="flex-row items-center gap-1.5">
              <AppText className="text-xs text-muted">
                Posted {postedDate}
              </AppText>
              <View className="w-0.5 h-0.5 bg-muted rounded-full" />
              <AppText className="text-xs text-muted">{postedTime}</AppText>
            </View>
          </View>
        </View>

        <AppText weight="bold" className="text-2xl text-foreground">
          {announcement.title}
        </AppText>

        <AppText className="text-sm leading-relaxed text-foreground">
          {announcement.description}
        </AppText>

        {validEvents.length > 0 ? (
          <View className="mt-1 gap-2">
            <View className="flex-row items-center gap-1.5">
              <Icon name="CalendarIcon" size={13} className="text-muted" />
              <AppText
                weight="semibold"
                className="text-[11px] tracking-wider uppercase text-muted"
              >
                Linked Events
              </AppText>
            </View>
            {validEvents.map((eventLink) => (
              <LinkedEventCard
                key={eventLink.event.id}
                event={eventLink.event}
                onPress={() => router.push(`/event/${eventLink.event.id}`)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </ScreenScrollView>
  );
};

type LinkedEventCardProps = {
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

const LinkedEventCard = ({ event, onPress }: LinkedEventCardProps) => (
  <Pressable onPress={onPress} className="active:opacity-80">
    <View className="flex-row rounded-xl overflow-hidden border border-border">
      {/* Blue left-stripe — chromatic preview of the Event screen */}
      <View className="w-1 bg-accent" />
      <Surface variant="secondary" className="flex-1 p-3 gap-2 rounded-none">
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
    </View>
  </Pressable>
);

const AnnouncementDetailsSkeleton = () => (
  <View className="w-full max-w-3xl mx-auto px-5 pt-2 gap-4">
    {/* pill */}
    <Skeleton className="h-5 w-28 rounded-full" />
    {/* author card */}
    <View className="flex-row items-center gap-3 bg-surface border border-border rounded-2xl px-3.5 py-3">
      <Skeleton className="w-11 h-11 rounded-full" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-40 rounded" />
      </View>
    </View>
    {/* title + body */}
    <Skeleton className="h-7 w-3/4 rounded" />
    <Skeleton className="h-4 w-full rounded" />
    <Skeleton className="h-4 w-full rounded" />
    <Skeleton className="h-4 w-2/3 rounded" />
    {/* linked-events teaser */}
    <Skeleton className="h-20 w-full rounded-xl mt-2" />
  </View>
);

export default AnnouncementDetailsScreen;
```

Notes:
- The `<Separator />` from the original is dropped (per spec).
- The `Avatar` `size` jumps from `"sm"` to `"md"`. The skeleton uses `w-11 h-11` (44px) as a visual placeholder — adjust to `w-10 h-10` if `md` looks smaller than 44px on your simulator; the goal is "matches the loaded shape," not a hardcoded pixel.
- `LinkedEventCard` reshapes the original `EventCard`: the blue left-stripe is implemented as a 1-unit-wide `bg-accent` column rendered as a sibling of the `Surface` inside a clipped flex-row container. This avoids touching `Surface`'s internal radius and is robust across heroui-native theme tweaks. `rounded-none` on the inner `Surface` prevents a double-rounded inner corner.
- The author's posted time was previously displayed as `formatDate(announcement.createdAt)` only. The author card now also surfaces a time (small dot + `HH:MM AM/PM`) so the moment of posting is fully visible without a separate "Posted" metadata block.
- The defensive `validEvents` filter and its comment block are preserved verbatim.

- [ ] **Step 3: Type-check**

Run:

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(AnnouncementDetailsScreen|error TS)" | head -40
```

Expected: zero errors. If TS objects to `Surface`'s `rounded-none` prop interaction or to the `className` on `View` wrappers, fall back to inline `style={{ ... }}` only for the offending prop and flag to the user.

- [ ] **Step 4: Visual verification — happy path**

Open an announcement in both entry paths:

1. From the Announcement tab → tap an announcement → confirm the author card + amber pill compose at the top, no horizontal separator above the title.
2. Send/trigger a push notification for an announcement → tap it → confirm same composition (push-payload hydration path).

For each path verify:
- Amber Announcement pill sits above the author card.
- 44-ish-pixel circular avatar with the author's photo (or fallback if missing), name semibold, date + dot + time on the second line.
- No horizontal `<Separator />` between author card and title.
- "Linked Events" section appears only when `validEvents.length > 0`; section header has a small calendar icon.
- Each linked-event card has a thin blue left-stripe and is tappable; tapping navigates to `/event/[id]` and the destination renders the new date-hero Event screen.

- [ ] **Step 5: Visual verification — empty linked events**

Find or create an announcement that has zero events linked (the seed data may include one). Confirm:
- "Linked Events" section is not rendered at all (no orphan header).
- Layout shrinks cleanly to: pill → author card → title → body.

If you can't find one with zero events, also create an announcement with a *malformed* event link (a record where `eventLink.event` is missing or `eventLink.event.id` is null) and confirm the defensive `validEvents` filter still hides it — i.e., the section header disappears when *all* events are filtered out.

- [ ] **Step 6: Visual verification — loading and error states**

- Skeleton: clear app storage, reopen the announcement, confirm the skeleton shape (pill bar → 44px circle + two lines → title/body bars → linked-events card bar).
- Error: kill network + clear PowerSync; confirm `ErrorFallback` branch renders with refetch.
- "Not found": visit `/announcement/999999999`; confirm `NoDataFallback` with megaphone icon.

- [ ] **Step 7: Dark mode pass**

Toggle the device to dark mode and re-verify the happy paths for Event and Announcement screens. Confirm:
- Pill backgrounds (`bg-accent/15`, `bg-warning/15`) are still readable on the dark `--background`.
- Date tile (`bg-accent`) text remains legible (`text-accent-foreground` resolves to white in both themes).
- Border colors (`border-accent/30`, `border-border`) don't disappear into the background.

If any tint reads as invisible or washed-out in dark mode, escalate to the user before fudging the opacity — this likely indicates the `accent`/`warning` dark variants need a one-time tune in `global.css`, which is outside the scope of this plan.

- [ ] **Step 8: Pause for user commit**

Run:

```bash
git status
git diff screens/main/announcement/AnnouncementDetailsScreen.tsx
```

Stop and let the user commit (e.g. `feat(announcement-details): restructure to author-led social composition`).

---

## Task 4: Cross-screen verification & report

**Files:** none (verification only)

- [ ] **Step 1: Side-by-side comparison**

With both screens implemented, navigate back and forth a few times:
- Open an Event, back out, open an Announcement, back out, repeat.
- The compositions should feel *obviously* different from the moment they paint — distinct anchor shape (date tile vs avatar), distinct color (blue vs amber pill).

- [ ] **Step 2: Push notification differentiation**

Trigger one of each (event and announcement) push notification in quick succession and confirm that when each lands on its detail screen, the composition unambiguously matches the entity type.

- [ ] **Step 3: Regression sweep**

Browse the rest of the app for ~5 minutes — Calendar tab, Announcement tab, dashboard, classroom screens — and confirm no styling has bled (the change is scoped to two files and one new component, so this should be a no-op, but the new pill colors share the `accent`/`warning` tokens that exist app-wide).

- [ ] **Step 4: Report back to user**

Summarize for the user:
- Which entry paths you verified (push, in-app navigation, deep link).
- Light + dark theme status.
- Any tints, paddings, or sizes you tweaked vs the spec (and why).
- Whether the "Posted time" addition on the Announcement author card feels right or feels like new info the user didn't sign off on (per spec it was unspecified; the author card now shows date · time — flag if you'd rather drop the time).

---

## Self-review (executed during plan authoring)

**Spec coverage check:**
- Type pill (locked decision A) → Task 1 (`EntityTypePill`) ✓
- Event date-hero composition → Task 2 ✓
- Announcement author-led + linked-event left-stripe → Task 3 ✓
- Preserved color tokens / no new tokens → Tasks 1–3 all use Tailwind classes against `accent`/`warning`, no hardcoded hex ✓
- Skeletons updated to match new shapes → covered in Task 2 step 2 and Task 3 step 2 ✓
- All fallback branches preserved (`!Number.isFinite`, `isResolving`, error, `isMissing`, terminal `!event`) → explicit "lock in plumbing" steps in both tasks ✓
- Defensive `validEvents` filter preserved verbatim → Task 3 step 1 calls it out, step 2 preserves it ✓
- `HydrationDebugPill` and `[push-hydrate verify]` comments preserved → both screens retain them ✓
- "Posted" timestamp format preserved verbatim on Event → Task 2 step 2 keeps the existing `toLocaleDateString` call ✓
- Dark-mode sanity check → Task 3 step 7 ✓
- "Not test-driven because there's no test infra" → flagged in the header repo-conventions block ✓
- "User owns commits" → all commit pause points are show-diff-and-stop, never `git add` / `git commit` ✓

**Placeholder scan:** No TBD/TODO/handwave instructions. Every code step contains the exact code to write. Fallback advice ("if uniwind rejects `/15`…") is concrete enough to act on.

**Type consistency:** `EntityTypePill` props match between Task 1 (definition) and Tasks 2/3 (usage) — `type: "event" | "announcement"`. The `LinkedEventCard` props match the existing `EventCard` shape it replaces. No name drift detected.
