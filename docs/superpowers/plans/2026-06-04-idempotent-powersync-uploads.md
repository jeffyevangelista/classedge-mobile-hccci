# Idempotent PowerSync Uploads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No auto-commit:** Per user preference, this plan never stages or commits. After each task passes its tests, stop and let the user inspect/commit.

**Goal:** Stop the infinite-retry loop where PowerSync re-POSTs the same row after a partial-success and the server returns `IntegrityError: duplicate key value violates unique constraint "<table>_pkey"`. After this PR, retries are safe to replay.

**Architecture:** Switch the PowerSync `PUT` op (upsert) from `POST /<table>/` (create-only, non-idempotent) to `PUT /<table>/<local_id>/` (idempotent upsert). Add a shared Django mixin (`IdempotentLocalIdUpsertMixin`) that overrides DRF `update()` to fall through to create when the row doesn't exist for the current user, scoped by an explicit owner check. Close the pre-existing ownership gap on `ActivityStudentViewSet` in the same change so the new instance URL doesn't make it more exploitable. Fix the `RetakeRecordDetail.save()` duplicate-Attachment bug as part of the same PR because PUT replays would otherwise pile up Attachment rows.

**Tech Stack:**
- **Server repo:** `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test` — Django 5, DRF, Postgres, `cuid` for local IDs, `JWTAuthentication` for mobile.
- **Client repo:** `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile` — React Native + Expo Router, `@powersync/react-native` backend connector.

---

## Background (read before starting)

### The bug

1. Mobile client mutates a PowerSync-synced row locally (e.g. `activity_retakerecorddetail`).
2. PowerSync queues the mutation as a CRUD op with `op = PUT, id = <cuid>, opData = {…}`.
3. `powersync/Connector.ts` translates that to `POST https://…/api/activity_retakerecorddetail/` with JSON body.
4. Django routes that to `RetakeRecordDetailViewSet.create` → `perform_create` → `serializer.save(student=request.user)` → `super().create()` → INSERT.
5. If the **response is lost** (zrok hiccup, app backgrounded mid-flight, network drop) the server has inserted the row but PowerSync doesn't know.
6. PowerSync replays the same op. Step 4 re-runs. INSERT now violates the primary-key constraint on `local_id`. Server returns 500. PowerSync logs "Upload failed, will retry automatically" and replays again. Forever.

### Why `local_id` is the PK

Migration `activity/migrations/0036_swap_retake_pk.py` (raw SQL, `reverse_code=noop`) dropped the integer `id` column on `activity_retakerecord` and `activity_retakerecorddetail`, rewrote FK columns to point at `local_id`, and promoted `local_id` to PK. The same shape exists on `activity_studentactivity` and `activity_activity`. **Do not try to undo this in this PR.** A schema-level fix (surrogate PK + `UniqueConstraint(student, local_id)`) is the architecturally cleanest answer but is a separate, large project.

### Why the instance URL already exists

Because `local_id` is the Django PK, DRF's `DefaultRouter` already exposes `/api/<table>/<local_id>/` for retrieve/update/destroy. The bug is purely behavioral: the client sends `POST /<table>/` and the server's `update()` 404s when the row is missing. We're not changing URLs — we're changing which URL the client uses and what the server does when the row is missing.

### Files involved (read these before touching anything)

**Server:**
- `mobile/views/retake_record_views.py` — `RetakeRecordViewSet`, `RetakeRecordDetailViewSet`. Both already scope by user via `get_queryset` and force `student=request.user` in `perform_create`. `RetakeRecordDetailViewSet` runs `_regrade_chain` (auto-grader propagation) in `perform_create`/`perform_update`.
- `mobile/views/student_activity_views.py` — `ActivityStudentViewSet`. **No** user scoping. **No** owner enforcement. `student_id` is fully client-writable. This is a pre-existing auth gap that this PR must close.
- `mobile/serializers/retake_record.py` — `RetakeRecordSerializer`, `RetakeRecordDetailSerializer`. `_maybe_drop_local_id` gates client `local_id` behind `X-Platform: mobile` — keep this. `RetakeRecordDetailSerializer.to_internal_value` strips empty `uploaded_file` — keep this.
- `mobile/serializers/student_activity_serializers.py` — `StudentActivitySerializers` (plural — the writable one, distinct from `StudentActivitySerializer`). Today exposes `student_id`, `total_score`, `retake_count`, `is_editable` as writable.
- `activity/models/retake_models.py` — `RetakeRecord`, `RetakeRecordDetail`. The latter's `save()` creates an `Attachment` whenever `uploaded_file` changes, using a broken dedup check (`old_file != self.uploaded_file` compares `FieldFile` vs `UploadedFile`, never equal). Fix mirrors `StudentActivity.save`'s correct pattern.
- `activity/models/student_activity_model.py` — `StudentActivity.save` already uses `Attachment.objects.update_or_create(student_activity=self, defaults={'file': …})`. Reference for the fix.
- `mobile/models/attachment.py` — the `Attachment` model. Read-only context.
- `activity/services/auto_grader.py` — `grade_detail`, `recompute_retake_record_score`, `recompute_student_activity_total`. Used by `_regrade_chain`. Read-only context — do not modify in this PR.
- `mobile/urls.py` — DRF router registrations. **No changes** in this PR.
- `mobile/tests.py` — existing test file with serializer-level tests. New tests go in `mobile/tests/` as a package (see Task 1).

**Client:**
- `powersync/Connector.ts` — the `uploadData` method. Specifically the `case UpdateType.PUT` branch at line 186 and the URL construction at line 179. The PUT op currently POSTs to the collection URL; we'll change it to PUT to the instance URL.

### Out of scope (do not do these in this PR)

- Schema migration to demote `local_id` from PK to non-unique field with a composite `UniqueConstraint(student, local_id)`. Architecturally cleaner; large enough to warrant its own PR.
- Changes to `AttachmentViewSet` (keyed by `file_uuid`, not `local_id`; different upload semantics).
- Changes to `ActivityViewSet` (teacher-authored; mobile is read-only on this table per current product behavior).
- Removing the existing `POST /<table>/` create endpoints. They stay live so legacy in-flight ops from older client versions still work during rollout.
- Moving `_regrade_chain` from the view into `RetakeRecordDetail.save`. Tempting but introduces recursion-guard complexity because `grade_detail` calls `detail.save(update_fields=['score'])` from inside.

---

## File Structure

### Server repo (`/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test`)

| File | Action | Responsibility |
|------|--------|----------------|
| `mobile/views/_idempotent.py` | **Create** | The `IdempotentLocalIdUpsertMixin` — overrides DRF `update()` to upsert-when-missing, scoped to `request.user`, with allowlisted writable fields and forced owner. |
| `mobile/views/retake_record_views.py` | **Modify** | Apply mixin to `RetakeRecordViewSet` and `RetakeRecordDetailViewSet`. Add `perform_update` on `RetakeRecordViewSet` to re-force `student=request.user`. |
| `mobile/views/student_activity_views.py` | **Modify** | Apply mixin to `ActivityStudentViewSet`. Add `get_queryset` scoping. Add `perform_create`/`perform_update` to force `student=request.user`. |
| `mobile/serializers/student_activity_serializers.py` | **Modify** | Make `student_id` read-only (closes the pre-existing auth gap where client could spoof). |
| `activity/models/retake_models.py` | **Modify** | Replace broken `Attachment.create(...)` block in `RetakeRecordDetail.save` with the `update_or_create` pattern used by `StudentActivity.save`. |
| `mobile/tests/__init__.py` | **Create** (rename existing `tests.py`) | Promote `tests.py` to package so new test files coexist. |
| `mobile/tests/test_idempotent_upsert.py` | **Create** | Tests for the mixin behavior, applied across `RetakeRecord`, `RetakeRecordDetail`, `StudentActivity` viewsets. |
| `activity/tests/__init__.py` | **Create** (if missing) | Make `activity/tests/` a package. |
| `activity/tests/test_attachment_dedup.py` | **Create** | Tests for `RetakeRecordDetail.save` Attachment dedup fix. |

### Client repo (`/Users/jeffthedev/Desktop/classedge-hccci/client-mobile`)

| File | Action | Responsibility |
|------|--------|----------------|
| `powersync/Connector.ts` | **Modify** | Switch `UpdateType.PUT` branch from `POST /<table>/` to `PUT /<table>/<op.id>/`. Drop the `id: Number(op.id)` injection (the URL carries the key). |

---

## Task 1 — Server: promote `mobile/tests.py` to a package, scaffold new test file

**Repo:** Server (`/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test`)

**Why:** Django discovers tests at `<app>/tests.py` OR `<app>/tests/` — not both. The existing `mobile/tests.py` has serializer tests that must keep working. We need a `tests/` package so new files coexist.

**Files:**
- Rename: `mobile/tests.py` → `mobile/tests/__init__.py`
- Create: `mobile/tests/test_idempotent_upsert.py` (empty placeholder)
- Rename: `activity/tests.py` → `activity/tests/__init__.py` (if it exists; otherwise create the package)
- Create: `activity/tests/test_attachment_dedup.py` (empty placeholder)

- [ ] **Step 1: Check current state of test files**

Run:
```bash
ls /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/mobile/tests* 2>/dev/null
ls /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/activity/tests* 2>/dev/null
```

Note which exist as files vs directories.

- [ ] **Step 2: Promote `mobile/tests.py` to a package**

If `mobile/tests.py` exists as a file:
```bash
mkdir -p /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/mobile/tests
mv /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/mobile/tests.py \
   /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/mobile/tests/__init__.py
```

- [ ] **Step 3: Promote `activity/tests.py` to a package (if it exists)**

If `activity/tests.py` exists as a file:
```bash
mkdir -p /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/activity/tests
mv /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/activity/tests.py \
   /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/activity/tests/__init__.py
```

If it does not exist:
```bash
mkdir -p /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/activity/tests
touch /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test/activity/tests/__init__.py
```

- [ ] **Step 4: Verify existing tests still discovered**

Run from server repo root:
```bash
python manage.py test mobile.tests -v 2
```

Expected: existing `ActivitySerializerClientSuppliedLocalIdTests` (6 tests) still found and passing.

- [ ] **Step 5: Stop and report**

Report to the user: "Test packages promoted. Existing tests still pass. Ready for Task 2."

---

## Task 2 — Server: write failing tests for the mixin behavior (TDD red)

**Repo:** Server

**Why:** Pin the contract before writing the mixin. These tests use `RetakeRecordViewSet` as the host because it already has correct ownership scoping today, so test failures isolate to the mixin behavior we're adding.

**Files:**
- Create: `mobile/tests/test_idempotent_upsert.py`

- [ ] **Step 1: Write the test file**

Create `mobile/tests/test_idempotent_upsert.py` with:

```python
"""Tests for IdempotentLocalIdUpsertMixin via RetakeRecordViewSet.

The mixin must:
  1. Create a row when PUT hits an instance URL for a row that doesn't exist
     for this owner (the idempotent-replay case).
  2. Update a row when PUT hits an instance URL for a row that does exist
     for this owner (the normal update case).
  3. Strip non-writable fields (the allowlist).
  4. Force `student` to request.user (ignore any client-supplied student).
  5. Return 409 when PUT collides with a row owned by a different user
     (the deliberate cross-tenant case).
  6. Leave PATCH semantics alone — PATCH on a missing row still 404s.
"""
import cuid
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CustomUser
from activity.models import (
    Activity,
    RetakeRecord,
    StudentActivity,
)


def _make_user(email):
    return CustomUser.objects.create_user(email=email, password="pw12345!")


def _make_activity():
    return Activity.objects.create(activity_name="T1", local_id=cuid.cuid())


def _make_student_activity(student, activity):
    return StudentActivity.objects.create(
        student=student, activity=activity, local_id=cuid.cuid()
    )


class RetakeRecordUpsertTests(APITestCase):

    def setUp(self):
        self.alice = _make_user("alice@example.com")
        self.bob = _make_user("bob@example.com")
        self.activity = _make_activity()
        self.alice_sa = _make_student_activity(self.alice, self.activity)
        self.client.force_authenticate(user=self.alice)

    def _put(self, local_id, payload):
        return self.client.put(
            f"/api/activity_retakerecord/{local_id}/",
            data=payload,
            format="json",
            HTTP_X_PLATFORM="mobile",
        )

    def test_put_to_missing_row_creates_it(self):
        local_id = cuid.cuid()
        payload = {
            "student_activity_id": self.alice_sa.pk,
            "activity_id": self.activity.pk,
            "retake_number": 1,
            "duration": 0,
            "status": "ongoing",
        }
        res = self._put(local_id, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        rr = RetakeRecord.objects.get(pk=local_id)
        self.assertEqual(rr.student, self.alice)
        self.assertEqual(rr.retake_number, 1)

    def test_put_to_existing_row_updates_it(self):
        rr = RetakeRecord.objects.create(
            student=self.alice,
            student_activity=self.alice_sa,
            activity=self.activity,
            retake_number=1,
            status="ongoing",
            local_id=cuid.cuid(),
        )
        res = self._put(rr.pk, {
            "student_activity_id": self.alice_sa.pk,
            "activity_id": self.activity.pk,
            "retake_number": 1,
            "duration": 60,
            "status": "submitted",
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        rr.refresh_from_db()
        self.assertEqual(rr.duration, 60)
        self.assertEqual(rr.status, "submitted")

    def test_replay_after_partial_success_is_idempotent(self):
        """The bug this whole PR exists to fix.

        Simulate: first PUT succeeds (server inserts the row), second PUT with
        the same local_id arrives because the client never saw the response.
        Both must return success and end-state must be one row.
        """
        local_id = cuid.cuid()
        payload = {
            "student_activity_id": self.alice_sa.pk,
            "activity_id": self.activity.pk,
            "retake_number": 1,
            "duration": 0,
            "status": "ongoing",
        }
        res1 = self._put(local_id, payload)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        res2 = self._put(local_id, payload)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(RetakeRecord.objects.filter(pk=local_id).count(), 1)

    def test_put_ignores_client_supplied_student(self):
        """Client cannot reassign a row to another user via the body."""
        local_id = cuid.cuid()
        res = self._put(local_id, {
            "student_activity_id": self.alice_sa.pk,
            "activity_id": self.activity.pk,
            "retake_number": 1,
            "duration": 0,
            "status": "ongoing",
            "student": self.bob.pk,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        rr = RetakeRecord.objects.get(pk=local_id)
        self.assertEqual(rr.student, self.alice)

    def test_put_strips_score_from_client(self):
        """`score` is in the serializer fields today but is server-managed.
        The mixin's allowlist must drop it."""
        local_id = cuid.cuid()
        res = self._put(local_id, {
            "student_activity_id": self.alice_sa.pk,
            "activity_id": self.activity.pk,
            "retake_number": 1,
            "duration": 0,
            "status": "ongoing",
            "score": 999,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        rr = RetakeRecord.objects.get(pk=local_id)
        self.assertEqual(rr.score, 0)  # model default; not 999

    def test_put_cross_tenant_collision_returns_409(self):
        """If a row with the same local_id exists under a different user,
        the create fallback hits the PK constraint. Return 409, not idempotent
        200 (because no row was actually saved for this user)."""
        bob_sa = _make_student_activity(self.bob, self.activity)
        existing = RetakeRecord.objects.create(
            student=self.bob,
            student_activity=bob_sa,
            activity=self.activity,
            retake_number=1,
            status="ongoing",
            local_id=cuid.cuid(),
        )
        # Alice tries to PUT to the same local_id
        res = self._put(existing.pk, {
            "student_activity_id": self.alice_sa.pk,
            "activity_id": self.activity.pk,
            "retake_number": 1,
            "duration": 0,
            "status": "ongoing",
        })
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        # Bob's row is untouched
        existing.refresh_from_db()
        self.assertEqual(existing.student, self.bob)

    def test_patch_missing_row_still_404s(self):
        """PATCH semantics are unchanged: PATCH does not create."""
        local_id = cuid.cuid()
        res = self.client.patch(
            f"/api/activity_retakerecord/{local_id}/",
            data={"duration": 60},
            format="json",
            HTTP_X_PLATFORM="mobile",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run from server repo root:
```bash
python manage.py test mobile.tests.test_idempotent_upsert -v 2
```

Expected: most tests fail. Likely failure modes:
- `test_put_to_missing_row_creates_it` → 404 (current `update()` 404s on missing row)
- `test_put_to_existing_row_updates_it` → may pass already (existing PATCH-style update on existing row works through DRF)
- `test_replay_after_partial_success_is_idempotent` → 404 on the first PUT (no row exists yet)
- `test_put_ignores_client_supplied_student` → fails before assertion (first PUT 404s)
- `test_put_strips_score_from_client` → fails before assertion (first PUT 404s)
- `test_put_cross_tenant_collision_returns_409` → 404 (Alice's get_queryset doesn't see Bob's row)
- `test_patch_missing_row_still_404s` → should already PASS

Record which tests pass vs fail. Continue regardless.

- [ ] **Step 3: Stop and report**

Report: "Mixin tests written. N/7 currently failing as expected. Ready for Task 3 (implement mixin)."

---

## Task 3 — Server: implement `IdempotentLocalIdUpsertMixin`

**Repo:** Server

**Why:** This is the core abstraction. One file, one class, reused across three viewsets in later tasks.

**Files:**
- Create: `mobile/views/_idempotent.py`

- [ ] **Step 1: Write the mixin**

Create `mobile/views/_idempotent.py`:

```python
"""Idempotent upsert mixin for PowerSync-synced viewsets.

PowerSync's CRUD upload protocol replays the same op until it gets a 2xx
response. The default DRF ModelViewSet pattern — POST to the collection URL
for create — is not safe to replay: a partial-success (server inserted, client
lost the response) means the next replay hits a PK unique-violation and 500s
forever.

This mixin makes PUT to /<table>/<local_id>/ behave as an upsert scoped to the
authenticated user:

  * If the row exists for request.user → partial-update.
  * If the row is missing for request.user → create it, forcing the owner.
  * If the create fallback hits the PK constraint because another user owns
    that local_id → return 409 (NOT 200; we don't want the client to drop the
    op believing it succeeded).
  * Only fields listed in CLIENT_WRITABLE_FIELDS pass through to the
    serializer. Server-authoritative fields (score, total_score, retake_count,
    is_editable, etc.) are dropped at the view layer.

PATCH semantics are intentionally untouched: PATCH on a missing row still
returns 404. PowerSync only emits PATCH ops for known-existing rows, so this
asymmetry is fine.

Usage:

    class FooViewSet(IdempotentLocalIdUpsertMixin, ModelViewSet):
        CLIENT_WRITABLE_FIELDS = {"bar", "baz", "local_id"}
        # ... existing perform_create that forces student=request.user
"""
from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response


class IdempotentLocalIdUpsertMixin:
    OWNER_FIELD = "student"
    OWNER_ID_FIELD = "student_id"
    CLIENT_WRITABLE_FIELDS: set = set()

    def _filtered_data(self, request):
        data = {
            k: v
            for k, v in request.data.items()
            if k in self.CLIENT_WRITABLE_FIELDS
        }
        # Owner is enforced server-side. Strip any client-supplied owner field
        # so a malicious payload can't reassign the row to a different user.
        data.pop(self.OWNER_FIELD, None)
        data.pop(self.OWNER_ID_FIELD, None)
        return data

    def update(self, request, *args, **kwargs):
        local_id = self.kwargs[self.lookup_field]
        data = self._filtered_data(request)

        qs = self.get_queryset()
        try:
            instance = qs.get(pk=local_id)
        except qs.model.DoesNotExist:
            # Fall through to create. The URL carries the local_id, so we
            # inject it into the payload before validation. perform_create
            # is expected to force the owner (e.g. student=request.user).
            create_data = {**data, "local_id": local_id}
            serializer = self.get_serializer(data=create_data)
            serializer.is_valid(raise_exception=True)
            try:
                self.perform_create(serializer)
            except IntegrityError:
                return Response(
                    {"detail": "local_id already in use by another owner"},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # PATCH is left to the parent ModelViewSet implementation on purpose:
    # PATCH on a missing row should 404, not create. PowerSync emits PATCH
    # ops only for rows the local DB believes already exist on the server.
```

- [ ] **Step 2: Run the mixin tests — they should still fail (mixin not wired yet)**

Run from server repo root:
```bash
python manage.py test mobile.tests.test_idempotent_upsert -v 2
```

Expected: same failures as Task 2 step 2. The mixin exists but no viewset uses it yet.

- [ ] **Step 3: Stop and report**

Report: "Mixin implemented at `mobile/views/_idempotent.py`. Not yet wired into any viewset. Ready for Task 4."

---

## Task 4 — Server: wire mixin into `RetakeRecordViewSet`

**Repo:** Server

**Why:** Makes the Task 2 tests pass. Smallest possible scope — one viewset, no auth changes (already correct).

**Files:**
- Modify: `mobile/views/retake_record_views.py`

- [ ] **Step 1: Apply mixin to `RetakeRecordViewSet`**

Edit `mobile/views/retake_record_views.py`. At the top of the file, after the existing imports, add:

```python
from mobile.views._idempotent import IdempotentLocalIdUpsertMixin
```

Then change the `RetakeRecordViewSet` class declaration from:

```python
class RetakeRecordViewSet(ModelViewSet):
    """CRUD operations for RetakeRecord objects scoped to the authenticated student."""

    serializer_class = RetakeRecordSerializer
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]
```

To:

```python
class RetakeRecordViewSet(IdempotentLocalIdUpsertMixin, ModelViewSet):
    """CRUD operations for RetakeRecord objects scoped to the authenticated student.

    PUT to /api/activity_retakerecord/<local_id>/ is idempotent: missing rows
    are created, existing rows are partial-updated. See IdempotentLocalIdUpsertMixin.
    """

    serializer_class = RetakeRecordSerializer
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    CLIENT_WRITABLE_FIELDS = {
        "student_activity_id",
        "activity_id",
        "retake_number",
        "duration",
        "status",
        "started_at",
        "will_end_at",
        "local_id",
        "question_order",
        "last_index",
        "last_heartbeat_at",
        "total_elapsed_seconds",
    }
    # NOT writable: student (forced by perform_create / perform_update),
    # score (currently in serializer fields but server-managed via regrade
    # chain on RetakeRecordDetail; never set directly from client),
    # retake_time (auto_now_add).
```

- [ ] **Step 2: Add `perform_update` to re-force owner on update**

In the same file, add inside `RetakeRecordViewSet` (next to the existing `perform_create`):

```python
    def perform_update(self, serializer):
        # Re-force owner on update. Without this, a malicious client could
        # PUT a payload with a different `student` value and reassign the row
        # within their own queryset scope. The mixin already strips `student`
        # from the body, but this is a belt-and-suspenders guarantee.
        print(
            f"Updating RetakeRecord via API for user={self.request.user.id}"
        )
        serializer.save(student=self.request.user)
```

- [ ] **Step 3: Run the mixin tests**

Run from server repo root:
```bash
python manage.py test mobile.tests.test_idempotent_upsert -v 2
```

Expected: All 7 tests PASS.

If any fail, read the failure carefully:
- 500 with `IntegrityError` on `test_put_cross_tenant_collision_returns_409` → the `try/except IntegrityError` in the mixin isn't catching; check that `perform_create` is being called inside the `try` block.
- 400 validation error on creation tests → the serializer is rejecting a missing field. The fixture payload may need adjustment, or the serializer `required=True` field needs to be on the allowlist.
- 404 still on creation tests → the mixin's `update()` override isn't being invoked; confirm the mixin is first in the MRO (left of `ModelViewSet`).

- [ ] **Step 4: Run the full mobile test suite to confirm no regression**

```bash
python manage.py test mobile -v 2
```

Expected: existing serializer tests still pass + 7 new tests pass.

- [ ] **Step 5: Stop and report**

Report: "RetakeRecordViewSet now upserts on PUT. 7/7 mixin tests passing. Existing tests untouched. Ready for Task 5."

---

## Task 5 — Server: wire mixin into `RetakeRecordDetailViewSet`

**Repo:** Server

**Why:** The original bug report was on `activity_retakerecorddetail`. This task wires the mixin and adds a regression test that confirms `_regrade_chain` still fires on the upsert-create path.

**Files:**
- Modify: `mobile/views/retake_record_views.py`
- Modify: `mobile/tests/test_idempotent_upsert.py` (add detail-specific test)

- [ ] **Step 1: Write a failing test for RetakeRecordDetail upsert + regrade chain**

Append to `mobile/tests/test_idempotent_upsert.py`:

```python
from activity.models import (
    ActivityQuestion,
    QuizType,
    RetakeRecordDetail,
)


class RetakeRecordDetailUpsertTests(APITestCase):

    def setUp(self):
        self.alice = _make_user("alice_d@example.com")
        self.activity = _make_activity()
        self.alice_sa = _make_student_activity(self.alice, self.activity)
        self.rr = RetakeRecord.objects.create(
            student=self.alice,
            student_activity=self.alice_sa,
            activity=self.activity,
            retake_number=1,
            status="ongoing",
            local_id=cuid.cuid(),
        )
        # Minimal question with a known correct answer so grade_detail
        # has something to compute against.
        qtype, _ = QuizType.objects.get_or_create(name="Identification")
        self.question = ActivityQuestion.objects.create(
            activity=self.activity,
            quiz_type=qtype,
            question_text="2+2?",
            correct_answer="4",
            score=10,
        )
        self.client.force_authenticate(user=self.alice)

    def _put(self, local_id, payload):
        return self.client.put(
            f"/api/activity_retakerecorddetail/{local_id}/",
            data=payload,
            format="json",
            HTTP_X_PLATFORM="mobile",
        )

    def test_put_to_missing_detail_creates_and_grades(self):
        local_id = cuid.cuid()
        res = self._put(local_id, {
            "retake_record_id": self.rr.pk,
            "activity_question_id": self.question.pk,
            "student_answer": "4",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        detail = RetakeRecordDetail.objects.get(pk=local_id)
        # _regrade_chain should have set score from grade_detail's correct answer.
        self.assertEqual(detail.score, 10)

    def test_replay_does_not_lose_grade(self):
        local_id = cuid.cuid()
        payload = {
            "retake_record_id": self.rr.pk,
            "activity_question_id": self.question.pk,
            "student_answer": "4",
        }
        res1 = self._put(local_id, payload)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        res2 = self._put(local_id, payload)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        detail = RetakeRecordDetail.objects.get(pk=local_id)
        self.assertEqual(detail.score, 10)
        self.assertEqual(
            RetakeRecordDetail.objects.filter(pk=local_id).count(), 1
        )
```

- [ ] **Step 2: Run the new tests — expect failure**

```bash
python manage.py test mobile.tests.test_idempotent_upsert.RetakeRecordDetailUpsertTests -v 2
```

Expected: both tests fail with 404 (mixin not wired into detail viewset yet).

- [ ] **Step 3: Wire the mixin into `RetakeRecordDetailViewSet`**

In `mobile/views/retake_record_views.py`, change the `RetakeRecordDetailViewSet` class declaration from:

```python
class RetakeRecordDetailViewSet(ModelViewSet):
    """CRUD operations for RetakeRecordDetail objects scoped to the authenticated student."""
    serializer_class = RetakeRecordDetailSerializer
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]
```

To:

```python
class RetakeRecordDetailViewSet(IdempotentLocalIdUpsertMixin, ModelViewSet):
    """CRUD operations for RetakeRecordDetail objects scoped to the authenticated student.

    PUT to /api/activity_retakerecorddetail/<local_id>/ is idempotent. The
    existing _regrade_chain is invoked on both perform_create (upsert-create
    path) and perform_update (upsert-update path), so auto-grading stays
    consistent across both flows.
    """
    serializer_class = RetakeRecordDetailSerializer
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    CLIENT_WRITABLE_FIELDS = {
        "retake_record_id",
        "activity_question_id",
        "student_answer",
        "uploaded_file",
        "local_id",
    }
    # NOT writable: student (forced by perform_create; not in serializer
    # fields so already safe on update), score (auto-graded by _regrade_chain),
    # submission_time (server-managed; not in serializer fields).
```

- [ ] **Step 4: Run the new tests — expect pass**

```bash
python manage.py test mobile.tests.test_idempotent_upsert.RetakeRecordDetailUpsertTests -v 2
```

Expected: both tests PASS.

If `test_put_to_missing_detail_creates_and_grades` returns 201 but `detail.score == 0` instead of 10, `_regrade_chain` was not invoked on the create path. Verify that `perform_create` in the existing class still calls `self._regrade_chain(detail)` — the mixin does not override `perform_create`, so this should work as-is.

- [ ] **Step 5: Run the full mobile test suite**

```bash
python manage.py test mobile -v 2
```

Expected: all tests pass.

- [ ] **Step 6: Stop and report**

Report: "RetakeRecordDetailViewSet now upserts on PUT. Regrade chain fires on both create and update paths. Ready for Task 6 (close StudentActivity auth gap)."

---

## Task 6 — Server: close `StudentActivity` auth gap (security fix bundled with idempotency)

**Repo:** Server

**Why:** `ActivityStudentViewSet` has no `get_queryset` scoping, no `perform_create` owner forcing, and the serializer accepts `student_id` from the client. Wiring the mixin onto an instance URL without fixing this would make cross-tenant overwrites trivially callable. Must ship in the same PR.

**Files:**
- Modify: `mobile/serializers/student_activity_serializers.py`
- Modify: `mobile/views/student_activity_views.py`
- Modify: `mobile/tests/test_idempotent_upsert.py` (add StudentActivity tests)

- [ ] **Step 1: Write failing tests for StudentActivity ownership + upsert**

Append to `mobile/tests/test_idempotent_upsert.py`:

```python
from course.models import Term
from subject.models import Subject


class StudentActivityUpsertTests(APITestCase):

    def setUp(self):
        self.alice = _make_user("alice_sa@example.com")
        self.bob = _make_user("bob_sa@example.com")
        self.activity = _make_activity()
        self.term = Term.objects.create(
            term_name="T1", start_date="2026-01-01", end_date="2026-06-01"
        )
        self.subject = Subject.objects.create(subject_name="Math")
        self.client.force_authenticate(user=self.alice)

    def _put(self, local_id, payload):
        return self.client.put(
            f"/api/activity_studentactivity/{local_id}/",
            data=payload,
            format="json",
            HTTP_X_PLATFORM="mobile",
        )

    def test_put_creates_studentactivity_owned_by_request_user(self):
        local_id = cuid.cuid()
        res = self._put(local_id, {
            "activity_id": self.activity.pk,
            "term_id": self.term.pk,
            "subject_id": self.subject.pk,
            "student_id": self.bob.pk,  # ATTEMPT TO SPOOF
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        sa = StudentActivity.objects.get(pk=local_id)
        self.assertEqual(sa.student, self.alice)  # NOT Bob

    def test_put_drops_server_authoritative_fields(self):
        local_id = cuid.cuid()
        res = self._put(local_id, {
            "activity_id": self.activity.pk,
            "term_id": self.term.pk,
            "subject_id": self.subject.pk,
            "total_score": 9999,
            "retake_count": 42,
            "is_editable": True,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        sa = StudentActivity.objects.get(pk=local_id)
        self.assertIsNone(sa.total_score)  # server-managed; not set from body
        self.assertEqual(sa.retake_count, 0)
        self.assertFalse(sa.is_editable)

    def test_put_cannot_overwrite_another_users_row(self):
        bobs_sa = StudentActivity.objects.create(
            student=self.bob, activity=self.activity, local_id=cuid.cuid()
        )
        res = self._put(bobs_sa.pk, {
            "activity_id": self.activity.pk,
            "term_id": self.term.pk,
            "subject_id": self.subject.pk,
        })
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        bobs_sa.refresh_from_db()
        self.assertEqual(bobs_sa.student, self.bob)

    def test_list_only_returns_own_rows(self):
        """get_queryset scoping must apply to list as well as detail."""
        StudentActivity.objects.create(
            student=self.alice, activity=self.activity, local_id=cuid.cuid()
        )
        StudentActivity.objects.create(
            student=self.bob, activity=self.activity, local_id=cuid.cuid()
        )
        res = self.client.get("/api/activity_studentactivity/")
        self.assertEqual(res.status_code, 200)
        # response data is a list of dicts (or paginated; depending on
        # repo's DRF pagination settings — adjust if needed)
        results = res.data if isinstance(res.data, list) else res.data.get("results", res.data)
        for row in results:
            owner = row.get("student_id", row.get("student"))
            self.assertEqual(owner, self.alice.pk)
```

- [ ] **Step 2: Run the new tests — expect failure**

```bash
python manage.py test mobile.tests.test_idempotent_upsert.StudentActivityUpsertTests -v 2
```

Expected: most fail. Likely failure modes:
- `test_put_creates_studentactivity_owned_by_request_user` → `sa.student == self.bob` (the spoof succeeds today).
- `test_put_drops_server_authoritative_fields` → `total_score == 9999` (allowlist not yet enforced).
- `test_put_cannot_overwrite_another_users_row` → may return 200 (Alice overwrites Bob's row) — this is the current security hole.
- `test_list_only_returns_own_rows` → fails; returns both rows.

- [ ] **Step 3: Make `student_id` read-only in the serializer**

Edit `mobile/serializers/student_activity_serializers.py`. Change:

```python
class StudentActivitySerializers(serializers.ModelSerializer):
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(), source='student'
    )
```

To:

```python
class StudentActivitySerializers(serializers.ModelSerializer):
    student_id = serializers.PrimaryKeyRelatedField(
        read_only=True, source='student'
    )
```

Rationale: `student` is determined by the server from `request.user`. A read-only `student_id` keeps it in the response payload (clients may want it for display) but rejects any client write attempt.

Also remove `student_id` from the `create` override's `validated_data` handling — the `read_only=True` change means it won't appear in `validated_data` anyway, so no further serializer change is needed.

- [ ] **Step 4: Apply mixin + add scoping/perform_create/perform_update to the viewset**

Edit `mobile/views/student_activity_views.py`. At the top, after existing imports, add:

```python
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from mobile.views._idempotent import IdempotentLocalIdUpsertMixin
```

(Confirm `IsAuthenticated` and `SessionAuthentication` are already imported in the file. If they are, do not duplicate.)

Then change the `ActivityStudentViewSet` class declaration. Replace the entire current class body (which is mostly print-wrapping overrides) with:

```python
class ActivityStudentViewSet(IdempotentLocalIdUpsertMixin, ModelViewSet):
    """CRUD for StudentActivity, scoped to the authenticated student.

    PUT to /api/activity_studentactivity/<local_id>/ is idempotent. Ownership
    is enforced via get_queryset filtering AND a forced owner in
    perform_create / perform_update, so the body's `student_id` (now
    read-only in the serializer) cannot override the authenticated user.
    """
    serializer_class = StudentActivitySerializers
    search_fields = ['name']
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    CLIENT_WRITABLE_FIELDS = {
        "activity_id",
        "term_id",
        "subject_id",
        "file",
        "local_id",
        "activity_local_id",
    }
    # NOT writable: student_id (now read-only in serializer; mixin also strips),
    # total_score (recomputed by recompute_student_activity_total),
    # retake_count (incremented in ActivityBatchSubmitView),
    # is_editable (teacher/registrar-controlled per model help_text),
    # attendance_mode (teacher-controlled; not in serializer fields).

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return StudentActivity.objects.none()
        return StudentActivity.objects.filter(student=user)

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)

    def perform_update(self, serializer):
        serializer.save(student=self.request.user)
```

- [ ] **Step 5: Run the new tests — expect pass**

```bash
python manage.py test mobile.tests.test_idempotent_upsert.StudentActivityUpsertTests -v 2
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Run the entire test suite to check for regressions**

```bash
python manage.py test -v 2
```

Expected: existing tests pass + all new tests pass.

If `ActivityBatchSubmitView` or other code that reads/writes StudentActivity now fails due to ownership scoping, investigate — those flows authenticate as the student so they should still work. If a teacher/admin flow breaks, the queryset scope is too tight; consider exposing a separate viewset for non-student callers.

- [ ] **Step 7: Stop and report**

Report: "StudentActivity auth gap closed. ActivityStudentViewSet now ownership-scoped + idempotent on PUT. Full test suite passing. Ready for Task 7."

---

## Task 7 — Server: fix `RetakeRecordDetail.save` duplicate-Attachment bug

**Repo:** Server

**Why:** The existing `RetakeRecordDetail.save` dedup compares `old_file` (a `FieldFile`) against `self.uploaded_file` (an `UploadedFile` during update). They're never equal, so every update with a file creates a duplicate Attachment row. PUT replays would multiply this. Fix mirrors the correct `update_or_create` pattern already in `StudentActivity.save`.

**Files:**
- Modify: `activity/models/retake_models.py`
- Create: `activity/tests/test_attachment_dedup.py`

- [ ] **Step 1: Write the failing test**

Create `activity/tests/test_attachment_dedup.py`:

```python
"""Regression: RetakeRecordDetail.save must not create duplicate Attachments.

The pre-fix code created a new Attachment every time a record was saved with
an uploaded_file, because the dedup check (old_file != self.uploaded_file)
compared types that are never equal. Under PUT replays this would produce
N attachments for one logical upload.

The fix uses Attachment.objects.update_or_create(record_details=self, ...),
mirroring StudentActivity.save.
"""
import cuid
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from accounts.models import CustomUser
from activity.models import (
    Activity,
    RetakeRecord,
    RetakeRecordDetail,
    StudentActivity,
)
from mobile.models import Attachment


class RetakeRecordDetailAttachmentDedupTests(TestCase):

    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="dedup@example.com", password="pw12345!"
        )
        self.activity = Activity.objects.create(
            activity_name="A", local_id=cuid.cuid()
        )
        self.sa = StudentActivity.objects.create(
            student=self.user, activity=self.activity, local_id=cuid.cuid()
        )
        self.rr = RetakeRecord.objects.create(
            student=self.user,
            student_activity=self.sa,
            activity=self.activity,
            retake_number=1,
            status="ongoing",
            local_id=cuid.cuid(),
        )

    def _upload(self, name, content=b"hello"):
        return SimpleUploadedFile(name, content, content_type="image/png")

    def test_save_with_file_creates_one_attachment(self):
        detail = RetakeRecordDetail.objects.create(
            retake_record=self.rr,
            student=self.user,
            student_answer="x",
            uploaded_file=self._upload("a.png"),
            local_id=cuid.cuid(),
        )
        self.assertEqual(
            Attachment.objects.filter(record_details=detail).count(), 1
        )

    def test_subsequent_save_with_same_file_does_not_duplicate(self):
        detail = RetakeRecordDetail.objects.create(
            retake_record=self.rr,
            student=self.user,
            student_answer="x",
            uploaded_file=self._upload("a.png"),
            local_id=cuid.cuid(),
        )
        # Re-save (simulating a PUT replay updating other fields)
        detail.student_answer = "y"
        detail.save()
        self.assertEqual(
            Attachment.objects.filter(record_details=detail).count(), 1
        )

    def test_save_with_changed_file_updates_attachment_in_place(self):
        detail = RetakeRecordDetail.objects.create(
            retake_record=self.rr,
            student=self.user,
            student_answer="x",
            uploaded_file=self._upload("a.png"),
            local_id=cuid.cuid(),
        )
        old_count = Attachment.objects.filter(record_details=detail).count()
        detail.uploaded_file = self._upload("b.png")
        detail.save()
        self.assertEqual(
            Attachment.objects.filter(record_details=detail).count(),
            old_count,  # still 1, updated in place
        )
```

- [ ] **Step 2: Run the new tests — expect failure**

```bash
python manage.py test activity.tests.test_attachment_dedup -v 2
```

Expected:
- `test_save_with_file_creates_one_attachment` → PASS (initial create is fine).
- `test_subsequent_save_with_same_file_does_not_duplicate` → FAIL (count == 2).
- `test_save_with_changed_file_updates_attachment_in_place` → FAIL (count == 2).

- [ ] **Step 3: Fix `RetakeRecordDetail.save`**

Edit `activity/models/retake_models.py`. Replace the existing `save` method body (lines 72–107 in the current file, starting with `if not self.local_id:` through the end of the conditional Attachment.create block):

```python
    def save(self, *args, **kwargs):
        if not self.local_id:
            self.local_id = cuid.cuid()

        is_new = self.pk is None
        old_file = None

        if not is_new:
            try:
                old_detail = RetakeRecordDetail.objects.get(pk=self.pk)
                old_file = old_detail.uploaded_file
            except RetakeRecordDetail.DoesNotExist:
                old_file = None

        print(
            f"[RetakeRecordDetail.save] pk={self.pk} is_new={is_new} "
            f"retake_record_id={self.retake_record_id} student_id={self.student_id} "
            f"activity_question_id={self.activity_question_id} "
            f"student_answer={self.student_answer!r} score={self.score} "
            f"uploaded_file={self.uploaded_file} old_file={old_file}"
        )

        super().save(*args, **kwargs)

        print(f"[RetakeRecordDetail.save] saved pk={self.pk}")

        if self.uploaded_file and (is_new or old_file != self.uploaded_file):
            from mobile.models import Attachment
            attachment = Attachment.objects.create(
                record_details=self,
                file=self.uploaded_file
            )
            print(
                f"[RetakeRecordDetail.save] created Attachment pk={attachment.pk} "
                f"for record_details={self.pk} file={self.uploaded_file}"
            )
```

With:

```python
    def save(self, *args, **kwargs):
        if not self.local_id:
            self.local_id = cuid.cuid()

        print(
            f"[RetakeRecordDetail.save] pk={self.pk} "
            f"retake_record_id={self.retake_record_id} student_id={self.student_id} "
            f"activity_question_id={self.activity_question_id} "
            f"student_answer={self.student_answer!r} score={self.score} "
            f"uploaded_file={self.uploaded_file}"
        )

        super().save(*args, **kwargs)

        print(f"[RetakeRecordDetail.save] saved pk={self.pk}")

        # Mirror the StudentActivity.save pattern: one Attachment per
        # record_details FK, updated in place if the file changes. This
        # makes PUT replays idempotent against duplicate Attachment rows.
        if self.uploaded_file:
            from mobile.models import Attachment
            Attachment.objects.update_or_create(
                record_details=self,
                defaults={"file": self.uploaded_file},
            )
```

- [ ] **Step 4: Run the dedup tests — expect pass**

```bash
python manage.py test activity.tests.test_attachment_dedup -v 2
```

Expected: all 3 PASS.

- [ ] **Step 5: Run the regrade chain tests again to confirm no regression**

```bash
python manage.py test mobile.tests.test_idempotent_upsert.RetakeRecordDetailUpsertTests -v 2
```

Expected: still PASS. The `_regrade_chain` calls `detail.save(update_fields=['score'])` from inside `grade_detail` — since `update_fields` excludes `uploaded_file`, the Attachment branch shouldn't fire during regrade. Confirm.

- [ ] **Step 6: Run the full test suite**

```bash
python manage.py test -v 2
```

Expected: everything passes.

- [ ] **Step 7: Stop and report**

Report: "RetakeRecordDetail Attachment dedup fixed. 3/3 dedup tests pass; existing tests untouched. Server work complete. Ready for Task 8 (client)."

---

## Task 8 — Client: switch `Connector.ts` PUT op to HTTP PUT against instance URL

**Repo:** Client (`/Users/jeffthedev/Desktop/classedge-hccci/client-mobile`)

**Why:** The bug-fix cutover. Server now accepts both `POST /<table>/` (legacy) and `PUT /<table>/<local_id>/` (idempotent). This task moves the client to the new path.

**Files:**
- Modify: `powersync/Connector.ts`

- [ ] **Step 1: Update the `UpdateType.PUT` branch**

Edit `powersync/Connector.ts`. In `uploadData`, three changes:

1. The `record` construction (currently at line 168) drops `id: Number(op.id)` — the URL carries the key, and `Number()` on a cuid string is `NaN`.
2. The console log's `url` calculation uses the instance URL for PUT too.
3. The `case UpdateType.PUT` branch (currently at lines 186–220) sends HTTP `PUT` to the instance URL.

Replace the block at lines 168–183:

```typescript
        const record = { ...op.opData, id: Number(op.id) };
        const hasFile = await hasLocalFile(record);
        const fileFields = Object.entries(record)
          .filter(([, v]) => isLocalFileUri(v))
          .map(([k, v]) => ({ field: k, uri: v }));
        console.log("[Connector] op:", {
          op: op.op,
          table: op.table,
          id: op.id,
          hasFile,
          fileFields,
          url:
            op.op === UpdateType.PUT
              ? `${env.EXPO_PUBLIC_API_URL}/${op.table}/`
              : `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`,
        });
```

With:

```typescript
        // op.id is the PowerSync row id (the client cuid). The server uses
        // it as the local_id PK. Carry it in the URL, NOT the body — that's
        // what makes PUT replays idempotent.
        const record = { ...op.opData };
        const instanceUrl = `${env.EXPO_PUBLIC_API_URL}/${op.table}/${op.id}/`;
        const hasFile = await hasLocalFile(record);
        const fileFields = Object.entries(record)
          .filter(([, v]) => isLocalFileUri(v))
          .map(([k, v]) => ({ field: k, uri: v }));
        console.log("[Connector] op:", {
          op: op.op,
          table: op.table,
          id: op.id,
          hasFile,
          fileFields,
          url: instanceUrl,
        });
```

Then replace the `case UpdateType.PUT` block at lines 186–220:

```typescript
          case UpdateType.PUT:
            if (hasFile) {
              // Accept: application/json forces DRF to render errors as JSON
              // instead of the browsable-API HTML page. Without it, a 403/400
              // on multipart comes back as an HTML body that's impossible to
              // act on. Content-Type is intentionally NOT set so fetch can
              // generate the multipart boundary itself.
              const multipartHeaders: Record<string, string> = {
                Accept: "application/json",
                "X-Platform": "mobile",
              };
              if (accessToken)
                multipartHeaders.Authorization = `Bearer ${accessToken}`;

              await fetchAndLog(
                `PUT-multipart ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/`,
                {
                  method: "POST",
                  headers: multipartHeaders,
                  body: buildMultipartBody(record),
                },
              );
            } else {
              await fetchAndLog(
                `PUT-json ${op.table} ${op.id}`,
                `${env.EXPO_PUBLIC_API_URL}/${op.table}/`,
                {
                  method: "POST",
                  headers,
                  body: JSON.stringify(record),
                },
              );
            }
            break;
```

With:

```typescript
          case UpdateType.PUT:
            if (hasFile) {
              const multipartHeaders: Record<string, string> = {
                Accept: "application/json",
                "X-Platform": "mobile",
              };
              if (accessToken)
                multipartHeaders.Authorization = `Bearer ${accessToken}`;

              await fetchAndLog(
                `PUT-multipart ${op.table} ${op.id}`,
                instanceUrl,
                {
                  method: "PUT",
                  headers: multipartHeaders,
                  body: buildMultipartBody(record),
                },
              );
            } else {
              await fetchAndLog(
                `PUT-json ${op.table} ${op.id}`,
                instanceUrl,
                {
                  method: "PUT",
                  headers,
                  body: JSON.stringify(record),
                },
              );
            }
            break;
```

The PATCH and DELETE branches need no changes — they already hit `${instanceUrl}` (constructed inline). Optionally factor them to use the new `instanceUrl` constant for consistency, but not required.

- [ ] **Step 2: Type-check the client**

Run from client repo root:
```bash
cd /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
npx tsc --noEmit
```

Expected: no TypeScript errors.

If errors appear about `record.id` being referenced elsewhere, search the file:
```bash
grep -n "record\.id" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/powersync/Connector.ts
```
Should return no matches.

- [ ] **Step 3: Stop and report**

Report: "Connector PUT op now sends HTTP PUT to instance URL. TypeScript clean. Ready for Task 9 (manual smoke test)."

---

## Task 9 — Manual smoke test: end-to-end round trip

**Repo:** Both

**Why:** The connector is hard to unit-test in isolation (it depends on PowerSync's CRUD queue and a live backend). A focused manual round-trip is the cheapest way to confirm the fix.

- [ ] **Step 1: Start the server**

In the server repo:
```bash
cd /Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test
python manage.py runserver
```

Confirm the dev server is reachable at the URL the mobile app's `EXPO_PUBLIC_API_URL` points to (zrok tunnel or local IP). If the app currently points at `https://3tnhafmtf8j8.share.zrok.io`, either point the app at localhost for the test, or restart zrok to forward to this server.

- [ ] **Step 2: Start the mobile app**

In the client repo:
```bash
cd /Users/jeffthedev/Desktop/classedge-hccci/client-mobile
npx expo start
```

Open the app on a device or simulator. Sign in as a test student.

- [ ] **Step 3: Trigger an assessment attempt that produces RetakeRecordDetail rows**

Open any assessment. Answer at least one question. Submit. Watch the Metro logs.

Expected logs (no errors):
```
[Connector] op: { op: 1, table: 'activity_retakerecorddetail', id: '<cuid>', ..., url: '.../api/activity_retakerecorddetail/<cuid>/' }
[Connector] response: { ..., status: 201 or 200, ok: true, ... }
```

The first response will be `201 Created`. Subsequent uploads of the same row (e.g. if the user edits and re-submits) will be `200 OK`. **No 500 errors. No "Upload failed, will retry automatically" messages.**

- [ ] **Step 4: Simulate the original bug — force a partial-success replay**

This is the load-bearing test. To reproduce:

1. Put the app in airplane mode.
2. Answer a question (the row is queued locally).
3. Turn airplane mode off.
4. Watch Metro logs as PowerSync drains the queue.
5. After the first PUT succeeds in the logs, **kill the dev server** before the response reaches the device.
6. Wait for PowerSync's retry. Restart the server.
7. The retry should hit the instance URL, find the row already exists, return `200`, and PowerSync should mark the op done.

Confirm: the upload queue empties. No infinite-retry loop. No 500s.

- [ ] **Step 5: Verify the DB state on the server**

In a Django shell:
```bash
python manage.py shell
```

```python
from activity.models import RetakeRecordDetail
from mobile.models import Attachment

# Pick the local_id from the Metro logs
RetakeRecordDetail.objects.filter(pk='<cuid>').count()  # expect 1
Attachment.objects.filter(record_details_id='<cuid>').count()  # expect 1 (or 0 if no file)
```

No duplicate rows. Attachment count matches the number of distinct files uploaded for that detail.

- [ ] **Step 6: Repeat the round trip for StudentActivity**

Trigger any flow that creates or updates a `StudentActivity` (typically completing or saving progress on an activity).

Expected: same idempotent behavior. No 500s.

- [ ] **Step 7: Stop and report**

Report: "End-to-end smoke test passed. No 500s, no retry loops, no duplicate rows. Implementation complete. Ready for user to inspect and commit."

---

## Rollout notes

- **Server first.** The mixin is additive — PUT to instance URLs is now an upsert, but the existing `POST /<table>/` create endpoints still work. Deploy the server first so any in-flight ops from old clients keep succeeding.
- **Client cutover.** Once the server is deployed, ship the client. Old client versions (pre-cutover) will keep using `POST /<table>/` and will keep having the original retry-loop bug under partial-success conditions — but they always did, so this is no regression. New client versions get the fix.
- **No URL changes.** Existing routes are unchanged; we're using URLs that DRF's `DefaultRouter` already exposes.
- **No schema changes.** Migration `0036_swap_retake_pk` is not touched.
- **`POST /<table>/` deprecation.** Out of scope for this PR. Track as a follow-up: once all client versions in the wild use PUT-to-instance, remove the create endpoints.

## Follow-up work (NOT this PR)

1. **Schema migration (the (A) option discussed in design).** Demote `local_id` from PK to non-unique, add surrogate `id`, add `UniqueConstraint(student, local_id)`. Eliminates the 409-cross-tenant case at the schema layer. High risk; deserves its own plan.
2. **Remove `POST /<table>/` endpoints** once all client versions in the wild use the new path.
3. **Audit `Activity` table** — confirm mobile never PUTs it; if it does, apply the mixin.
4. **Move `_regrade_chain` into `RetakeRecordDetail.save`** behind a guard to prevent infinite recursion. Cleaner architecturally; not load-bearing for the bug fix.

---

## Self-review

**Spec coverage:**
- Bug fix (retry loop): Tasks 4, 5 (mixin + RetakeRecord/Detail wiring).
- Client switch to PUT instance URL: Task 8.
- Server-authoritative field allowlist: Tasks 4, 5, 6 (`CLIENT_WRITABLE_FIELDS`).
- Owner enforcement: Tasks 4, 5, 6 (`perform_create`/`perform_update` force, mixin strips body).
- Cross-tenant 409 case: Task 2 (test) + Task 3 (mixin `IntegrityError` catch).
- StudentActivity auth gap: Task 6.
- Attachment dedup bug: Task 7.
- PATCH semantics preserved: Task 2 test + mixin design comment.

**Placeholder scan:** No TBDs. All code blocks contain the actual code. No "similar to Task N". All tests have explicit assertions and expected status codes.

**Type/name consistency:**
- `IdempotentLocalIdUpsertMixin` named consistently across tasks 3, 4, 5, 6.
- `CLIENT_WRITABLE_FIELDS` capitalization consistent.
- `OWNER_FIELD`/`OWNER_ID_FIELD` only referenced inside the mixin — no callers depend on the name.
- File paths: `mobile/views/_idempotent.py` consistent in Tasks 3, 4, 5, 6.
- Connector instance URL string consistent between Task 8 and the test expectations in Task 9.
