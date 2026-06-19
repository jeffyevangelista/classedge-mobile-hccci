# Device binding & attestation — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind every refresh-token request to a hardware-attested device key (Apple App Attest / Google Play Integrity), so a stolen refresh token cannot be replayed off-device.

**Architecture:** On first successful login, the client lazily generates an attestation key and posts a one-time enrollment to the backend, which verifies with Apple's / Google's attestation CA and stores the public key bound to `user_id`. Every subsequent `/auth/refresh/` request includes an `attestation_assertion` signed over the request body + a server-issued nonce. The backend rejects refreshes whose assertion does not match the bound key. Dev builds skip the whole flow via an env flag.

**Tech Stack:** `expo-app-integrity` (iOS App Attest) + Google Play Integrity SDK on Android, Django backend, new `DeviceAttestation` model.

## Global Constraints

- **Spec reference:** `docs/superpowers/specs/2026-06-18-device-attestation-design.md`.
- **Dev builds skip attestation.** Controlled by `EXPO_PUBLIC_ATTESTATION_ENABLED`.
- **Cold-start cost must not block login.** Key generation runs after a successful login; the login itself is unchanged.
- **Graceful degradation on CA outage.** Backend logs but allows the legacy unbound path for N attempts before treating as suspicious.
- **No backward-incompatible API change.** The `attestation_assertion` field is *optional* in the refresh request until a feature flag flips it required.
- **Do not auto-stage or commit.** Leave staging and committing to the human reviewer.

---

### Task 1: Backend — `DeviceAttestation` model + migrations

**Files:**
- Create: `classedge-mobile-test/accounts/models/device_attestation.py`
- Modify: `classedge-mobile-test/accounts/admin.py` (register model)

**Interfaces:**
- Produces: `DeviceAttestation(user, key_id, public_key_pem, platform, created_at, last_seen_at, failure_count)`.

- [ ] **Step 1: Define the model**

```py
# classedge-mobile-test/accounts/models/device_attestation.py
from django.db import models
from django.conf import settings


class DeviceAttestation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="device_attestations",
    )
    key_id = models.CharField(max_length=128, unique=True)
    public_key_pem = models.TextField()
    platform = models.CharField(
        max_length=16, choices=[("ios", "iOS"), ("android", "Android")]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    failure_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["user"])]
```

- [ ] **Step 2: Migration**

```bash
cd classedge-mobile-test
python manage.py makemigrations accounts
python manage.py migrate
```

- [ ] **Step 3: Commit (human reviewer)**

Suggested message: `feat(accounts): DeviceAttestation model`.

---

### Task 2: Backend — enrollment endpoint

**Files:**
- Modify: `classedge-mobile-test/accounts/views/user_views.py`
- Modify: `classedge-mobile-test/accounts/urls.py`

**Interfaces:**
- Produces: `POST /auth/attestation/enroll/` accepting `{ key_id, attestation_object, platform }`, verifying with Apple App Attest CA (iOS) or Google Play Integrity API (Android), and writing `DeviceAttestation`.

- [ ] **Step 1: Add the view**

```py
class DeviceAttestationEnrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        key_id = request.data.get("key_id")
        attestation_object = request.data.get("attestation_object")
        platform = request.data.get("platform")
        if not all([key_id, attestation_object, platform]):
            raise ValidationError("Missing fields.")

        if platform == "ios":
            public_key_pem = verify_apple_attestation(
                key_id=key_id, attestation_object=attestation_object
            )
        elif platform == "android":
            public_key_pem = verify_play_integrity(
                key_id=key_id, attestation_object=attestation_object
            )
        else:
            raise ValidationError("Unsupported platform.")

        DeviceAttestation.objects.update_or_create(
            user=request.user,
            key_id=key_id,
            defaults={"public_key_pem": public_key_pem, "platform": platform},
        )
        return Response(status=status.HTTP_201_CREATED)
```

The `verify_apple_attestation` / `verify_play_integrity` helpers wrap the relevant SDKs / REST APIs.

- [ ] **Step 2: Wire the URL**

In `accounts/urls.py`:

```py
path("api/auth/attestation/enroll/", DeviceAttestationEnrollView.as_view()),
```

- [ ] **Step 3: Commit (human reviewer)**

Suggested message: `feat(auth): device attestation enrollment endpoint`.

---

### Task 3: Backend — refresh endpoint verifies assertion

**Files:**
- Modify: `classedge-mobile-test/accounts/views/user_views.py:673-740` (PowerSyncTokenRefreshView)

- [ ] **Step 1: Issue a nonce and accept the assertion**

Add a `GET /auth/attestation/nonce/` that returns a one-time nonce keyed in the cache for 60 s. Modify `PowerSyncTokenRefreshView.post`:

```py
nonce = request.data.get("attestation_nonce")
assertion = request.data.get("attestation_assertion")
attestation_required = getattr(settings, "DEVICE_ATTESTATION_REQUIRED", False)

if attestation_required or assertion:
    if not verify_assertion(user, nonce, assertion, request.data):
        raise InvalidToken("Device attestation failed.")
```

- [ ] **Step 2: Add the feature-flag setting**

In `lms/settings.py`: `DEVICE_ATTESTATION_REQUIRED = env.bool("DEVICE_ATTESTATION_REQUIRED", default=False)`. Ship as false; flip to true after the client is rolled out.

- [ ] **Step 3: Commit (human reviewer)**

Suggested message: `feat(auth): refresh endpoint verifies device attestation`.

---

### Task 4: Client — attestation module

**Files:**
- Create: `features/auth/attestation.ts`

**Interfaces:**
- Produces:
  - `ensureAttestationEnrolled(): Promise<void>` — generates a key (idempotent) and enrolls if not done.
  - `generateAssertion(nonce: string, body: object): Promise<string>` — signs the request payload + nonce.

- [ ] **Step 1: Add native module**

```bash
pnpm add expo-app-integrity   # or react-native equivalent
```

- [ ] **Step 2: Implement the module**

```ts
// features/auth/attestation.ts
import { env } from "@/utils/env";
import * as Integrity from "expo-app-integrity"; // hypothetical API

const ENABLED = env.EXPO_PUBLIC_ATTESTATION_ENABLED === "true";

export async function ensureAttestationEnrolled(): Promise<void> {
  if (!ENABLED) return;
  const enrolled = /* read MMKV flag */;
  if (enrolled) return;
  const { keyId, attestationObject } = await Integrity.attestKey();
  await api.post("/auth/attestation/enroll/", {
    key_id: keyId,
    attestation_object: attestationObject,
    platform: Platform.OS,
  });
  /* set MMKV flag */;
}

export async function generateAssertion(
  nonce: string,
  body: object,
): Promise<string | null> {
  if (!ENABLED) return null;
  return Integrity.signAssertion({ nonce, body: JSON.stringify(body) });
}
```

- [ ] **Step 3: Commit (human reviewer)**

Suggested message: `feat(auth): client device-attestation module`.

---

### Task 5: Client — refresh endpoint includes assertion

**Files:**
- Modify: `features/auth/refreshToken.ts`

- [ ] **Step 1: Fetch nonce + sign before refresh**

```ts
export const refresh = async (refreshToken: string | null) => {
  const nonceResp = await axios.get(`${env.EXPO_PUBLIC_API_URL}/auth/attestation/nonce/`);
  const nonce = nonceResp.data?.nonce ?? null;
  const body: any = { refresh: refreshToken };
  const assertion = nonce
    ? await generateAssertion(nonce, body)
    : null;
  if (assertion) {
    body.attestation_assertion = assertion;
    body.attestation_nonce = nonce;
  }
  const data = (
    await axios.post(`${env.EXPO_PUBLIC_API_URL}/auth/refresh/`, body)
  ).data;
  return snakeToCamel<AuthResponse>(data);
};
```

- [ ] **Step 2: Enroll after first successful login**

In `hydrateSession.ts`, after writing credentials:

```ts
ensureAttestationEnrolled().catch((err) =>
  console.warn("[Attestation] enroll failed", err),
);
```

- [ ] **Step 3: Commit (human reviewer)**

Suggested message: `feat(auth): refresh requests carry device assertion`.

---

### Task 6: Per-profile flag + rollout

**Files:**
- Modify: `eas.json` (per-profile `EXPO_PUBLIC_ATTESTATION_ENABLED`)
- Modify: `app.config.ts` (passthrough)

- [ ] **Step 1: Configure flags**

Set `EXPO_PUBLIC_ATTESTATION_ENABLED=false` for `development` and `true` for `preview` / `production` in `eas.json`.

- [ ] **Step 2: Verify dev build skips attestation**

Run dev build, confirm `refresh()` does not call the nonce endpoint and does not include assertion fields.

- [ ] **Step 3: Verify preview build enrolls**

Run preview build, sign in, confirm an `enroll` request fires once and the next `refresh()` carries `attestation_assertion`.

- [ ] **Step 4: Commit (human reviewer)**

Suggested message: `chore(auth): per-profile attestation enable flag`.

---

### Task 7: Server flip to required + telemetry

- [ ] **Step 1: Monitor enrollments**

After 1-2 weeks of preview rollout, check that ≥ 95% of active sessions have a successful enrollment.

- [ ] **Step 2: Flip the backend flag**

Set `DEVICE_ATTESTATION_REQUIRED=true` in the prod Django `.env`. Restart.

- [ ] **Step 3: Watch error rates**

Watch `silent_refresh_failed` + new `attestation_failed` telemetry for the next 24 h. Roll back the flag if error rate exceeds 1%.

- [ ] **Step 4: Commit (human reviewer)**

Suggested message: `chore(auth): require device attestation on refresh`.

---

## Self-Review checklist

- Spec "must not break Expo dev workflow": Task 6 ships dev builds with attestation off. ✅
- Spec "graceful degradation": Task 3 ships server flag default-off; Task 7 only flips after monitoring. ✅
- Spec "no backward-incompatible API change at first": Task 3 keeps the assertion optional initially. ✅
- Spec "lazy enrollment": Task 4 + Task 5 enroll on first successful login, not at app boot. ✅
- Spec "rate-limited verification quotas": noted; specific rate limits are an operational concern for Task 7's monitoring step.
