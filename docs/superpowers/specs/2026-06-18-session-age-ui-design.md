# Session-age UI surfacing — design

**Date:** 2026-06-18
**Status:** Proposed (depends on #1 refresh-token expiry persistence)
**Priority:** Low (polish; lives downstream of #1)

## Problem

Users have no awareness of when their session was last verified against
the backend. After a long offline stretch (a multi-week field trip, a
boarding-school break with poor connectivity), it would be useful for
the user to know "your session was last verified 12 days ago" so they
can choose to reconnect proactively rather than be surprised by a
forced logout (#1's failure mode).

This is the long-term UX layer on top of #1's data — once we persist the
refresh-token expiry, we naturally also know "when was the last
successful refresh" and "how long has this access token been
unrenewable?" Surfacing these turns the auth state from an invisible
internal counter into a self-service reassurance signal.

## Constraints

- **No new persistence work beyond #1.** This design assumes
  `lastRefreshAt` and `refreshExpiresAt` are persisted in MMKV by #1's
  implementation; reading them is free.
- **No new modals or interruptions.** Information only — do not page the
  user.
- **Visible without being noisy.** Most users will never look; those who
  do should find the data when they pull up the profile or settings.
- **Localized strings using existing patterns.** No new i18n
  infrastructure.

## Decisions

1. **One row in `ProfileScreen` (or Settings)**: "Last synced with
   server: 2 hours ago" / "12 days ago" / "Just now". Uses relative-time
   formatting consistent with the existing NetworkBanner pattern.
2. **A second sub-line** when offline session is finite: "Offline
   session expires in 18 days." Hidden when refresh just rotated.
3. **Tappable for detail.** Tapping the row opens a small modal sheet
   that explains the session model in plain language: "Your session
   refreshes automatically when you're connected. You can use the app
   offline for up to 30 days after your last successful refresh."
4. **Account section in Settings groups it** with "Sign out of all
   devices" (already a planned future feature) and the biometric toggle
   (#2). Keep the auth controls collocated.
5. **No telemetry** beyond the existing #1 events. This is read-only UI.

## Architecture summary

| File | Responsibility |
|---|---|
| `features/auth/sessionAge.ts` (new) | Selector hook: returns `{ lastRefreshAt, refreshExpiresAt, relativeLastSyncedLabel }` |
| `features/auth/components/SessionAgeRow.tsx` (new) | Tappable row UI |
| `features/auth/components/SessionAgeSheet.tsx` (new) | Explanatory bottom sheet |
| `screens/profile/ProfileScreen.tsx` (existing) | Mount `SessionAgeRow` in the existing list |

## Out of scope

- "Sign out of all devices" — a separate feature.
- A history of refresh events — overkill; only the most recent matters.
- Showing the session age on tab screens. The banner from #1 already
  handles the urgency path; this is for users who go looking.

## Open questions

- Should we show session age to users whose refresh is healthy (e.g.,
  "last synced 30 seconds ago")? The "always-fresh" case adds noise.
  Initial answer: always show; the relative-time format keeps it
  tasteful.
