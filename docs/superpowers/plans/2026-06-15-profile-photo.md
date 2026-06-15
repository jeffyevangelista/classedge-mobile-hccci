# Profile Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No auto-commit:** Per user preference, this plan never stages or commits. After each task passes its checks, stop and let the user inspect/commit.

**Goal:** Let signed-in users change or remove their profile photo from the mobile app, working offline-first via the existing PowerSync attachment pipeline. Spec: [docs/superpowers/specs/2026-06-15-profile-photo-design.md](../specs/2026-06-15-profile-photo-design.md).

**Architecture:** Tap the avatar on the Profile Information detail screen → action sheet (Take photo / Choose from library / Remove) → save file to `DocumentDirectory/attachments/` → write `file://` URI (or `""` for Remove) into the local `accounts_profile.student_photo` column → existing `Connector.uploadData()` ships it as multipart PATCH to a new `/api/accounts_profile/<id>/` server endpoint scoped to the requesting user. Round-trip URL arrives back via PowerSync and the existing attachment cache resolves it.

**Tech Stack:** React Native + Expo (`expo-image-picker`, `expo-image-manipulator`, `expo-file-system`), `@powersync/react-native`, TypeScript, Biome (lint + format). Server: Django REST Framework (existing `IdempotentLocalIdUpsertMixin` and `validate_image_file()` patterns reused).

**Repos:**
- Client: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile`
- Server: `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test`

**Repo conventions honored:**
- Client typecheck: `npm run typecheck` (= `tsc --noEmit`). Client lint: `npm run lint` (= `biome check .`).
- Client has no automated tests — verification is manual smoke testing.
- Server has a Django test suite (`python manage.py test` from server repo root) — server tasks include unit tests.
- Staging and committing left to the user. Plan ends each task at a clean working tree ready for review.

---

## File Structure

| File | Repo | Action | Responsibility |
|---|---|---|---|
| `mobile/serializers/profile_serializers.py` | server | **Create** | `ProfileWriteSerializer` — writable `student_photo`, empty-string clears the field, reuses `validate_image_file()`. |
| `mobile/views/profile_views.py` | server | **Create** | `ProfileViewSet(UpdateModelMixin, GenericViewSet)` — PATCH-only, queryset scoped to current user's profile. |
| `mobile/tests/test_profile_views.py` | server | **Create** | Coverage for the viewset and serializer. |
| `mobile/urls.py` | server | **Modify** | Register the new router; remove/replace the conflicting hand-written `accounts_profile` `path()`. |
| `app.config.ts` | client | **Modify** | Add `expo-image-picker` plugin entry with iOS permission strings. |
| `package.json` (auto via `expo install`) | client | **Modify** | Add `expo-image-manipulator`. |
| `features/profile/useUpdateStudentPhoto.ts` | client | **Create** | One-purpose hook: `UPDATE accounts_profile SET student_photo = ? WHERE id = ?`. |
| `features/profile/components/ProfilePhotoActionSheet.tsx` | client | **Create** | Bottom-sheet UI with three entries (Take photo / Choose from library / Remove). |
| `features/profile/useProfilePhotoActionSheet.tsx` | client | **Create** | Orchestrator hook: owns the sheet state, the picker / camera flow, image manipulation, and the call into `useUpdateStudentPhoto`. Exposes `{ requestEdit(profile), portal }`. |
| `features/profile/components/ProfileInformation.tsx` | client | **Modify** | Wrap the `ProfileHero` `Avatar` in a `Pressable` wired to `requestEdit`. |

Nothing else is touched. `powersync/Connector.ts`, `features/attachments/attachments.config.ts`, `AttachmentAvatarImage`, and the existing `saveAttachment()` helper are reused as-is.

---

## Task 1 — Verification of open spec assumptions

**Repo:** both
**Why first:** The spec lists four open verification items. Resolve them before touching code so the plan doesn't drift on a wrong premise.

**Files:** read-only.

- [ ] **Step 1: Confirm `UserViewProfileView` callers (server + client)**

Run from each repo root:

```
grep -rn "UserViewProfileView" /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test
grep -rn "accounts_profile/" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile --include="*.ts" --include="*.tsx"
```

Expected:
- The server `grep` returns only `accounts/views/user_views.py` (the class definition) and `mobile/urls.py` (the route). Anything else (templates, JS, mobile API call sites) means we cannot delete the existing route in Task 4 — record what you find.
- The client `grep` should find zero hand-written calls to `/api/accounts_profile/...`. (The PowerSync Connector builds the URL programmatically from `op.table`, so it won't show up in a path-literal grep.)

- [ ] **Step 2: Confirm `Profile.student_photo` accepts null at the model layer**

Read `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/accounts/models/account_models.py` around line 67 and verify:

```python
student_photo = models.ImageField(..., null=True, blank=True, ...)
```

If `null=True` is missing, the Remove flow cannot persist an empty value — record this and we'll need a migration as an added task (out of plan as written).

- [ ] **Step 3: Confirm `accounts_profile` write path on the client**

Read `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/powersync/schema.ts` around the `accountDetailsTable` definition. Confirm:

- `accounts_profile` is present in the local schema as a `sqliteTable`.
- The PowerSync `Schema` export includes the table (or the Drizzle integration auto-includes it; if the file uses an explicit table list, `accountDetailsTable` must be in it).

If `accounts_profile` is **not** marked locally-writable / included in the PowerSync schema, then `powersync.execute("UPDATE accounts_profile ...")` will silently no-op and we have to add it to the schema first.

- [ ] **Step 4: Confirm `expo-camera` plugin already covers picker-launched camera**

Read `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app.config.ts`. The current `expo-camera` plugin entry sets `cameraPermission` and `microphonePermission` — these go into `Info.plist` as `NSCameraUsageDescription` / `NSMicrophoneUsageDescription`. Good. The picker-launched camera reads the same `NSCameraUsageDescription`, so no second key is required.

- [ ] **Step 5: Checkpoint for user review**

Working tree is unchanged. Report findings from Steps 1–3 to the user. If any of them are blocking, stop here and treat them as new prep tasks before resuming.

---

## Task 2 — Server: `ProfileWriteSerializer`

**Repo:** `classedge-mobile-test` (server)
**Files:**
- Create: `mobile/serializers/profile_serializers.py`
- Create (test file used in this task and the next): `mobile/tests/test_profile_views.py`

- [ ] **Step 1: Write the failing test for the empty-string-clears behavior**

Create the test file with one test for the serializer in isolation:

```python
# mobile/tests/test_profile_views.py
from django.contrib.auth import get_user_model
from django.test import TestCase

from accounts.models.account_models import Profile
from mobile.serializers.profile_serializers import ProfileWriteSerializer

User = get_user_model()


class ProfileWriteSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice", email="alice@example.com", password="x"
        )
        # Profile is auto-created via signals on User.save() in this codebase;
        # if a Profile already exists, fetch it. If not, create explicitly.
        self.profile = Profile.objects.filter(user=self.user).first() or Profile.objects.create(user=self.user)

    def test_empty_string_clears_student_photo(self):
        # Simulate a Remove flow: the mobile client sends an empty string for
        # student_photo. The serializer must rewrite it to None so the
        # ImageField is cleared on save.
        serializer = ProfileWriteSerializer(
            instance=self.profile,
            data={"student_photo": ""},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data.get("student_photo"))
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test
python manage.py test mobile.tests.test_profile_views.ProfileWriteSerializerTests -v 2
```

Expected: ImportError / ModuleNotFoundError on `mobile.serializers.profile_serializers`.

- [ ] **Step 3: Implement the serializer**

Create `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/mobile/serializers/profile_serializers.py`:

```python
from rest_framework import serializers

from accounts.models.account_models import Profile
from accounts.utils.image_validations_utils import validate_image_file


class ProfileWriteSerializer(serializers.ModelSerializer):
    """
    Mobile profile-photo write surface. PATCH-only.

    Behaviour:
      - An empty-string `student_photo` from the client is treated as a
        "clear the field" instruction (the mobile Remove action sends
        student_photo="" via the multipart upload pipeline).
      - A non-empty file is validated via the shared image-validation util
        (size, mime, integrity).
    """

    class Meta:
        model = Profile
        fields = ["student_photo"]

    def to_internal_value(self, data):
        # Coerce empty string -> None BEFORE the default ImageField parser
        # rejects it. DRF's ImageField doesn't accept empty strings.
        if data.get("student_photo") == "":
            mutable = data.copy() if hasattr(data, "copy") else dict(data)
            mutable["student_photo"] = None
            data = mutable
        return super().to_internal_value(data)

    def validate_student_photo(self, value):
        if value is None:
            return value
        validate_image_file(value)
        return value
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
python manage.py test mobile.tests.test_profile_views.ProfileWriteSerializerTests -v 2
```

Expected: `OK` (1 test passed).

- [ ] **Step 5: Checkpoint for user review**

Two new files. Stop. The user will inspect and commit.

---

## Task 3 — Server: `ProfileViewSet`

**Repo:** `classedge-mobile-test` (server)
**Files:**
- Create: `mobile/views/profile_views.py`
- Modify: `mobile/tests/test_profile_views.py` (append a `ProfileViewSetTests` class)

- [ ] **Step 1: Append failing tests for the viewset**

Append to `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/mobile/tests/test_profile_views.py`:

```python
from rest_framework.test import APIClient


class ProfileViewSetTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(
            username="alice", email="alice@example.com", password="x"
        )
        self.bob = User.objects.create_user(
            username="bob", email="bob@example.com", password="x"
        )
        self.alice_profile = (
            Profile.objects.filter(user=self.alice).first()
            or Profile.objects.create(user=self.alice)
        )
        self.bob_profile = (
            Profile.objects.filter(user=self.bob).first()
            or Profile.objects.create(user=self.bob)
        )
        self.client = APIClient()

    def _patch(self, url, *, user, data, fmt="multipart"):
        self.client.force_authenticate(user=user)
        return self.client.patch(url, data=data, format=fmt)

    def test_patch_clears_own_photo_via_empty_string(self):
        url = f"/api/accounts_profile/{self.alice_profile.pk}/"
        # Pre-set a photo so the clear is observable.
        self.alice_profile.student_photo = "profile/seed.jpg"
        self.alice_profile.save(update_fields=["student_photo"])

        resp = self._patch(url, user=self.alice, data={"student_photo": ""}, fmt="multipart")

        self.assertEqual(resp.status_code, 200, resp.content)
        self.alice_profile.refresh_from_db()
        self.assertFalse(bool(self.alice_profile.student_photo))

    def test_patch_other_users_profile_returns_404(self):
        # Alice attempts to PATCH Bob's profile id. Queryset filter scopes to
        # the requesting user's own profile, so this is 404 (not 403) —
        # prevents enumeration.
        url = f"/api/accounts_profile/{self.bob_profile.pk}/"
        resp = self._patch(url, user=self.alice, data={"student_photo": ""}, fmt="multipart")
        self.assertEqual(resp.status_code, 404, resp.content)

    def test_unauthenticated_returns_401(self):
        url = f"/api/accounts_profile/{self.alice_profile.pk}/"
        resp = self.client.patch(url, data={"student_photo": ""}, format="multipart")
        self.assertIn(resp.status_code, (401, 403))
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
python manage.py test mobile.tests.test_profile_views.ProfileViewSetTests -v 2
```

Expected: failures on `404` (no route yet) or `ImportError` on the view module.

- [ ] **Step 3: Implement the viewset**

Create `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/mobile/views/profile_views.py`:

```python
from rest_framework.mixins import UpdateModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication

from accounts.models.account_models import Profile
from mobile.serializers.profile_serializers import ProfileWriteSerializer


class ProfileViewSet(UpdateModelMixin, GenericViewSet):
    """
    Mobile profile-write endpoint.

    Surface:
      PATCH /api/accounts_profile/<id>/ — update the current user's profile.

    The queryset is filtered to Profile.objects.filter(user=request.user), so
    a PATCH to any id other than the requester's own returns 404 (not 403) —
    which prevents enumeration of other users' profile ids.

    Method whitelist excludes PUT/POST/DELETE/list/retrieve to keep the
    surface minimal: the mobile client only ever PATCHes.
    """

    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ProfileWriteSerializer
    http_method_names = ["patch", "options"]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)
```

- [ ] **Step 4: Routing isn't done yet — confirm tests still fail with the expected reason**

```bash
python manage.py test mobile.tests.test_profile_views.ProfileViewSetTests -v 2
```

Expected: the `_patch` calls still return 404 because the URL isn't registered. Tests will go green in Task 4. The serializer test from Task 2 should still pass.

- [ ] **Step 5: Checkpoint for user review**

Two new files (viewset module + appended tests). Stop. User inspects and commits.

---

## Task 4 — Server: register the route, retire the conflicting `path()`

**Repo:** `classedge-mobile-test` (server)
**Files:**
- Modify: `mobile/urls.py`

- [ ] **Step 1: Read the current routing file**

Open `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/mobile/urls.py`. Locate:

- the `DefaultRouter()` and its `router.register(r'activity_studentactivity', ...)` line near line 11 (this is the canonical example to mirror).
- the existing `path('accounts_profile/<int:id>/', UserViewProfileView, ...)` hand-written entry. (Path prefix may vary — search for `UserViewProfileView` to find it.)

- [ ] **Step 2: Decide remove vs. coexist based on Task 1's findings**

If Task 1 Step 1 found **no** non-routing references to `UserViewProfileView`:

- Remove the hand-written `path('accounts_profile/<int:id>/', UserViewProfileView, ...)` line entirely.

If Task 1 found a remaining consumer:

- **Stop and report.** Do not silently break a caller. The user decides whether to migrate the caller, rename the new router basename, or keep both behind different prefixes.

- [ ] **Step 3: Register the new viewset**

Add to the same router block (immediately after the `activity_studentactivity` line):

```python
from mobile.views.profile_views import ProfileViewSet
# ...
router.register(r'accounts_profile', ProfileViewSet, basename='accounts_profile_write')
```

Keep imports grouped per the file's existing style.

- [ ] **Step 4: Run the full ProfileViewSet test class**

```bash
python manage.py test mobile.tests.test_profile_views -v 2
```

Expected: all four tests pass (the serializer test from Task 2 plus the three viewset tests from Task 3).

- [ ] **Step 5: Run the rest of the mobile app's tests to confirm no regressions**

```bash
python manage.py test mobile -v 2
```

Expected: all tests pass. If the existing `User_Profile` viewset / list endpoint has tests that depended on the now-removed `path()`, address them as part of this task before checkpointing.

- [ ] **Step 6: Manual curl probe (optional but recommended)**

With the dev server running and a valid JWT in `$TOKEN`, and a real `$PROFILE_ID`:

```bash
curl -X PATCH "http://localhost:8000/api/accounts_profile/$PROFILE_ID/" \
  -H "Authorization: Bearer $TOKEN" \
  -F "student_photo=@/path/to/test.jpg" \
  -i
```

Expected: HTTP 200 with the updated profile. Verify the file landed under `MEDIA_ROOT/profile/...`.

- [ ] **Step 7: Checkpoint for user review**

`mobile/urls.py` is modified (one `register` line added, optionally one `path` removed). Stop.

---

## Task 5 — Client: install `expo-image-manipulator` + add picker plugin entry

**Repo:** `client-mobile`
**Files:**
- Modify: `app.config.ts`
- Modify (auto): `package.json` and `package-lock.json` / `yarn.lock`

- [ ] **Step 1: Install `expo-image-manipulator`**

```bash
cd /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
npx expo install expo-image-manipulator
```

Expected: a version compatible with the current Expo SDK is added to `package.json`.

- [ ] **Step 2: Add the `expo-image-picker` plugin entry to `app.config.ts`**

Open `app.config.ts`. Find the `plugins:` array (starts around line 80) and add the following entry, placing it adjacent to the existing `expo-camera` plugin entry for cohesion:

```ts
[
  "expo-image-picker",
  {
    photosPermission:
      "Allow Classedge to access your photos so you can change your profile photo.",
    cameraPermission:
      "Allow Classedge to use your camera so you can take a new profile photo.",
  },
],
```

The picker's `cameraPermission` value here is the one used when the picker launches the camera directly — it's distinct from `expo-camera`'s `cameraPermission` but they can carry the same Info.plist key (`NSCameraUsageDescription`). Last writer wins for the Info.plist string; that's fine — both messages describe legitimate uses.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: clean for `app.config.ts`.

- [ ] **Step 5: Note for the user — native rebuild required**

This is a config-only step; nothing renders yet. The new permission strings only land on-device after a development build. Note in the user-review checkpoint that a `npx expo run:ios` / `npx expo run:android` rebuild is required before Task 9's manual test plan can be executed.

- [ ] **Step 6: Checkpoint for user review**

`app.config.ts`, `package.json`, and lockfile updated. Stop.

---

## Task 6 — Client: `useUpdateStudentPhoto` hook

**Repo:** `client-mobile`
**Files:**
- Create: `features/profile/useUpdateStudentPhoto.ts`

- [ ] **Step 1: Implement the hook**

Create `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/profile/useUpdateStudentPhoto.ts`:

```ts
import { useCallback } from "react";
import { powersync } from "@/powersync/system";

/**
 * Writes a new value to accounts_profile.student_photo for the given profile
 * id (= Profile.pk, the integer PK of the synced row). The Connector picks
 * up the resulting PATCH op from the PowerSync CRUD queue — if the value is
 * a file:// URI, it sends multipart; if it's an empty string, it sends JSON
 * `{"student_photo": ""}`. The server-side ProfileWriteSerializer treats
 * empty as "clear the field".
 */
export function useUpdateStudentPhoto() {
  return useCallback(async (profileId: number, value: string) => {
    await powersync.execute(
      "UPDATE accounts_profile SET student_photo = ? WHERE id = ?",
      [value, profileId],
    );
  }, []);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean for the new file.

- [ ] **Step 4: Checkpoint for user review**

One new file. Stop.

---

## Task 7 — Client: `ProfilePhotoActionSheet` component

**Repo:** `client-mobile`
**Files:**
- Create: `features/profile/components/ProfilePhotoActionSheet.tsx`

The sheet is a near-twin of `features/classroom/components/ImageSourceSheet.tsx`, with a third entry for Remove that is shown conditionally.

- [ ] **Step 1: Implement the sheet**

Create `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/profile/components/ProfilePhotoActionSheet.tsx`:

```tsx
import { useCallback, useMemo } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

const BOTTOM_SHEET_MAX_WIDTH = 768;

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onRemove: () => void;
  canRemove: boolean;
};

export const ProfilePhotoActionSheet = ({
  isOpen,
  onOpenChange,
  onPickCamera,
  onPickLibrary,
  onRemove,
  canRemove,
}: Props) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 8,
    }),
    [screenWidth],
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleCamera = useCallback(() => {
    close();
    onPickCamera();
  }, [close, onPickCamera]);

  const handleLibrary = useCallback(() => {
    close();
    onPickLibrary();
  }, [close, onPickLibrary]);

  const handleRemove = useCallback(() => {
    close();
    onRemove();
  }, [close, onRemove]);

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          enableDynamicSizing
          topInset={Math.max(insets.top, 16)}
          style={contentStyle}
        >
          <View className="px-5 pt-4 pb-6 gap-1">
            <AppText weight="bold" className="text-lg text-foreground">
              Profile photo
            </AppText>
            <AppText className="text-xs text-muted mb-3">
              Change or remove the photo on your profile.
            </AppText>

            <SourceOption
              icon="CameraIcon"
              label="Take photo"
              description="Capture with the device camera"
              tone="accent"
              tint={accentColor}
              onPress={handleCamera}
            />
            <SourceOption
              icon="ImageSquareIcon"
              label="Choose from library"
              description="Pick from your saved photos"
              tone="accent"
              tint={accentColor}
              onPress={handleLibrary}
            />
            {canRemove ? (
              <SourceOption
                icon="TrashIcon"
                label="Remove photo"
                description="Show your initials instead"
                tone="danger"
                tint={dangerColor}
                onPress={handleRemove}
              />
            ) : null}

            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
              className="mt-2 py-3 rounded-xl items-center active:opacity-70"
            >
              <AppText weight="semibold" className="text-sm text-muted">
                Cancel
              </AppText>
            </Pressable>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

const SourceOption = ({
  icon,
  label,
  description,
  tone,
  tint,
  onPress,
}: {
  icon: IconName;
  label: string;
  description: string;
  tone: "accent" | "danger";
  tint: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
    className="flex-row items-center gap-3 py-2 px-2 rounded-xl active:opacity-80"
  >
    <View
      className={`w-12 h-12 rounded-xl items-center justify-center ${tone === "danger" ? "bg-danger-soft" : "bg-accent-soft"}`}
    >
      <Icon name={icon} size={22} color={tint} />
    </View>
    <View className="flex-1">
      <AppText
        weight="semibold"
        className={`text-sm ${tone === "danger" ? "text-danger" : "text-foreground"}`}
      >
        {label}
      </AppText>
      <AppText className="text-xs text-muted mt-0.5">{description}</AppText>
    </View>
  </Pressable>
);

export default ProfilePhotoActionSheet;
```

If the `TrashIcon` name doesn't exist in `@/components/Icon`, substitute the closest available delete/remove glyph from the icon set (e.g. `TrashSimpleIcon`).

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If the icon name is unknown, the error will pinpoint it — pick a matching name from the `IconName` union.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

One new file. Stop.

---

## Task 8 — Client: `useProfilePhotoActionSheet` orchestrator hook

**Repo:** `client-mobile`
**Files:**
- Create: `features/profile/useProfilePhotoActionSheet.tsx`

This is the public entry point: a hook that returns `{ requestEdit, portal }`. `requestEdit({ profileId, currentPhoto })` opens the sheet; `portal` is rendered once by the consumer to mount the sheet UI plus the camera modal.

- [ ] **Step 1: Implement the hook**

Create `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/profile/useProfilePhotoActionSheet.tsx`:

```tsx
import { useCallback, useState } from "react";
import { Alert, Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "heroui-native";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";
import { useCamera } from "@/features/camera/useCamera";
import { saveAttachment } from "@/features/classroom/ classroom.service";
import { ProfilePhotoActionSheet } from "@/features/profile/components/ProfilePhotoActionSheet";
import { useUpdateStudentPhoto } from "@/features/profile/useUpdateStudentPhoto";

type EditTarget = {
  profileId: number;
  currentPhoto?: string | null;
};

const MANIPULATE_MAX_WIDTH = 1024;
const MANIPULATE_QUALITY = 0.8;

export function useProfilePhotoActionSheet() {
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { toast } = useToast();

  const {
    cameraRef,
    facing,
    flash,
    ensurePermission: ensureCameraPermission,
    takePicture,
    toggleFacing,
    toggleFlash,
    resetPhoto,
  } = useCamera();
  const updateStudentPhoto = useUpdateStudentPhoto();

  const requestEdit = useCallback((next: EditTarget) => {
    setTarget(next);
    setShowSheet(true);
  }, []);

  const persistAndUpdate = useCallback(
    async (sourceUri: string) => {
      if (!target) return;
      try {
        // Picker already cropped to 1:1; resizing width:1024 yields 1024x1024.
        const manipulated = await ImageManipulator.manipulateAsync(
          sourceUri,
          [{ resize: { width: MANIPULATE_MAX_WIDTH } }],
          {
            compress: MANIPULATE_QUALITY,
            format: ImageManipulator.SaveFormat.JPEG,
          },
        );
        const persistent = await saveAttachment(manipulated.uri);
        await updateStudentPhoto(target.profileId, persistent);
      } catch (err) {
        console.error("[useProfilePhotoActionSheet] persist failed:", err);
        toast.show({
          label: "Couldn't save that photo",
          description: "Please try again.",
          variant: "danger",
        });
      }
    },
    [target, toast, updateStudentPhoto],
  );

  const handlePickLibrary = useCallback(async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = result.granted;
      if (!granted && !result.canAskAgain) {
        Alert.alert(
          "Photo Library Permission Required",
          "Enable photo library access in Settings to choose a profile photo.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      if (!granted) return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await persistAndUpdate(result.assets[0].uri);
  }, [persistAndUpdate]);

  const handlePickCamera = useCallback(async () => {
    const granted = await ensureCameraPermission();
    if (!granted) {
      toast.show({
        label: "Camera permission denied",
        description: "Enable camera access in Settings to take a photo.",
        variant: "danger",
      });
      return;
    }
    setShowCamera(true);
  }, [ensureCameraPermission, toast]);

  const handleCapture = useCallback(async () => {
    const photo = await takePicture();
    if (!photo) return;
    setShowCamera(false);
    resetPhoto();
    // Run the captured photo through the picker's edit/crop UI so the user
    // gets the same square-crop confirmation step as the library flow.
    const cropped = await ImagePicker.openCropperAsync?.({
      sourceUri: photo.uri,
      aspect: [1, 1],
    }).catch(() => null);
    const finalUri = cropped?.uri ?? photo.uri;
    await persistAndUpdate(finalUri);
  }, [persistAndUpdate, resetPhoto, takePicture]);

  const handleCloseCamera = useCallback(() => {
    resetPhoto();
    setShowCamera(false);
  }, [resetPhoto]);

  const handleRemove = useCallback(() => {
    if (!target) return;
    Alert.alert(
      "Remove profile photo?",
      "Your initials will appear instead.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await updateStudentPhoto(target.profileId, "");
            } catch (err) {
              console.error("[useProfilePhotoActionSheet] remove failed:", err);
              toast.show({
                label: "Couldn't remove the photo",
                description: "Please try again.",
                variant: "danger",
              });
            }
          },
        },
      ],
    );
  }, [target, toast, updateStudentPhoto]);

  const portal = (
    <>
      <ProfilePhotoActionSheet
        isOpen={showSheet}
        onOpenChange={setShowSheet}
        onPickCamera={handlePickCamera}
        onPickLibrary={handlePickLibrary}
        onRemove={handleRemove}
        canRemove={!!target?.currentPhoto}
      />
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={handleCloseCamera}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
          />
          <SafeAreaView style={styles.cameraOverlay}>
            <View style={styles.cameraTopBar}>
              <Pressable
                style={styles.cameraIconButton}
                onPress={handleCloseCamera}
                accessibilityRole="button"
                accessibilityLabel="Close camera"
              >
                <Icon name="XIcon" size={24} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.cameraIconButton}
                onPress={toggleFlash}
                accessibilityRole="button"
                accessibilityLabel={flash === "on" ? "Turn flash off" : "Turn flash on"}
              >
                <Icon
                  name={flash === "on" ? "LightningIcon" : "LightningSlashIcon"}
                  size={24}
                  color="#fff"
                />
              </Pressable>
            </View>
            <View style={styles.cameraBottomBar}>
              <View style={styles.cameraSpacer} />
              <Pressable
                style={styles.captureButton}
                onPress={handleCapture}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
              >
                <View style={styles.captureInner} />
              </Pressable>
              <View style={styles.cameraSpacer}>
                <Pressable
                  style={styles.cameraIconButton}
                  onPress={toggleFacing}
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera"
                >
                  <Icon name="CameraRotateIcon" size={28} color="#fff" />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );

  return { requestEdit, portal };
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  cameraOverlay: { flex: 1, justifyContent: "space-between" },
  cameraTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cameraBottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  cameraSpacer: { flex: 1, alignItems: "center" },
  cameraIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
});
```

**On `ImagePicker.openCropperAsync`:** if your installed `expo-image-picker` version does not export `openCropperAsync` (it was added in newer SDKs), drop the post-capture crop step and rely on the camera image as-is — the manipulator will still resize to 1024×1024. The library flow keeps `allowsEditing: true` either way, so library picks always get cropped.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If `openCropperAsync` isn't on the type, follow the fallback note above (delete the crop call, use `photo.uri` directly).

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 4: Checkpoint for user review**

One new file. Stop.

---

## Task 9 — Client: wire the avatar in `ProfileInformation.tsx`

**Repo:** `client-mobile`
**Files:**
- Modify: `features/profile/components/ProfileInformation.tsx`

- [ ] **Step 1: Read the current file**

Open `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/profile/components/ProfileInformation.tsx`. Locate the `ProfileHero` component (around lines 118–158) and its `Avatar` (around lines 130–137).

- [ ] **Step 2: Import the orchestrator hook**

Add to the imports block:

```ts
import { Pressable } from "react-native";
import { useProfilePhotoActionSheet } from "@/features/profile/useProfilePhotoActionSheet";
```

(`Pressable` may already be imported indirectly; add it if missing — current file imports only `View` from `react-native` at line 2.)

- [ ] **Step 3: Use the hook in the `ProfileInformation` component**

Inside the `ProfileInformation` function (above the return), call the hook and pass the orchestrator's `requestEdit` callback down to `ProfileHero`:

```tsx
const { requestEdit, portal } = useProfilePhotoActionSheet();
const profileId = formattedData?.id ?? null;
const currentPhoto = formattedData?.studentPhoto ?? null;

const openEditor = profileId
  ? () => requestEdit({ profileId, currentPhoto })
  : undefined;
```

Then render the `portal` once inside the screen — place it just inside the `ScreenScrollView` (or as a sibling fragment in the return):

```tsx
return (
  <>
    <ScreenScrollView ... >
      <ProfileHero
        fullName={fullName}
        role={role}
        idNumber={formattedData.idNumber ?? null}
        photo={formattedData.studentPhoto}
        onEditPhoto={openEditor}
      />
      ...
    </ScreenScrollView>
    {portal}
  </>
);
```

- [ ] **Step 4: Add `onEditPhoto` to `ProfileHero` and wrap the `Avatar`**

Extend the `ProfileHero` props and wrap the `Avatar` in a `Pressable` when the callback is provided:

```tsx
const ProfileHero = ({
  fullName,
  role,
  idNumber,
  photo,
  onEditPhoto,
}: {
  fullName: string;
  role?: string | null;
  idNumber: string | null;
  photo?: string | null;
  onEditPhoto?: () => void;
}) => (
  <View className="items-center max-w-3xl mx-auto w-full">
    <Pressable
      onPress={onEditPhoto}
      disabled={!onEditPhoto}
      accessibilityRole="button"
      accessibilityLabel="Edit profile photo"
      className="rounded-full active:opacity-80"
    >
      <Avatar alt={fullName} size="lg" className="w-20 h-20 border-2 border-border">
        <AttachmentAvatarImage path={photo ?? undefined} />
        <AvatarFallbackImage />
      </Avatar>
    </Pressable>
    <AppText weight="bold" className="text-xl mt-3 text-center">
      {fullName}
    </AppText>
    ...
  </View>
);
```

Keep the rest of `ProfileHero` (role pill, ID pill) unchanged.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If `formattedData.id` isn't typed, double-check the `useUserDetails` row shape — `accountDetailsTable.id` is the column at `powersync/schema.ts:14`, so it should be present on the result row.

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 7: Checkpoint for user review**

One modified file. Stop.

---

## Task 10 — End-to-end manual smoke test

**Repos:** both
**Files:** none modified.

Run after the user has rebuilt the dev client (`npx expo run:ios` and `npx expo run:android`) so the new picker plugin permission strings are in the binaries, and after the server is running with the new route registered.

Connect to the dev backend through a cloudflared tunnel (NOT a zrok share — multipart fails through zrok per project memory).

- [ ] **Step 1: Library photo round-trip (iOS sim)**

Sign in → Profile tab → tap header avatar → land on Profile Information → tap the hero avatar → Choose from library → pick → native crop → Done.

Expected:
- Avatar in `ProfileHero` swaps to the new image immediately.
- Sync Center shows the PATCH op as `ok` within seconds.
- Cold restart → avatar still shows the new image (resolved from the server URL by the attachment cache, not from `file://`).

- [ ] **Step 2: Camera photo round-trip (physical Android)**

Same flow with Take photo.

Expected: identical to Step 1.

- [ ] **Step 3: Remove**

Profile Information → tap hero avatar → Remove photo → confirm.

Expected:
- Avatar reverts to the initials placeholder immediately.
- Sync Center shows the PATCH op as `ok`.
- Server `Profile.student_photo` is null. Cold restart → still showing initials.

- [ ] **Step 4: Offline behaviour**

Enable airplane mode → pick photo → confirm optimistic swap and queued Sync Center op → disable airplane mode → confirm queue drains and avatar transitions to the server URL.

- [ ] **Step 5: Rapid replace**

Pick photo A → before the queue drains, pick photo B. Expected: only B ends up on the server; both ops complete `ok` in order.

- [ ] **Step 6: Permission denial path**

Settings → revoke Photos permission for the dev build → relaunch → tap avatar → Choose from library → deny prompt. Expected: Settings-link alert appears; tapping it opens the OS settings screen.

Repeat for Camera.

- [ ] **Step 7: Server-side sanity (curl through the dev tunnel)**

```bash
# Confirm cross-user PATCH returns 404:
curl -X PATCH "$TUNNEL/api/accounts_profile/<other_user_profile_id>/" \
  -H "Authorization: Bearer $TOKEN" \
  -F "student_photo=" \
  -i
# Expected: 404
```

```bash
# Confirm a too-large jpeg returns 400:
curl -X PATCH "$TUNNEL/api/accounts_profile/$PROFILE_ID/" \
  -H "Authorization: Bearer $TOKEN" \
  -F "student_photo=@/path/to/12mb.jpg" \
  -i
# Expected: 400 from validate_image_file()
```

- [ ] **Step 8: Regression check on the classroom-submission flow**

Take or grade an assessment that triggers a multipart upload via the existing classroom flow. Expected: still works — no regression in the shared Connector path.

- [ ] **Step 9: Checkpoint for user review**

Manual test plan complete. Capture any unexpected findings as follow-up tickets. Working tree unchanged from Task 9. Stop.

---

## After-the-fact cleanup considerations (out of scope, captured for the user)

- `features/classroom/ classroom.service.ts` has a leading space in its filename. If left as-is, future tooling may keep tripping over it. A rename is non-trivial because every importer would need updating — out of scope for this plan but a worthwhile follow-up.
- `saveAttachment()` is currently re-exported from a classroom file but is conceptually generic. Moving it to `features/attachments/saveAttachment.ts` and re-pointing the classroom import is a small, safe follow-up.
- Orphaned local files under `DocumentDirectory/attachments/` after sync (covered as a known shortcoming in the spec) — track if real-world disk usage warrants a sweeper.
