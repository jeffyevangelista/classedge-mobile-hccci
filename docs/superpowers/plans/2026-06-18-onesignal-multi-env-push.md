# OneSignal multi-environment push configuration — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split push delivery into a sandbox path for local dev and a production path shared by preview and prod, using two OneSignal apps and a single Apple `.p8` Auth Key, with no Django code changes.

**Architecture:** Two OneSignal apps (`HCCCI Sandbox` for the `development` mobile variant only; `HCCCI Production` for both `preview` and `production`). One `.p8` uploaded twice with different Sandbox/Production toggles. Mobile selects its OneSignal App ID per EAS build profile. Each Django deployment's `.env` holds exactly one OneSignal app's credentials, picked to match the OneSignal app the mobile variants reaching that deployment register with.

**Tech Stack:** Expo Application Services (EAS), `onesignal-expo-plugin`, OneSignal REST API, Django + `python-decouple`, OneSignal dashboard, Apple APNs Auth Key (`.p8`), Firebase Cloud Messaging.

## Global Constraints

- **No Django code changes.** `_send_onesignal_notification()` already accepts injectable `app_id` / `rest_api_key` (`classedge-mobile-test/logs/views.py:46-48`); all environment switching is config-only.
- **Single Apple `.p8` APNs Auth Key** is reused across both OneSignal apps. Do not create a second `.p8`.
- **`development` mobile variant → `HCCCI Sandbox`** (sandbox APNs). **`preview` and `production` mobile variants → `HCCCI Production`** (production APNs). Never cross-wire.
- **Do not auto-stage or commit.** Per project preference, leave `git add` and `git commit` for the human reviewer. Suggested commit messages are provided as guidance.
- **OneSignal App IDs may live in git** (they are public-facing identifiers). **OneSignal REST API keys, Organization API keys, and `.p8` files must NEVER be committed.**
- **Spec reference:** `docs/superpowers/specs/2026-06-18-onesignal-multi-env-push-design.md`.

---

### Task 1: Rotate the leaked OneSignal credentials (security)

The current `classedge-mobile-test/.env.example:72-77` commits the real OneSignal REST API key and Organization API key. Anyone with a clone can broadcast to live users. Rotate first so the new credentials below are clean from day one.

**Files:**
- Modify: `classedge-mobile-test/.env` (local + production deployments)

**Interfaces:**
- Produces: rotated `ONE_SIGN_API_KEY` and `ORGANIZATION_API_KEY` values used by Task 7.

- [ ] **Step 1: Rotate the REST API key for the existing OneSignal app**

In the OneSignal dashboard:
1. Open the app whose ID is `89c53280-0393-43c1-8416-6ae2f4771bdd` (the only one in use today). Optionally rename it to `HCCCI Production` for clarity.
2. Navigate to **Settings → Keys & IDs**.
3. Under **REST API Key**, click **Regenerate** (or "Create new" / "Revoke and create").
4. Copy the new key to a secure scratch location; you will paste it into `.env` files in Task 7.

- [ ] **Step 2: Rotate the Organization API key**

Still in OneSignal:
1. Navigate to **Organization → Keys & IDs** (top-level, not per-app).
2. Regenerate the Organization API key.
3. Copy the new value to the same scratch location.

- [ ] **Step 3: Note that prod pushes will break until Task 7 deploys**

Expected: until Task 7 updates the production Django `.env` with the new REST API key and restarts the process, the deployed production server's pushes will fail with `401`/`403` from OneSignal. Plan to complete Tasks 2–7 in one sitting to minimize the window.

---

### Task 2: Scrub `classedge-mobile-test/.env.example`

**Files:**
- Modify: `classedge-mobile-test/.env.example:72-77`

**Interfaces:**
- None.

- [ ] **Step 1: Replace the four real values with placeholders**

Edit `classedge-mobile-test/.env.example` so the OneSignal block reads:

```
ONE_SIGNAL_APP_ID = '<your-onesignal-app-id>'
ONE_SIGN_API_KEY = '<your-onesignal-rest-api-key>'
ORGANIZATION_API_KEY = '<your-onesignal-organization-api-key>'
ONE_SIGNAL_ANDROID_CHANNEL_ID = '<your-onesignal-android-channel-id>'
```

- [ ] **Step 2: Verify no other file commits real OneSignal secrets**

Run from `classedge-mobile-test/`:
```bash
git grep -nE "os_v2_app_|89c53280-0393-43c1-8416-6ae2f4771bdd|4b5d0690-d3b0-4723-9dfa-0f02a10f37a6|8cecebb3-dbc2-4828-bd3c-874cc6f8cf13" -- ':!.env' ':!.env.example'
```
Expected: empty output (the rotated values are different anyway, but verify the *old* values are not referenced from tracked code).

- [ ] **Step 3: Stage and commit (human reviewer)**

Suggested message:
```
chore(server): scrub real OneSignal credentials from .env.example

Replace previously-committed real REST/Organization keys with
placeholder strings. Real values were rotated in OneSignal first.
```

---

### Task 3: Create and configure the `HCCCI Sandbox` OneSignal app

**Files:**
- None in this repo (manual OneSignal dashboard work).

**Interfaces:**
- Produces:
  - `SANDBOX_ONESIGNAL_APP_ID` (UUID)
  - `SANDBOX_ONESIGNAL_REST_API_KEY` (`os_v2_app_…`)
  - `SANDBOX_ONESIGNAL_ANDROID_CHANNEL_ID` (UUID)

All consumed by Tasks 6 and 7.

- [ ] **Step 1: Create the new app**

In the OneSignal dashboard:
1. Click **+ New App/Website**.
2. Name: `HCCCI Sandbox`.
3. Select the same Organization as the existing `HCCCI Production` app.
4. Click **Create**.
5. On the resulting Keys & IDs page, copy the **App ID** and **REST API Key** to your scratch location, labeled `SANDBOX_*`.

- [ ] **Step 2: Configure iOS APNs with the `.p8`, in Sandbox mode**

In `HCCCI Sandbox → Settings → Platforms → Apple iOS (APNs)`:
1. Choose **APNs Auth Key (.p8)** (not the legacy `.p12` certificate).
2. Upload the team's existing `.p8` file.
3. **Key ID:** from Apple Developer → Certificates, Identifiers & Profiles → Keys → (your APNs key).
4. **Team ID:** from Apple Developer → Membership.
5. **App Bundle ID:** `com.classifyinc.hccci.classedge.dev`.
6. **APNs Environment:** **Sandbox**.
7. Save.

- [ ] **Step 3: Configure Android FCM**

Prerequisite: ensure `com.classifyinc.hccci.classedge.dev` is registered as an Android app in the existing Firebase project. If not, add it in **Firebase Console → Project settings → Your apps → Add app → Android**.

In `HCCCI Sandbox → Settings → Platforms → Google Android (FCM)`:
1. Upload the Firebase **Service Account JSON** (Firebase Console → Project settings → Service accounts → Generate new private key).
2. Set the Android package name: `com.classifyinc.hccci.classedge.dev`.
3. Save.

- [ ] **Step 4: Create the Android notification channel**

In `HCCCI Sandbox → Settings → Notifications → Android Notification Categories`:
1. **+ New Category**. Name it `default` (or copy the existing Production channel's name for parity).
2. Configure importance / sound / vibration to match the existing Production channel.
3. Save. Copy the resulting **channel UUID** to scratch as `SANDBOX_ONESIGNAL_ANDROID_CHANNEL_ID`.

- [ ] **Step 5: Verify subscriber count is zero**

In `HCCCI Sandbox → Audience → Subscriptions`. Expected: 0 subscribers (nothing has registered against this app yet).

---

### Task 4: Audit and update the `HCCCI Production` OneSignal app

**Files:**
- None in this repo (manual OneSignal dashboard work).

**Interfaces:**
- Produces (or confirms unchanged):
  - `PRODUCTION_ONESIGNAL_APP_ID` = `89c53280-0393-43c1-8416-6ae2f4771bdd`
  - `PRODUCTION_ONESIGNAL_REST_API_KEY` (rotated in Task 1)
  - `PRODUCTION_ONESIGNAL_ANDROID_CHANNEL_ID` (unchanged unless the existing channel is missing)

- [ ] **Step 1: Verify iOS APNs configuration uses `.p8` and Production toggle**

In `HCCCI Production → Settings → Platforms → Apple iOS (APNs)`:
1. Confirm the configuration type is **APNs Auth Key (.p8)**. If it still shows a `.p12` certificate, re-upload the same `.p8` used in Task 3, with the same Key ID and Team ID.
2. **APNs Environment:** **Production**.
3. **App Bundle ID:** `com.classifyinc.hccci.classedge` (the production bundle ID). The preview bundle (`…classedge.preview`) is intentionally **not** listed here — devices register via the SDK using App ID + `.p8`, not by bundle ID match.
4. Save.

- [ ] **Step 2: Verify Android FCM covers both preview and production packages**

Prerequisite check in **Firebase Console → Project settings → Your apps**:
- `com.classifyinc.hccci.classedge` (production) — must exist.
- `com.classifyinc.hccci.classedge.preview` — must exist. If missing, add it.

In `HCCCI Production → Settings → Platforms → Google Android (FCM)`:
- Confirm the Service Account JSON is uploaded (FCM v1, not legacy server key).
- The Service Account is project-scoped, so it serves every Android package in the Firebase project.

- [ ] **Step 3: Capture the existing Android notification channel UUID**

If the value previously stored in the production Django `.env` (`8cecebb3-dbc2-4828-bd3c-874cc6f8cf13`) still appears in `Settings → Notifications → Android Notification Categories`, reuse it. Otherwise, create a new channel matching its prior settings and capture the new UUID.

---

### Task 5: Fix preview `apsEnvironment` to `"production"`

Without this, preview (TestFlight / ad-hoc) builds receive sandbox APNs tokens but the OneSignal Production app sends to the production APNs endpoint — pushes silently no-op.

**Files:**
- Modify: `client-mobile/app.config.ts:25`

**Interfaces:**
- None (entitlement change only).

- [ ] **Step 1: Edit `app.config.ts`**

Change:
```ts
  preview: {
    name: "HCCCI Preview",
    bundleIdentifier: "com.classifyinc.hccci.classedge.preview",
    androidPackage: "com.classifyinc.hccci.classedge.preview",
    scheme: "hccciclassedgepreview",
    onesignalMode: "development" as const,
    apsEnvironment: "development" as const,
  },
```
to:
```ts
  preview: {
    name: "HCCCI Preview",
    bundleIdentifier: "com.classifyinc.hccci.classedge.preview",
    androidPackage: "com.classifyinc.hccci.classedge.preview",
    scheme: "hccciclassedgepreview",
    onesignalMode: "production" as const,
    apsEnvironment: "production" as const,
  },
```

`onesignalMode` is the `onesignal-expo-plugin` mode (drives the Notification Service Extension entitlement). `apsEnvironment` is the iOS entitlement. Both must move to `production` together for the preview variant.

- [ ] **Step 2: Verify the config evaluates cleanly**

From `client-mobile/`:
```bash
APP_VARIANT=preview npx expo config --type public | grep -E "apsEnvironment|onesignalMode" -A1
```
Expected output includes `"aps-environment": "production"` for the preview variant.

- [ ] **Step 3: Stage and commit (human reviewer)**

Suggested message:
```
fix(notifications): preview builds use production APNs entitlement

Preview is distribution-signed (TestFlight/ad-hoc), so the device
gets a production APNs token. OneSignal Production app sends to the
production APNs endpoint; the previous "development" entitlement
caused silent no-ops.
```

---

### Task 6: Wire per-profile OneSignal App IDs

Currently `app.config.ts:139` reads a single `EXPO_PUBLIC_ONESIGNAL_APP_ID` env var for all variants. Wire EAS to set a different value per profile.

**Files:**
- Modify: `client-mobile/eas.json`
- Modify: `client-mobile/.env` (local development only)
- Modify: `client-mobile/.env.example`

**Interfaces:**
- Consumes: `SANDBOX_ONESIGNAL_APP_ID` (from Task 3); `PRODUCTION_ONESIGNAL_APP_ID` = `89c53280-0393-43c1-8416-6ae2f4771bdd` (from Task 4).
- Produces: per-profile `EXPO_PUBLIC_ONESIGNAL_APP_ID` at build time.

- [ ] **Step 1: Add per-profile env entries in `eas.json`**

Edit `client-mobile/eas.json`. For each of `development`, `development-simulator`, `preview`, `preview-simulator`, and `production`, extend the `env` block with `EXPO_PUBLIC_ONESIGNAL_APP_ID`. After the edit, the relevant profiles look like:

```json
"development": {
  "developmentClient": true,
  "distribution": "internal",
  "environment": "development",
  "env": {
    "APP_VARIANT": "development",
    "EXPO_PUBLIC_ONESIGNAL_APP_ID": "<SANDBOX_ONESIGNAL_APP_ID>"
  }
},
"development-simulator": {
  "developmentClient": true,
  "distribution": "internal",
  "ios": { "simulator": true },
  "environment": "development",
  "env": {
    "APP_VARIANT": "development",
    "EXPO_PUBLIC_ONESIGNAL_APP_ID": "<SANDBOX_ONESIGNAL_APP_ID>"
  }
},
"preview": {
  "distribution": "internal",
  "environment": "preview",
  "env": {
    "APP_VARIANT": "preview",
    "EXPO_PUBLIC_ONESIGNAL_APP_ID": "89c53280-0393-43c1-8416-6ae2f4771bdd"
  }
},
"preview-simulator": {
  "distribution": "internal",
  "ios": { "simulator": true },
  "environment": "preview",
  "env": {
    "APP_VARIANT": "preview",
    "EXPO_PUBLIC_ONESIGNAL_APP_ID": "89c53280-0393-43c1-8416-6ae2f4771bdd"
  }
},
"production": {
  "autoIncrement": true,
  "environment": "production",
  "env": {
    "APP_VARIANT": "production",
    "EXPO_PUBLIC_ONESIGNAL_APP_ID": "89c53280-0393-43c1-8416-6ae2f4771bdd"
  }
}
```

Replace `<SANDBOX_ONESIGNAL_APP_ID>` with the actual value from Task 3. App IDs are public-facing identifiers; committing them is fine.

- [ ] **Step 2: Set `EXPO_PUBLIC_ONESIGNAL_APP_ID` in `client-mobile/.env`**

`eas.json` env applies to EAS builds. Local `expo start` reads from `.env` instead. Update `client-mobile/.env` so local dev uses the Sandbox app ID. Append (or replace existing if present):

```
EXPO_PUBLIC_ONESIGNAL_APP_ID=<SANDBOX_ONESIGNAL_APP_ID>
```

`.env` is gitignored — do not commit.

- [ ] **Step 3: Add a placeholder to `client-mobile/.env.example`**

Append to `client-mobile/.env.example`:

```
EXPO_PUBLIC_ONESIGNAL_APP_ID=<your-sandbox-onesignal-app-id>
```

- [ ] **Step 4: Verify the resolved config per profile**

From `client-mobile/`:
```bash
APP_VARIANT=development EXPO_PUBLIC_ONESIGNAL_APP_ID="<SANDBOX_ONESIGNAL_APP_ID>" npx expo config --type public | grep onesignalAppId
APP_VARIANT=preview EXPO_PUBLIC_ONESIGNAL_APP_ID="89c53280-0393-43c1-8416-6ae2f4771bdd" npx expo config --type public | grep onesignalAppId
APP_VARIANT=production EXPO_PUBLIC_ONESIGNAL_APP_ID="89c53280-0393-43c1-8416-6ae2f4771bdd" npx expo config --type public | grep onesignalAppId
```
Expected: each invocation prints the matching App ID for that variant.

- [ ] **Step 5: Stage and commit (human reviewer)**

Stage `eas.json` and `.env.example` only (`.env` is gitignored). Suggested message:
```
feat(notifications): per-profile OneSignal App ID via EAS

dev → HCCCI Sandbox app, preview/prod → HCCCI Production app.
Drops the single shared EXPO_PUBLIC_ONESIGNAL_APP_ID and selects the
right OneSignal app at build time per EAS profile.
```

---

### Task 7: Update Django `.env` files

Two deployments: each developer's local Django (Sandbox creds) and the production Django (Production creds, rotated in Task 1).

**Files:**
- Modify: `classedge-mobile-test/.env` (local, per developer)
- Modify: production `classedge-mobile-test/.env` (on the deployed server)

**Interfaces:**
- Consumes: `SANDBOX_*` (Task 3) and rotated `PRODUCTION_*` (Tasks 1 + 4).

- [ ] **Step 1: Update local Django `.env` with Sandbox credentials**

On each developer's machine, edit `classedge-mobile-test/.env`:

```
ONE_SIGNAL_APP_ID = '<SANDBOX_ONESIGNAL_APP_ID>'
ONE_SIGN_API_KEY = '<SANDBOX_ONESIGNAL_REST_API_KEY>'
ORGANIZATION_API_KEY = '<rotated-organization-api-key>'
ONE_SIGNAL_ANDROID_CHANNEL_ID = '<SANDBOX_ONESIGNAL_ANDROID_CHANNEL_ID>'
```

`.env` is gitignored; do not commit.

- [ ] **Step 2: Restart the local Django process**

From `classedge-mobile-test/`:
```bash
# Stop the running runserver, then:
python manage.py runserver 0.0.0.0:8000
```
Expected: server starts without ImportError or KeyError on the OneSignal settings keys.

- [ ] **Step 3: Update production Django `.env` with rotated Production credentials**

On the production server (`classedge.hccci.edu.ph`), edit the Django project's `.env`:

```
ONE_SIGNAL_APP_ID = '89c53280-0393-43c1-8416-6ae2f4771bdd'
ONE_SIGN_API_KEY = '<rotated-PRODUCTION_ONESIGNAL_REST_API_KEY>'
ORGANIZATION_API_KEY = '<rotated-organization-api-key>'
ONE_SIGNAL_ANDROID_CHANNEL_ID = '<PRODUCTION_ONESIGNAL_ANDROID_CHANNEL_ID>'
```

- [ ] **Step 4: Restart the production Django process**

Use whatever process manager runs Django in production (`systemctl restart`, `supervisorctl restart`, gunicorn reload, etc.). Confirm the process is healthy:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://classedge.hccci.edu.ph/
```
Expected: a non-5xx status code (likely 200 / 302 / 403 depending on the root URL).

---

### Task 8: Smoke-test push delivery for each variant

This is the only meaningful end-to-end verification. Static config checks cannot catch APNs token mismatch or OneSignal app misconfiguration — only real device delivery can.

**Files:**
- None.

**Interfaces:**
- None.

- [ ] **Step 1: Dev variant → local Django → `HCCCI Sandbox` → device**

1. Build / install the `development` mobile variant on a physical iOS device (Sandbox APNs requires development signing) and an Android device.
2. Confirm `EXPO_PUBLIC_API_BASE_URL` points at your local cloudflared tunnel.
3. Log in and grant push permissions; confirm the device appears under `HCCCI Sandbox → Audience → Subscriptions` within ~30 seconds.
4. Trigger a server-sent push from your local Django — easiest is to create a calendar event in the Django admin (the calendar `views.py` already calls `_send_onesignal_notification`, see `classedge-mobile-test/calendars/views.py:250,317`).
5. Expected: the push arrives on the dev device within ~10 seconds. The `[OneSignal] REST API Status: 200` log appears in the Django console with a non-zero `recipients` count.

- [ ] **Step 2: Preview variant → prod Django → `HCCCI Production` → device**

1. Trigger a `preview` EAS build (`eas build --profile preview --platform ios`); distribute via TestFlight to a tester device.
2. On the tester device, log in (the preview build points at prod Django by virtue of its env). Grant push permissions.
3. Confirm the device appears in `HCCCI Production → Audience → Subscriptions`. (It will join the production subscriber pool — this is the documented trade-off; tag the test device for QA filtering if your team uses tags.)
4. From production Django, trigger any server-sent push targeted at the test user's external ID — e.g., update one of their calendar events.
5. Expected: push delivered to the preview device. If it fails silently, the most likely cause is the `apsEnvironment` fix from Task 5 not being in the build — verify the built `.ipa`'s entitlements contain `aps-environment: production`.

- [ ] **Step 3: Production variant — confirm no regression**

1. On an existing production install (any user with the App Store / production-distributed build), confirm pushes still arrive after the Task 1 REST API key rotation. The path is identical to before; only the key changed.
2. Expected: no behavior difference vs. before this work.

- [ ] **Step 4: Document in the relevant PR(s)**

Capture the smoke-test results in the PR description so a reviewer can see push delivery was verified end-to-end on real devices (not just type-checked).

---

## Self-review notes

- **Spec coverage:** All five Decisions from the spec map to tasks: (1) two OneSignal apps → Tasks 3 + 4; (2) single `.p8` reused → Tasks 3 + 4; (3) preview `apsEnvironment` fix → Task 5; (4) per-profile `EXPO_PUBLIC_ONESIGNAL_APP_ID` → Task 6; (5) env-driven Django config with no code changes → Task 7. Cleanup items from the spec (rotate leaked keys, scrub `.env.example`) → Tasks 1 + 2. Smoke validation → Task 8.
- **Open questions resolved in plan:** spec OQ #1 (eas.json vs Dashboard) — Task 6 picks `eas.json` because App IDs are public and developers benefit from seeing the per-profile mapping in the file. Spec OQ #2 (Organization API key split) — Task 7 keeps a single org-scoped key shared across both deployments.
- **Out of scope (deferred per spec):** building a real staging backend; server-side device-aware OneSignal routing; per-env Django settings module split.
