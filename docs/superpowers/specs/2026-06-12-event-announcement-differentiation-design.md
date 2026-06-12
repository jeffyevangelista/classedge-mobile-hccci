# Event vs Announcement Detail Differentiation — Design

**Date:** 2026-06-12
**Status:** Draft — pending user review

## Goal

Make `EventDetailsScreen` and `AnnouncementDetailsScreen` visually and structurally distinct so the user can identify which entity they're looking at within the first glance of the screen — independent of the back-stack title, the push notification source, or the entry path.

## Problem

Both detail screens currently share the same composition:

- `HydrationDebugPill` at the top
- Large title
- Description / body
- A stack of equal-weight detail rows or a small author row

The two screens read as variations of the same generic "thing with metadata." There is no chromatic, structural, or anchor-shape signal that says "this is an event" versus "this is an announcement." When the user lands on either via a push notification, the only distinguishing content is the body text.

## Non-Goals

- Backend changes. No new fields on `event` or `announcement` (no `priority`, `category`, `audience`, or `authorRole` — those wait for the deferred announcement card redesign).
- New color tokens. Only existing Royal Azure tokens from `global.css` are used.
- Touching the `EventDetailModal` bottom sheet used inside `AnnouncementList`. This spec covers full-screen detail routes only.
- Push-hydrate flow changes (`useEntityFromPushOrSync`, `HydrationDebugPill`, payload caching). The spec only changes presentation downstream of the hydration result.
- Adding tappable directions on the location card. The card is reshaped to *accommodate* that future move but no map / deep-link is wired up.

## Decisions Locked In Brainstorming

1. **Type identity treatment:** small colored pill above the title — not a full hero banner, not a left-edge stripe.
2. **Event layout:** date-hero — a calendar-style date tile is the visual anchor.
3. **Announcement layout:** author-led social — an upsized avatar (`size="md"`) in a soft card is the visual anchor; horizontal separator removed.
4. **Color identity:**
   - Event → `accent` `#2563eb` (existing — calendar-blue)
   - Announcement → `warning` `#b45309` (existing — warm, megaphone-coded)

## Color Tokens

| Use | Token | Value (light) |
|---|---|---|
| Event pill text + date tile bg + location icon + linked-event left-stripe | `accent` | `#2563eb` |
| Event pill background | (tint of accent) | `#dbeafe` |
| Announcement pill text | `warning` | `#b45309` |
| Announcement pill background | (tint of warning) | `#fef3c7` |

No new tokens added to `global.css`. Light/dark variants resolve through existing CSS variables. Dark-mode tints (`#dbeafe` / `#fef3c7`) need a one-time check against the dark theme — if contrast is insufficient, use the dark variants of `accent`/`warning` for the pill background instead of a hardcoded tint.

The avatar itself is not recolored; the existing `AttachmentAvatarImage` + `AvatarFallbackImage` rendering is preserved. The Announcement screen's amber identity comes from the pill alone, which is sufficient because the *structural* anchor (avatar card vs date tile) carries most of the differentiation.

## Shared Component — `<EntityTypePill />`

New component at `components/EntityTypePill.tsx`. Single source of truth for the type pill so future detail screens (e.g., lesson, assessment) can adopt the same pattern.

```tsx
type EntityTypePillProps = {
  type: "event" | "announcement";
};
```

Renders:
- Inline-flex container, rounded-full, small horizontal padding
- Leading icon (`CalendarIcon` for event, `MegaphoneIcon` for announcement) at ~11px
- Uppercase label ("Event" / "Announcement"), letter-spaced

The component encapsulates the color mapping so callers never reach for the tokens directly.

## `EventDetailsScreen` Restructure

File: `screens/main/calendar/EventDetailsScreen.tsx`

New top-down order, replacing the current title → description → 4× DetailRow stack:

1. `HydrationDebugPill` (unchanged — kept under the `[push-hydrate verify]` block)
2. `<EntityTypePill type="event" />`
3. **Date hero card** (new)
   - White surface, `accent`-tinted border
   - Left: 64px square tile in `accent` blue with the month (3-letter, uppercase) above the day-of-month (bold, ~26px)
   - Right: day-of-week (e.g. "Friday") + formatted time
   - If `event.endDate` differs from `event.startDate`, the tile shows the start date and the right column adds a second line "to {endDate}"
4. Title (existing typography retained)
5. Description (existing typography retained, shown only when present)
6. **Location card** (new — replaces the `DetailRow` for location)
   - Standalone white surface, accent-colored map-pin icon, "LOCATION" small label, value below
   - Rendered only when `event.location` is non-empty
7. **Footer metadata block** (replaces the "Created by" and "Posted" DetailRows)
   - Thin top border separator
   - Two stacked muted lines: `Created by {Name}` and `Posted {date · time}`
   - The "Posted" line preserves the existing `toLocaleDateString("en-US", { year, month, day, hour, minute })` format from the current screen verbatim — no new format introduced
   - Created-by line is rendered only when `event.createdById` is present

The existing `DetailRow` helper inside `EventDetailsScreen.tsx` is no longer used by this screen and is deleted (it's locally defined, not exported).

Loading skeleton (`EventDetailsSkeleton`) is updated to match the new shape: pill placeholder, date-hero skeleton (square tile + 2 lines), title + 2 description lines, location card skeleton, footer skeleton.

All existing fallback branches (`!Number.isFinite`, `isResolving`, `(watch.error ?? error)`, `isMissing`, terminal `!event` guard) are preserved unchanged.

## `AnnouncementDetailsScreen` Restructure

File: `screens/main/announcement/AnnouncementDetailsScreen.tsx`

New top-down order, replacing the current author-row → separator → title → body → events stack:

1. `HydrationDebugPill` (unchanged)
2. `<EntityTypePill type="announcement" />`
3. **Author card** (replaces the existing flex-row + small avatar)
   - White surface, soft border, padding ~12px
   - Avatar bumped from `size="sm"` to `size="md"`, retains `AttachmentAvatarImage` + `AvatarFallbackImage` (no recolor)
   - Right column: author name (semibold, 14px), and a second line combining "Posted {date}" + a small dot separator + formatted time. Uses the same `formatDate` helper the screen already imports — no new date format introduced.
4. Title (existing typography retained)
5. Body / description (existing typography retained)
6. **Linked events section** (replaces the current "Associated Events" section)
   - Section header: small calendar icon + uppercase "LINKED EVENTS" label (muted weight)
   - Rendered only when `validEvents.length > 0` (defensive filter on `eventLink?.event?.id` is preserved verbatim)
   - Each event uses the new `<LinkedEventCard />` (see below)

The existing inline `EventCard` component inside `AnnouncementDetailsScreen.tsx` is replaced by `<LinkedEventCard />` defined in the same file.

The horizontal `<Separator />` between author row and title is removed.

Loading skeleton (`AnnouncementDetailsSkeleton`) is updated: pill placeholder, author-card skeleton (upsized circle + 2 lines, matching the new `md` avatar footprint), title + 3 body lines, optional linked-events skeleton.

## `<LinkedEventCard />` (replaces the inline `EventCard`)

Defined in `AnnouncementDetailsScreen.tsx`. Same props as today's inline `EventCard`. Key visual change: a 3px-wide left-edge stripe in `accent` blue, signaling chromatically that tapping the card lands on a blue Event screen. The card surface stays neutral (white/border); only the stripe carries the wayfinding color.

This is the only place where the Event color identity bleeds into the Announcement screen — it's intentional, used as a navigation preview.

## Sample Visual

A composite mockup of both screens together lives at `.superpowers/brainstorm/19188-1781269118/content/composite.html` (gitignored). The four differentiation signals it demonstrates:

1. **Color** — blue date tile vs amber pill (the composite mockup adds a decorative amber gradient to the avatar for illustration; the shipped avatar is unrecolored)
2. **Anchor shape** — numeric calendar tile vs human avatar
3. **Information flow** — what/when/where (structured) vs who-said-what (conversational)
4. **Wayfinding** — blue-stripe linked-event cards on the announcement as a chromatic preview of where the tap goes

## Out-of-Scope / Deferred

- A future `EntityTypePill` extension for `lesson` and `assessment` is plausible but not designed here.
- Tappable location card → directions (Apple/Google Maps deep-link) is intentionally not part of this spec.
- Role / category / priority badges on announcements remain blocked on backend (see `project_announcement_card_redesign_todo.md`).
- The shared `formatDate` / `formatTime` utilities are kept as-is; the date-hero composition is built from their existing outputs.

## Verification

- Side-by-side comparison on device with both light and dark themes.
- Open Event via push notification, navigate from Calendar list, navigate from a linked-event card on an Announcement — all three entry points should render the same date-hero composition.
- Open Announcement via push notification and from the Announcement list — both should render the same author-led composition.
- Skeleton states should resemble the loaded composition closely enough that the transition isn't visually jarring.
