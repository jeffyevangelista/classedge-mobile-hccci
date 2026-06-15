# Profile Photo — Change & Remove

**Date:** 2026-06-15
**Status:** Design — pending implementation plan
**Touches (client):** `features/profile/components/ProfileInformation.tsx` (avatar in `ProfileHero`), `app.config.ts`, new `features/profile/useProfilePhotoActionSheet.tsx`, new `features/profile/useUpdateStudentPhoto.ts`
**Touches (server `classedge-mobile-test`):** `mobile/urls.py`, new `mobile/views/profile_views.py`, new `mobile/serializers/profile_serializers.py`

## Goal

Let a signed-in user change or remove their own profile photo from the mobile app, working offline-first via the existing PowerSync attachment pipeline. Tapping the avatar on the Profile Information detail screen (the screen reached from the tab header avatar) opens an action sheet (Take photo / Choose from library / Remove). On pick, the photo is cropped square via the native picker, resized client-side, written into the local `accounts_profile.student_photo` column as a `file://` URI, and shipped to the server by `Connector.uploadData()` as a multipart `PATCH /api/accounts_profile/<id>/`. On round-trip, the canonical URL arrives back via the PowerSync sync stream and the existing attachment cache resolves it transparently.

The tab-header avatar in `HeaderComponent.tsx` keeps its existing navigation role (tap → drill into Profile Information). The new edit affordance lives on the avatar inside `ProfileInformation.tsx`'s `ProfileHero`, which today is non-interactive.

## Non-goals

- No broader "edit profile" capability. Name, gender, contact info, etc. stay read-only. The action sheet only edits the photo.
- No camera or library entry points outside the profile screen. The `TabsHeader` avatar stays decorative.
- No custom crop UI — we use `expo-image-picker`'s built-in square crop (`allowsEditing: true`).
- No preview-then-save confirmation step. The native crop screen's Done/Cancel already gives the user a commit moment.
- No new push notifications, no email-of-record verification, no audit logging beyond the sync-event log we already write.
- No cloud-storage migration. The server keeps using local filesystem `MEDIA_ROOT` as it does today. Production storage hardening is tracked separately.
- No client-side mechanism for permanently-failed uploads (e.g., a "give up after N retries" button). Same shortcoming as the existing classroom-submission flow — out of scope here.
- No backfill or migration for users without a `Profile` row. The avatar pressable is disabled when no local profile row exists.

## Architecture overview

The feature reuses every layer of the existing PowerSync attachment pipeline. The only architectural addition is a new writable server endpoint at `/api/accounts_profile/<id>/` that mirrors the shape of `/api/activity_studentactivity/<id>/`.

```
[User taps avatar]
      │
      ▼
[useProfilePhotoActionSheet] ── Take photo ──▶ expo-image-picker (camera)
      │                       ── Library ────▶ expo-image-picker (library)
      │                       ── Remove ─────▶ confirm alert
      │
      ▼
[expo-image-manipulator: resize 1024×1024, q=0.8, jpeg]
      │
      ▼
[saveAttachment → DocumentDirectory/attachments/<uuid>.jpg]
      │
      ▼
[useUpdateStudentPhoto → PowerSync UPDATE accounts_profile.student_photo]
      │       (file:// URI for pick, "" for Remove)
      ▼
[Connector.uploadData detects file:// or "" → multipart or JSON PATCH]
      │
      ▼
[Server: ProfileViewSet.partial_update via UpdateModelMixin]
      │       (queryset filtered to Profile.objects.filter(user=request.user))
      ▼
[Profile.save() persists photo + auto-creates Attachment]
      │
      ▼
[Sync stream pushes updated row back; AttachmentAvatarImage cache resolves new URL]
```

## What changes — client

### 1. New: `features/profile/useProfilePhotoActionSheet.tsx`

A single hook that owns the action-sheet UI plus the pick/capture/manipulate/persist sequence. Exposes `openProfilePhotoActionSheet()`.

Responsibilities:

- Render an action sheet with three entries:
  - **Take photo** — visible when camera permission is grantable on this platform.
  - **Choose from library** — always visible.
  - **Remove photo** — visible only when the current `studentPhoto` value is non-empty.
- For Take photo / Choose from library:
  - Request the relevant permission via `expo-image-picker`. On denial, render an inline affordance that calls `Linking.openSettings()`.
  - Launch the picker with `{ allowsEditing: true, aspect: [1, 1], quality: 0.8, mediaTypes: 'Images' }`.
  - Run `expo-image-manipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.8, format: 'jpeg' })` on the result.
  - Call `saveAttachment(processedUri)` (existing helper from the classroom feature) to copy into `DocumentDirectory/attachments/<uuid>.jpg`.
  - Invoke `useUpdateStudentPhoto()` with the local `file://` URI.
- For Remove photo:
  - Show a confirm alert ("Remove your profile photo?").
  - On confirm, invoke `useUpdateStudentPhoto("")`.

### 2. New: `features/profile/useUpdateStudentPhoto.ts`

Single-purpose hook. Takes a string (`file://…` URI or empty `""`) and runs:

```sql
UPDATE accounts_profile SET student_photo = ? WHERE id = ?
```

against the local PowerSync database, where `id` is the current user's profile id. The PowerSync watcher takes it from there.

### 3. Modified: `ProfileHero` avatar in `features/profile/components/ProfileInformation.tsx`

Wrap the `Avatar` (currently at `ProfileInformation.tsx:130-137`) in a `Pressable` that calls `openProfilePhotoActionSheet()`. Pass the current profile id and `studentPhoto` value into the action-sheet hook so it knows which row to PATCH and whether to show the Remove entry. The pressable is disabled when no local profile row exists.

`HeaderComponent.tsx`'s avatar pressable is intentionally left alone — it continues to navigate to `/(main)/profile/profile-info`.

### 4. Modified: `app.config.ts`

Add `NSPhotoLibraryUsageDescription` via the `expo-image-picker` plugin entry. Verify `NSCameraUsageDescription` is set (camera plugin is configured today; confirm it covers picker-launched camera).

### 5. Reused, no changes

- `powersync/Connector.ts` — `buildMultipartBody()` already detects `file://` and converts to multipart; empty-string values are forwarded as `student_photo=""` via `formData.append(key, String(value))`.
- `features/attachments/attachments.config.ts` — `accounts_profile.student_photo` is already a tracked column at priority 1.
- `AttachmentAvatarImage` — already resolves URIs through the attachment cache.
- `saveAttachment()` from the classroom feature — mirror its existing usage.

## What changes — server (`classedge-mobile-test`)

### 1. New: `mobile/views/profile_views.py`

```python
class ProfileViewSet(UpdateModelMixin, GenericViewSet):
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ProfileWriteSerializer
    http_method_names = ['patch']  # PATCH only — no list/retrieve/create/delete/put

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)
```

`Profile.user` is OneToOne, so the queryset returns at most one row per user. Any PATCH to a profile id the user doesn't own returns 404 (queryset filter, not a permission denial — prevents enumeration). `IdempotentLocalIdUpsertMixin` is intentionally not used because the mobile client never inserts a profile.

Note on the URL `id`: `accounts_profile` is a sync-down table, so the PowerSync row id matches the server's integer PK. The Connector's `op.id` resolves to `Profile.pk` directly — no `local_id` mapping needed.

### 2. New: `mobile/serializers/profile_serializers.py`

```python
class ProfileWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['student_photo']

    def to_internal_value(self, data):
        # Treat empty-string student_photo as "clear" (Remove flow).
        # Default DRF behavior would reject empty string for an ImageField.
        if data.get('student_photo') == '':
            data = data.copy()
            data['student_photo'] = None
        return super().to_internal_value(data)

    def validate_student_photo(self, value):
        if value is None:
            return value
        validate_image_file(value)  # reuse existing util (10MB, jpg/png/gif/webp)
        return value
```

`Profile.save()` (in `accounts/models/account_models.py:97-118`) already auto-creates an `Attachment` row when `student_photo` changes, so no extra wiring is required for the attachment side.

### 3. Modified: `mobile/urls.py`

- Register the new viewset on the existing router:
  `router.register(r'accounts_profile', ProfileViewSet, basename='accounts_profile_write')`
- **Remove the existing hand-written `path('/api/accounts_profile/<int:id>/', UserViewProfileView)`** after a repo-wide grep confirms no consumer hits it. If something does, leave it but mount the new router under a path segment that doesn't collide.

## Data flow — step by step

### Take photo / Choose from library

1. User taps avatar on profile screen → action sheet opens (Remove entry visible only if `studentPhoto` is non-empty).
2. User taps Take photo or Choose from library.
3. `expo-image-picker` requests the relevant permission. On denial, action sheet flips to the "Open Settings" affordance and exits.
4. Picker launches with `allowsEditing: true, aspect: [1,1], quality: 0.8`. User crops, taps Done.
5. `expo-image-manipulator` resizes by `width: 1024` (the picker already returned a square via `aspect: [1,1]`, so the output is 1024×1024), re-encodes as jpeg at quality 0.8. Typical output: 200–500 KB.
6. `saveAttachment()` copies the manipulated file into `DocumentDirectory/attachments/<uuid>.jpg` for persistence across app restarts.
7. PowerSync: `UPDATE accounts_profile SET student_photo = 'file://<doc-dir>/attachments/<uuid>.jpg' WHERE id = <profile_id>`.
8. Avatar swaps to the local URI immediately (optimistic).
9. Connector picks up the PATCH op, detects `file://`, builds multipart, and PATCHes `/api/accounts_profile/<profile_id>/`. 401 → silent refresh + retry (existing behaviour).
10. Server validates via `validate_image_file()`, persists, returns serialized profile.
11. PowerSync sync stream updates the local row with the canonical server URL.
12. `AttachmentAvatarImage` cache resolves the new URL; the local `file://` is no longer referenced.

### Remove photo

1. User taps Remove photo → confirm alert.
2. On confirm, PowerSync: `UPDATE accounts_profile SET student_photo = '' WHERE id = <profile_id>`.
3. Avatar falls back to the initials placeholder immediately.
4. Connector picks up the PATCH op, detects no `file://`, sends JSON `{"student_photo": ""}`.
5. Serializer's `to_internal_value` rewrites empty string to `None`; `Profile.student_photo` clears.
6. Sync stream propagates the cleared row back. Initials remain.

## Error handling

| Failure | Behaviour |
|---|---|
| Permission denied (library or camera) | Action sheet shows an inline "Open Settings" link via `Linking.openSettings()`. No DB write. |
| Picker / native crop cancelled | No-op. Nothing written. |
| `expo-image-manipulator` or `saveAttachment()` throws | Alert: "Couldn't save that photo, please try again." No DB write. |
| No local `Profile` row | Avatar pressable is disabled (action sheet won't open). |
| 401 from server | Existing `fetchOpWithAuthRetry` handles silent refresh + one retry transparently. |
| Network / 5xx | Connector throws `UploadOpError`, PowerSync re-queues, sync event logged. Avatar stays on local URI until the queue drains. Self-heals on reconnect. |
| Permanent 4xx (size/type/ownership) | Mitigated by prevention: client-side 1024×1024/q=0.8/jpeg keeps payloads in the 200–500 KB range, well under the 10 MB server cap, with consistent mime. Residual failures loop in the queue. Out of scope to gracefully give up — same as classroom flow. |
| Multiple rapid changes | PowerSync processes ops in order; final state matches the last change. PATCHes are idempotent on retry. |
| Server-pushed conflict | PowerSync last-write-wins. The photo PATCH is the last client write, so it sticks. |
| Orphaned local files after sync | Local `file://` becomes unreferenced once the server URL arrives. Rely on existing attachment cache cleanup. A targeted sweeper is a follow-up if leakage is observed in practice. |

## Testing

No unit test infrastructure in this repo per project convention. This is a manual test plan to be executed against a dev backend (cloudflared tunnel — `*.shares.zrok.io` is known broken for multipart per project memory).

**Happy paths (run on both iOS sim and a physical Android)**

1. Profile screen → tap avatar → Choose from library → pick → native square crop → Done. Verify: avatar swaps immediately; Sync Center shows the PATCH op as `ok`; after cold restart the avatar still resolves from the server URL (not the local `file://`).
2. Same flow via Take photo.
3. Remove → confirm → avatar falls back to initials → Sync Center op `ok` → server `Profile.student_photo` is null → cold restart, still cleared.

**Offline & queue behaviour**

4. Airplane mode → pick photo → avatar swaps optimistically → Sync Center shows queued op → re-enable network → op drains → avatar transitions to server URL.
5. Airplane mode → pick photo → background + cold restart → avatar still shows local URI on launch; reconnect drains.
6. Rapid replace: pick A → before queue drains, pick B → only B ends up on the server.

**Permissions**

7. Fresh install (or revoked perms): tap avatar → Choose from library → deny prompt → action sheet displays the "Open Settings" affordance → tapping it deep-links to the OS settings screen.
8. Same for camera.

**Server-side sanity (via curl with a valid JWT, against the cloudflared dev tunnel)**

9. `PATCH /api/accounts_profile/<other_user_profile_id>/` → `404` (queryset filter, not 403).
10. `PATCH /api/accounts_profile/<own_id>/` with `student_photo=""` → field cleared.
11. `PATCH /api/accounts_profile/<own_id>/` with a 12 MB jpeg → `400` from `validate_image_file()`.

**Static checks**

12. `yarn tsc` clean.
13. Server test suite unchanged and green.

**Acceptance**

- All three action-sheet entries (Take photo / Choose from library / Remove) work end-to-end on both platforms.
- Avatar swaps optimistically on pick, persists across restarts, and resolves to the server URL after sync.
- No regressions in the classroom-submission upload flow (it shares the Connector).

## Open verification before implementation

1. Confirm the existing hand-written `path('/api/accounts_profile/<int:id>/', UserViewProfileView)` has no remaining consumers (grep both `client-mobile` and `classedge-mobile-test`). If it does, choose a non-colliding path for the new router.
2. Confirm `expo-camera` plugin configuration in `app.config.ts` covers `expo-image-picker`'s `launchCameraAsync` path, or add the necessary entry.
3. Confirm `accounts_profile` is marked as a locally-writable table in the PowerSync schema (so PowerSync queues an upload op for the UPDATE rather than silently dropping it).
4. Confirm `Profile.student_photo` accepts `null` at the model layer (it does per the scan: `null=True, blank=True`) so the Remove flow's `to_internal_value` rewrite of empty-string to `None` will persist.
