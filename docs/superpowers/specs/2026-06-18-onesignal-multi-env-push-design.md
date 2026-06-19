# OneSignal multi-environment push configuration — design

**Date:** 2026-06-18
**Status:** Approved (Option 1)

> **Correction (2026-06-19, during implementation):** The OneSignal app ID
> referenced throughout this document as the existing production app —
> `89c53280-0393-43c1-8416-6ae2f4771bdd` — turned out to be an
> experimental app from earlier development, not a live production
> deployment with real users. Two fresh OneSignal apps were created
> during Task 3:
> - `HCCCI Production`: `1a171772-2345-4bd3-b2d0-b87ef2b5e55d`
> - `HCCCI Sandbox` (Dev): `5cb2e0a6-e756-41d0-a84a-d4149c00cc8a`
>
> All architectural decisions in this design still hold; only the
> concrete UUIDs differ. The experimental `89c53280-…` app should be
> deleted in the OneSignal dashboard to revoke the REST API key
> previously leaked via `classedge-mobile-test/.env.example:73`.

## Problem

The mobile client and Django backend currently share a single OneSignal app
across all environments. With chat (DMs + classroom channels, scope decided
2026-06-14) about to depend heavily on push delivery, we need clean
separation between `development`, `preview`, and `production` so that:

- Dev pushes (broadcasts, segment tests) cannot reach real users.
- Preview/QA test sends cannot leak into the prod user base.
- A leaked REST API key in one environment can be rotated without touching
  the others.
- OneSignal dashboards, analytics, and segments stay per-environment.

A common misconception was blocking the design: that Apple's APNs Auth Key
(`.p8`) is environment-bound and that the "2 keys per developer account"
cap forces compromise. It does not — see the constraints below.

## Constraints

### Apple APNs

- A single `.p8` APNs Auth Key works for **both** sandbox and production
  APNs servers. The "environment" is selected by the caller (OneSignal),
  not by the key.
- The `aps-environment` iOS entitlement determines which APNs server issues
  device tokens for that build:
  - `development` → sandbox tokens (only valid against the sandbox APNs
    endpoint; only granted by builds signed with a development provisioning
    profile)
  - `production` → production tokens (granted by App Store / TestFlight /
    ad-hoc distribution-signed builds; only valid against the production
    APNs endpoint)
- Apple's "2 active keys per account" is just an account cap; we only need
  **one** key in total.

### OneSignal

- A OneSignal iOS app is configured with the team's APNs Auth Key
  (`.p8`), team ID, and key ID — **not** bound to a single bundle
  identifier at the registration level. Devices from multiple bundle IDs
  in the same Apple team can register against one OneSignal app
  (confirmed by the current setup: all three mobile variants register
  fine against the single existing app `89c53280…`).
- A OneSignal app's APNs configuration carries **one** Sandbox/Production
  toggle. The toggle determines which APNs endpoint OneSignal uses for
  all sends from that app. Therefore one OneSignal app can serve only one
  APNs environment at a time.
- Each OneSignal app has its own `app_id`, REST API key, and Android
  notification channel ID, stored independently.
- The same `.p8` file may be uploaded to multiple OneSignal apps with
  different Sandbox/Production toggle values.

### Backend deployment reality

There are **two real backend environments**, not three:

- **Local Django** — each developer runs `python manage.py runserver` and
  exposes it via `cloudflared`; the mobile `development` build points at
  that tunnel via `EXPO_PUBLIC_API_BASE_URL`.
- **Production Django** — deployed at `classedge.hccci.edu.ph` (the only
  hostname referenced in `lms/settings.py:73`). No formal staging /
  preview backend exists.

The mobile `preview` build (TestFlight / ad-hoc) therefore points at the
**production** Django backend; there is no other place for it to go.

## Decisions

The split is **per APNs environment + per audience boundary** (which
follows from the backend-deployment reality), not per iOS bundle ID.
This yields two OneSignal apps, not three.

1. **Two OneSignal apps:**
   - `HCCCI Sandbox` (new) — APNs Sandbox mode. Paired with the
     `development` mobile variant only. Used by developers' local Django
     instances.
   - `HCCCI Production` (existing app ID
     `89c53280-0393-43c1-8416-6ae2f4771bdd`) — APNs Production mode.
     Paired with **both** the `preview` and `production` mobile variants.
     Used by the prod Django deployment.
2. **Use a single `.p8` APNs Auth Key**, uploaded to both OneSignal apps:
   - `HCCCI Sandbox` → upload with **Sandbox** toggle
   - `HCCCI Production` → upload with **Production** toggle
3. **Fix the preview `aps-environment` entitlement**: change
   `app.config.ts:25` from `apsEnvironment: "development"` to
   `apsEnvironment: "production"`. Preview builds are distribution-signed
   (TestFlight / ad-hoc), so they receive production APNs tokens; the
   current sandbox entitlement causes pushes to silently no-op.
4. **Wire per-profile OneSignal App IDs through EAS**, replacing the
   single `EXPO_PUBLIC_ONESIGNAL_APP_ID` that all variants currently share
   (`app.config.ts:139`). Two acceptable mechanisms (pick one in the plan):
   - Set `EXPO_PUBLIC_ONESIGNAL_APP_ID` per build profile in `eas.json`.
   - Configure the same variable as an EAS Dashboard environment variable,
     scoped to each build profile (keeps App IDs out of git entirely).

   `development` gets the `HCCCI Sandbox` app ID; `preview` and
   `production` both get the `HCCCI Production` app ID.
5. **Server-side: env-driven config, no code changes** (Option 1 from the
   discussion). Each Django deployment's `.env` holds exactly one
   OneSignal app's credentials:
   - Each developer's local `.env` → `HCCCI Sandbox` credentials
   - Production deployment's `.env` → `HCCCI Production` credentials
   - `_send_onesignal_notification()` already accepts injectable
     `app_id` / `rest_api_key` arguments (`logs/views.py:46-48`); existing
     default-to-settings behavior continues to work, no code changes
     required.
   - Mobile `preview` builds hit prod Django and register with
     `HCCCI Production`, so server-sent pushes (e.g., chat messages)
     reach preview devices via the same OneSignal credentials as
     production devices. Acceptable trade-off: preview QA test pushes
     mingle with production analytics in the `HCCCI Production`
     dashboard; mitigated by targeting QA sends by `external_id` only,
     never by segment or `Subscribed Users`.

## Architecture summary

| Mobile variant | iOS bundle ID | `aps-environment` | OneSignal app | OneSignal APNs mode | Talks to backend |
|---|---|---|---|---|---|
| `development` | `com.classifyinc.hccci.classedge.dev` | `development` | `HCCCI Sandbox` (new) | Sandbox | Local Django (cloudflared) |
| `preview` | `com.classifyinc.hccci.classedge.preview` | `production` *(fix)* | `HCCCI Production` (existing) | Production | Prod Django |
| `production` | `com.classifyinc.hccci.classedge` | `production` | `HCCCI Production` (existing) | Production | Prod Django |

Both OneSignal apps share one Apple `.p8` APNs Auth Key, uploaded twice
with different Sandbox/Production toggle values.

## Implementation outline

These are the categories the implementation plan will cover; exact
sequencing belongs in the plan, not the spec.

### OneSignal dashboard work (manual, one-time)

- Create one new OneSignal app: `HCCCI Sandbox`. (The existing
  `89c53280…` app becomes `HCCCI Production`; rename for clarity but
  keep the app ID — production users are already registered against it.)
- For `HCCCI Sandbox`: configure iOS with the team's `.p8` Auth Key,
  key ID, and team ID; set the APNs toggle to **Sandbox**. Configure
  Android (FCM Service Account JSON for the dev package name
  `com.classifyinc.hccci.classedge.dev`); create an Android notification
  channel and capture its UUID.
- For `HCCCI Production`: verify the existing APNs configuration uses
  the `.p8` Auth Key (re-upload if it still uses the legacy `.p12`
  certificate) with toggle set to **Production**. Confirm the Android
  FCM config covers both `com.classifyinc.hccci.classedge.preview` and
  `com.classifyinc.hccci.classedge`.
- Record both sets of credentials:
  - OneSignal App ID
  - REST API key
  - Android notification channel ID

### Mobile client changes (`client-mobile/`)

- `app.config.ts:25` — change preview `apsEnvironment` to `"production"`.
- `eas.json` — add `EXPO_PUBLIC_ONESIGNAL_APP_ID` (and any required
  OneSignal-related env vars) per build profile, **or** configure those
  values as EAS Dashboard environment variables scoped per profile.
- Confirm OneSignal initialization in the app reads
  `Constants.expoConfig.extra.onesignalAppId` (already wired via
  `app.config.ts:139`) and not a hard-coded value somewhere else.

### Backend changes (`classedge-mobile-test/`)

- No application code changes.
- Each Django deployment's `.env` holds one set of OneSignal credentials
  matching the OneSignal app paired with the mobile variant(s) that talk
  to that deployment:
  - Local dev `.env` → `HCCCI Sandbox` credentials
  - Production `.env` → `HCCCI Production` credentials
- `.env.example` — replace the currently-committed real values
  (`.env.example:72-74`) with placeholder strings.

## Related cleanup (out of scope but urgent)

These items are not part of this design but were discovered while
designing it. They should be tracked as follow-ups, not absorbed into the
implementation plan for this work.

- **Rotate leaked OneSignal credentials.** The real
  `ONE_SIGNAL_APP_ID`, `ONE_SIGN_API_KEY` (a OneSignal REST API key), and
  `ORGANIZATION_API_KEY` are committed in
  `classedge-mobile-test/.env.example:72-74`. The REST API key allows
  arbitrary broadcasts to the current user base; rotate in OneSignal and
  scrub the committed file.
- **Backend per-env split.** Long-term, `lms/settings.py` should be split
  into per-env settings modules or a `DJANGO_SETTINGS_MODULE`-driven flow
  (`DEBUG = True` hardcoded at line 71; `ALLOWED_HOSTS = ['*']` at line
  75). Not required for this design; flagged for later.

## Out of scope

- Building a real staging/preview backend deployment. If one is added
  later, the cleanest follow-up is to introduce a third OneSignal app
  (`HCCCI Preview`) and give the new backend deployment its own `.env`
  pointing at it; preview mobile builds would then register with the new
  app, isolating preview analytics from production.
- Server-side device-aware OneSignal routing (Option 2 from the
  discussion). Only relevant if multiple OneSignal apps need to be
  reachable from the same backend deployment.
- Changes to the push payload contract or notification service extension
  bundling; both already work per-variant via the existing
  `OneSignalNotificationServiceExtension` config
  (`app.config.ts:144-156`).

## Open questions

None blocking. Two confirmations the implementation plan will surface:

1. Whether per-profile OneSignal App IDs should live in `eas.json` env
   blocks or in the EAS Dashboard (preference: Dashboard, to keep IDs out
   of git).
2. Whether the OneSignal Organization API key (currently a single value
   in `lms/settings.py:469`) needs to be split, or whether one org-level
   key continues to cover both OneSignal apps (OneSignal's model: the
   org key is org-scoped, not app-scoped, so a single value remains
   correct — confirm in the dashboard during implementation).
