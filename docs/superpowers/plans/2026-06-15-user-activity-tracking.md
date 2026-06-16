# User Activity Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the mobile client into the existing `logs.UserActivityLog` audit system so mobile-originated actions appear on the same admin/teacher/student dashboards that already display web activity.

**Architecture:** Mobile emits semantic events via a persist-first MMKV queue that batches POSTs to a new DRF ingest endpoint, which reuses the existing `log_user_action()` helper so the live WebSocket dashboards update unchanged. See `docs/superpowers/specs/2026-06-15-user-activity-tracking-design.md` for the full design.

**Tech Stack:** Django 4.x + DRF (server, two repos: `../classedge-mobile-test`), React Native 0.81 + expo-router 6 + react-native-mmkv 4 (client, this repo).

**Test discipline:**
- **Server tasks** use Django `TestCase` TDD (write failing test → confirm fail → minimal impl → confirm pass).
- **Mobile tasks** use type-driven development + `tsc --noEmit` + manual smoke verification. The repo has no Jest setup; introducing one is its own ~half-day project tracked as an optional follow-up at the end of this plan. Each mobile task explicitly verifies via `pnpm typecheck`, `pnpm lint`, and a runtime smoke step.

**Commit policy:** Per user preference, this plan does **not** include `git add`/`git commit` commands. Each task ends with a "Review and stage" step describing what you changed; you stage and commit yourself.

**Repo paths used in this plan:**
- Server: `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test`
- Mobile: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile`

---

## Phase A — Server (Django)

Work in `../classedge-mobile-test`. Activate the project's venv before running any task: `source venv/bin/activate`.

### Task S1: Migration — add `client_event_id` and `occurred_at` to `UserActivityLog`

**Files:**
- Modify: `logs/models.py` (add two fields to `UserActivityLog`)
- Create: `logs/migrations/0012_useractivitylog_mobile_fields.py` (generated)

- [ ] **Step 1: Write the failing test**

Create `logs/tests/test_mobile_fields.py`:

```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from logs.models import UserActivityLog

User = get_user_model()


class UserActivityLogMobileFieldsTests(TestCase):
    def test_client_event_id_field_exists_and_is_nullable(self):
        field = UserActivityLog._meta.get_field('client_event_id')
        self.assertTrue(field.null)
        self.assertTrue(field.unique)
        self.assertEqual(field.max_length, 32)

    def test_occurred_at_field_exists_and_is_nullable(self):
        field = UserActivityLog._meta.get_field('occurred_at')
        self.assertTrue(field.null)

    def test_existing_create_path_unchanged(self):
        # Web call sites pass none of the new fields; rows still save.
        user = User.objects.create(username='alice', email='alice@x.test')
        log = UserActivityLog.objects.create(
            user=user,
            action=UserActivityLog.ACTION_LOGIN,
            description='Signed in',
        )
        self.assertIsNone(log.client_event_id)
        self.assertIsNone(log.occurred_at)
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python manage.py test logs.tests.test_mobile_fields -v 2
```

Expected: `FAIL` — `UserActivityLog has no field named 'client_event_id'`.

- [ ] **Step 3: Add the fields to the model**

Edit `logs/models.py`, inside `class UserActivityLog`, after `ip_address`:

```python
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    # Mobile-ingest extensions (NULL for all web-originated rows).
    client_event_id = models.CharField(
        max_length=32, null=True, blank=True, unique=True, db_index=True,
    )
    occurred_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

- [ ] **Step 4: Generate and inspect the migration**

```bash
python manage.py makemigrations logs --name useractivitylog_mobile_fields
```

Expected output: `Migrations for 'logs': logs/migrations/0012_useractivitylog_mobile_fields.py`.

Open the generated file and confirm it contains exactly two `AddField` operations and **nothing else** (no `AlterField` on existing columns). If anything else appears, stop and investigate.

- [ ] **Step 5: Apply migration and re-run test**

```bash
python manage.py migrate
python manage.py test logs.tests.test_mobile_fields -v 2
```

Expected: PASS.

- [ ] **Step 6: Review and stage**

Changed: `logs/models.py`, new migration, new test file. No web call sites touched. Stage when satisfied.

---

### Task S2: Add four new action constants to `UserActivityLog`

**Files:**
- Modify: `logs/models.py:49-87` (`ACTION_*` constants and `ACTION_CHOICES`)

- [ ] **Step 1: Extend the existing mobile-fields test file with action tests**

Append to `logs/tests/test_mobile_fields.py`:

```python
class UserActivityLogActionTaxonomyTests(TestCase):
    def test_new_mobile_actions_are_in_choices(self):
        choice_values = {value for value, _label in UserActivityLog.ACTION_CHOICES}
        self.assertIn('open_notification', choice_values)
        self.assertIn('open_announcement', choice_values)
        self.assertIn('open_calendar_event', choice_values)
        self.assertIn('open_profile', choice_values)

    def test_action_constants_exposed(self):
        self.assertEqual(UserActivityLog.ACTION_OPEN_NOTIFICATION, 'open_notification')
        self.assertEqual(UserActivityLog.ACTION_OPEN_ANNOUNCEMENT, 'open_announcement')
        self.assertEqual(UserActivityLog.ACTION_OPEN_CALENDAR_EVENT, 'open_calendar_event')
        self.assertEqual(UserActivityLog.ACTION_OPEN_PROFILE, 'open_profile')
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python manage.py test logs.tests.test_mobile_fields.UserActivityLogActionTaxonomyTests -v 2
```

Expected: `FAIL` — `UserActivityLog has no attribute 'ACTION_OPEN_NOTIFICATION'`.

- [ ] **Step 3: Add constants and choices**

Edit `logs/models.py` inside `class UserActivityLog`, add after `ACTION_DELETE_ACTIVITY`:

```python
    ACTION_DELETE_ACTIVITY = 'delete_activity'
    # Mobile-only verbs (web does not emit these today).
    ACTION_OPEN_NOTIFICATION = 'open_notification'
    ACTION_OPEN_ANNOUNCEMENT = 'open_announcement'
    ACTION_OPEN_CALENDAR_EVENT = 'open_calendar_event'
    ACTION_OPEN_PROFILE = 'open_profile'
```

And extend `ACTION_CHOICES`:

```python
        (ACTION_DELETE_ACTIVITY, 'Deleted activity'),
        (ACTION_OPEN_NOTIFICATION, 'Opened notification'),
        (ACTION_OPEN_ANNOUNCEMENT, 'Opened announcement'),
        (ACTION_OPEN_CALENDAR_EVENT, 'Opened calendar event'),
        (ACTION_OPEN_PROFILE, 'Opened profile'),
    ]
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
python manage.py test logs.tests.test_mobile_fields -v 2
```

Expected: PASS.

- [ ] **Step 5: Confirm `ACTION_CHOICES` is a model-level constant, not a migration column**

`choices=` is enforced at the form/serializer layer, not the DB. No migration is generated for this change. Confirm:

```bash
python manage.py makemigrations --dry-run logs
```

Expected: `No changes detected`.

- [ ] **Step 6: Review and stage**

Changed: `logs/models.py` (8 added lines), test file. Stage when satisfied.

---

### Task S3: `IngestEventSerializer` + `IngestEventsSerializer`

**Files:**
- Modify: `logs/serializers.py` (append new classes; keep existing `NotificationSerializer` untouched)
- Create: `logs/tests/test_ingest_serializer.py`

- [ ] **Step 1: Write the failing test**

Create `logs/tests/test_ingest_serializer.py`:

```python
from django.test import TestCase
from logs.serializers import IngestEventSerializer, IngestEventsSerializer


class IngestEventSerializerTests(TestCase):
    def _valid_event(self, **overrides):
        base = {
            'client_event_id': '01j9xyz0000000000000000001',
            'action': 'open_subject',
            'subject_id': 42,
            'occurred_at': '2026-06-15T14:23:11.402Z',
        }
        base.update(overrides)
        return base

    def test_minimum_valid_event(self):
        s = IngestEventSerializer(data=self._valid_event())
        self.assertTrue(s.is_valid(), s.errors)

    def test_rejects_unknown_action(self):
        s = IngestEventSerializer(data=self._valid_event(action='hijack'))
        self.assertFalse(s.is_valid())
        self.assertIn('action', s.errors)

    def test_requires_client_event_id(self):
        data = self._valid_event()
        data.pop('client_event_id')
        s = IngestEventSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('client_event_id', s.errors)

    def test_requires_occurred_at(self):
        data = self._valid_event()
        data.pop('occurred_at')
        s = IngestEventSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('occurred_at', s.errors)

    def test_allows_nullable_fks(self):
        s = IngestEventSerializer(data=self._valid_event(
            subject_id=None, activity_id=None, module_id=None,
        ))
        self.assertTrue(s.is_valid(), s.errors)

    def test_accepts_open_notification_with_entity_fields(self):
        s = IngestEventSerializer(data={
            'client_event_id': '01j9xyz0000000000000000002',
            'action': 'open_notification',
            'entity_type': 'activity',
            'entity_id': 'abc-123',
            'occurred_at': '2026-06-15T14:23:11.402Z',
        })
        self.assertTrue(s.is_valid(), s.errors)


class IngestEventsSerializerTests(TestCase):
    def test_accepts_batch(self):
        s = IngestEventsSerializer(data={'events': [
            {
                'client_event_id': '01j9xyz0000000000000000010',
                'action': 'login',
                'occurred_at': '2026-06-15T10:00:00Z',
            },
            {
                'client_event_id': '01j9xyz0000000000000000011',
                'action': 'open_subject',
                'subject_id': 1,
                'occurred_at': '2026-06-15T10:00:05Z',
            },
        ]})
        self.assertTrue(s.is_valid(), s.errors)

    def test_rejects_oversized_batch(self):
        events = [
            {
                'client_event_id': f'01j9{i:028d}',
                'action': 'login',
                'occurred_at': '2026-06-15T10:00:00Z',
            }
            for i in range(101)
        ]
        s = IngestEventsSerializer(data={'events': events})
        self.assertFalse(s.is_valid())
        self.assertIn('events', s.errors)
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python manage.py test logs.tests.test_ingest_serializer -v 2
```

Expected: `FAIL` — `cannot import name 'IngestEventSerializer'`.

- [ ] **Step 3: Implement the serializers**

Append to `logs/serializers.py`:

```python
from logs.models import UserActivityLog


class IngestEventSerializer(serializers.Serializer):
    client_event_id = serializers.CharField(max_length=32)
    action = serializers.ChoiceField(choices=UserActivityLog.ACTION_CHOICES)
    subject_id = serializers.IntegerField(required=False, allow_null=True)
    activity_id = serializers.CharField(required=False, allow_null=True, max_length=64)
    module_id = serializers.IntegerField(required=False, allow_null=True)
    entity_type = serializers.CharField(required=False, allow_null=True, max_length=50)
    entity_id = serializers.CharField(required=False, allow_null=True, max_length=64)
    description = serializers.CharField(required=False, allow_blank=True, max_length=255)
    occurred_at = serializers.DateTimeField()


class IngestEventsSerializer(serializers.Serializer):
    events = serializers.ListField(
        child=IngestEventSerializer(),
        min_length=1,
        max_length=100,
    )
```

(Note: DRF's `ListField` with a serializer child handles `max_length` validation natively; that is why the test for oversized batches asserts the error key is `events`, not a per-item error.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
python manage.py test logs.tests.test_ingest_serializer -v 2
```

Expected: PASS (all 8 tests).

- [ ] **Step 5: Review and stage**

Changed: `logs/serializers.py` (one import + two classes appended), one new test file. Stage when satisfied.

---

### Task S4: `IngestThrottle` + settings

**Files:**
- Modify: `lms/settings.py` (add `activity_ingest` rate)
- Create: `logs/throttles.py`

- [ ] **Step 1: Locate the existing `DEFAULT_THROTTLE_RATES`**

```bash
grep -n "DEFAULT_THROTTLE_RATES" lms/settings.py || echo "not found — add new block"
```

If not found, you'll add a new block in step 3.

- [ ] **Step 2: Create the throttle class**

Create `logs/throttles.py`:

```python
from rest_framework.throttling import UserRateThrottle


class IngestThrottle(UserRateThrottle):
    """Throttle for /api/logs/events/. Rate set via DEFAULT_THROTTLE_RATES."""
    scope = 'activity_ingest'
```

- [ ] **Step 3: Add the rate to settings**

In `lms/settings.py`, find `REST_FRAMEWORK = {`. Inside it, ensure `DEFAULT_THROTTLE_CLASSES` and `DEFAULT_THROTTLE_RATES` exist. Add `'activity_ingest': '600/minute'` to `DEFAULT_THROTTLE_RATES`:

```python
REST_FRAMEWORK = {
    # ... existing entries ...
    'DEFAULT_THROTTLE_RATES': {
        # ... any existing scopes ...
        'activity_ingest': '600/minute',
    },
}
```

If `DEFAULT_THROTTLE_RATES` doesn't exist, add it with that single entry.

- [ ] **Step 4: Verify Django reads the setting**

```bash
python manage.py shell -c "from django.conf import settings; print(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].get('activity_ingest'))"
```

Expected: `600/minute`.

- [ ] **Step 5: Review and stage**

Changed: `lms/settings.py` (1-line addition), new `logs/throttles.py`. Stage when satisfied.

---

### Task S5: `IngestEventsView` — the endpoint

**Files:**
- Create: `logs/views_mobile.py`
- Modify: `logs/utils.py` — verify `log_user_action` accepts the args we pass (no change expected, but read it)
- Create: `logs/tests/test_ingest_view.py`

- [ ] **Step 1: Write the failing test**

Create `logs/tests/test_ingest_view.py`:

```python
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from logs.models import UserActivityLog

User = get_user_model()


def _jwt_for(user):
    return str(RefreshToken.for_user(user).access_token)


class IngestEventsViewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.url = '/logs/api/events/'  # confirm in Task S6
        cls.user = User.objects.create(username='stu', email='stu@x.test')

    def setUp(self):
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_jwt_for(self.user)}')

    def _post(self, events):
        return self.client.post(self.url, {'events': events}, format='json')

    def test_login_event_creates_row(self):
        resp = self._post([{
            'client_event_id': '01j9aaa0000000000000000001',
            'action': 'login',
            'occurred_at': '2026-06-15T10:00:00Z',
        }])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['accepted'], ['01j9aaa0000000000000000001'])
        self.assertEqual(resp.data['duplicates'], [])
        row = UserActivityLog.objects.get(client_event_id='01j9aaa0000000000000000001')
        self.assertEqual(row.user_id, self.user.id)
        self.assertEqual(row.action, 'login')
        self.assertIsNotNone(row.occurred_at)

    def test_duplicate_client_event_id_is_reported_and_not_double_inserted(self):
        payload = [{
            'client_event_id': '01j9aaa0000000000000000002',
            'action': 'login',
            'occurred_at': '2026-06-15T10:00:00Z',
        }]
        self._post(payload)
        resp = self._post(payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['accepted'], [])
        self.assertEqual(resp.data['duplicates'], ['01j9aaa0000000000000000002'])
        self.assertEqual(
            UserActivityLog.objects.filter(client_event_id='01j9aaa0000000000000000002').count(),
            1,
        )

    def test_stale_subject_id_is_logged_with_null_fk_not_rejected(self):
        resp = self._post([{
            'client_event_id': '01j9aaa0000000000000000003',
            'action': 'open_subject',
            'subject_id': 99_999_999,  # does not exist
            'occurred_at': '2026-06-15T10:00:00Z',
        }])
        self.assertEqual(resp.status_code, 200)
        row = UserActivityLog.objects.get(client_event_id='01j9aaa0000000000000000003')
        self.assertIsNone(row.subject_id)
        self.assertEqual(row.action, 'open_subject')

    def test_unauthenticated_request_rejected(self):
        self.client.credentials()  # drop auth header
        resp = self._post([{
            'client_event_id': '01j9aaa0000000000000000004',
            'action': 'login',
            'occurred_at': '2026-06-15T10:00:00Z',
        }])
        self.assertIn(resp.status_code, (401, 403))

    def test_mixed_batch_one_dupe_one_new(self):
        self._post([{
            'client_event_id': '01j9aaa0000000000000000005',
            'action': 'login',
            'occurred_at': '2026-06-15T10:00:00Z',
        }])
        resp = self._post([
            {
                'client_event_id': '01j9aaa0000000000000000005',  # dupe
                'action': 'login',
                'occurred_at': '2026-06-15T10:00:00Z',
            },
            {
                'client_event_id': '01j9aaa0000000000000000006',  # new
                'action': 'open_profile',
                'occurred_at': '2026-06-15T10:00:01Z',
            },
        ])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(set(resp.data['accepted']), {'01j9aaa0000000000000000006'})
        self.assertEqual(set(resp.data['duplicates']), {'01j9aaa0000000000000000005'})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python manage.py test logs.tests.test_ingest_view -v 2
```

Expected: all tests FAIL with `404` (URL not yet wired) or `ImportError`.

- [ ] **Step 3: Implement the view**

Create `logs/views_mobile.py`:

```python
"""Mobile-facing audit ingest endpoint.

Lives separately from logs/views.py (which holds HTML admin/teacher/student
audit pages) so the mobile and web concerns evolve independently.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from activity.models.activity_model import Activity
from logs.models import UserActivityLog
from logs.serializers import IngestEventsSerializer
from logs.throttles import IngestThrottle
from logs.utils import log_user_action
from module.models import Module
from subject.models import Subject


def _safe_get(model, pk):
    """Return the row with this pk, or None. Never raises."""
    if pk in (None, ''):
        return None
    try:
        return model.objects.filter(pk=pk).first()
    except Exception:
        return None


_DEFAULT_DESCRIPTIONS = {
    UserActivityLog.ACTION_LOGIN: 'Signed in',
    UserActivityLog.ACTION_LOGOUT: 'Signed out',
    UserActivityLog.ACTION_OPEN_SUBJECT: 'Opened subject',
    UserActivityLog.ACTION_OPEN_LESSON: 'Opened lesson',
    UserActivityLog.ACTION_OPEN_ACTIVITY: 'Opened activity',
    UserActivityLog.ACTION_START_ACTIVITY: 'Started activity',
    UserActivityLog.ACTION_SUBMIT_ACTIVITY: 'Submitted activity',
    UserActivityLog.ACTION_VIEW_SCORE: 'Viewed score',
    UserActivityLog.ACTION_OPEN_NOTIFICATION: 'Opened notification',
    UserActivityLog.ACTION_OPEN_ANNOUNCEMENT: 'Opened announcement',
    UserActivityLog.ACTION_OPEN_CALENDAR_EVENT: 'Opened calendar event',
    UserActivityLog.ACTION_OPEN_PROFILE: 'Opened profile',
}


def _default_description(action, subject, activity):
    base = _DEFAULT_DESCRIPTIONS.get(action, action.replace('_', ' ').capitalize())
    if activity is not None and getattr(activity, 'activity_name', None):
        return f'{base}: {activity.activity_name}'[:255]
    if subject is not None and getattr(subject, 'subject_name', None):
        return f'{base}: {subject.subject_name}'[:255]
    return base


class IngestEventsView(APIView):
    """POST /logs/api/events/ — accepts a batched list of audit events from
    a mobile client and inserts them into UserActivityLog via the existing
    log_user_action() helper (so the WebSocket broadcast still fires).

    Response: {accepted: [client_event_id, ...], duplicates: [client_event_id, ...]}.
    The client should delete both sets from its local outbox after a 200.
    Events not in either set should be retried on the next flush.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [IngestThrottle]

    def post(self, request):
        serializer = IngestEventsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        accepted, duplicates = [], []

        for evt in serializer.validated_data['events']:
            cid = evt['client_event_id']

            if UserActivityLog.objects.filter(client_event_id=cid).exists():
                duplicates.append(cid)
                continue

            subject  = _safe_get(Subject,  evt.get('subject_id'))
            activity = _safe_get(Activity, evt.get('activity_id'))
            module_  = _safe_get(Module,   evt.get('module_id'))

            try:
                log = log_user_action(
                    request.user,
                    evt['action'],
                    description=evt.get('description') or _default_description(
                        evt['action'], subject, activity,
                    ),
                    subject=subject,
                    activity=activity,
                    module=module_,
                    request=request,
                )
            except Exception:
                # Per-event failures must not poison the batch.
                continue

            if log is None:
                continue

            # Backfill the two mobile-specific columns post-insert. Keeps
            # log_user_action()'s signature untouched (used by ~30 web sites).
            UserActivityLog.objects.filter(pk=log.pk).update(
                client_event_id=cid,
                occurred_at=evt['occurred_at'],
            )
            accepted.append(cid)

        return Response({'accepted': accepted, 'duplicates': duplicates})
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
python manage.py test logs.tests.test_ingest_view -v 2
```

If `test_login_event_creates_row` fails with `404`, move to Task S6 (URL wiring) and come back to re-run.

If `test_unauthenticated_request_rejected` returns 200, check that `JWTAuthentication` is the first entry in `authentication_classes` (some DRF versions require it explicitly).

Expected: all 5 tests PASS once Task S6 is done.

- [ ] **Step 5: Review and stage**

Changed: new `logs/views_mobile.py`, new test file. No changes to `logs/views.py` or `logs/utils.py`. Stage when satisfied.

---

### Task S6: URL wiring

**Files:**
- Modify: `logs/urls.py` (add one path entry)

- [ ] **Step 1: Add the URL**

Edit `logs/urls.py`. Find the existing `# Mobile` block (around line 13). Add the new endpoint:

```python
    # Mobile
    path('api/notifications/', NotificationList.as_view(), name='user_notifications_log_list'),
    path('api/notifications/count/', NotificationCount.as_view(), name='user_notifications_log_count'),
    path('api/logs_notification/<int:pk>/', NotificationDetail.as_view(), name='user_notifications_log_detail'),

    path('api/events/', __import__('logs.views_mobile', fromlist=['IngestEventsView']).IngestEventsView.as_view(),
         name='ingest_user_events'),
```

(The inline `__import__` keeps the existing wildcard `from .views import *` from clashing with `views_mobile`. If you prefer cleaner imports, replace it with an explicit `from logs.views_mobile import IngestEventsView` at the top of the file.)

**Cleaner alternative (preferred):** add at the top of `logs/urls.py`:

```python
from logs.views_mobile import IngestEventsView
```

and use `IngestEventsView.as_view()` directly:

```python
    path('api/events/', IngestEventsView.as_view(), name='ingest_user_events'),
```

- [ ] **Step 2: Confirm the URL resolves**

```bash
python manage.py shell -c "from django.urls import reverse; print(reverse('ingest_user_events'))"
```

Expected output (path depends on the project's URL root for `logs/`): `/logs/api/events/` or similar.

- [ ] **Step 3: Re-run the ingest view tests**

```bash
python manage.py test logs.tests.test_ingest_view -v 2
```

Expected: all 5 tests PASS. If a test still 404s, update `cls.url` in `test_ingest_view.py` to match the value printed in Step 2.

- [ ] **Step 4: Review and stage**

Changed: `logs/urls.py` (2-line addition). Stage when satisfied.

---

### Task S7: Curl smoke test against running dev server

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server in one terminal**

```bash
python manage.py runserver 0.0.0.0:8000
```

- [ ] **Step 2: Obtain a JWT for a test user**

```bash
python manage.py shell -c "
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
u = get_user_model().objects.filter(is_active=True).exclude(is_superuser=True).first()
print('user:', u.email, 'id:', u.id)
print('access:', RefreshToken.for_user(u).access_token)
"
```

Copy the access token.

- [ ] **Step 3: POST a sample batch**

```bash
TOKEN="<paste access token>"
curl -i -X POST http://localhost:8000/logs/api/events/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "client_event_id": "01j9smoke00000000000000001",
        "action": "login",
        "occurred_at": "2026-06-15T10:00:00Z"
      },
      {
        "client_event_id": "01j9smoke00000000000000002",
        "action": "open_subject",
        "subject_id": 1,
        "occurred_at": "2026-06-15T10:00:05Z"
      }
    ]
  }'
```

Expected: `HTTP/1.1 200 OK` with body `{"accepted":["01j9smoke00000000000000001","01j9smoke00000000000000002"],"duplicates":[]}`.

- [ ] **Step 4: Confirm rows landed and dashboard sees them**

```bash
python manage.py shell -c "
from logs.models import UserActivityLog
print(UserActivityLog.objects.filter(client_event_id__startswith='01j9smoke').values('action','client_event_id','occurred_at'))
"
```

Expected: two rows.

Open `/audit/dashboard/` in a browser (logged in as admin). Confirm the events appear in the live feed within seconds (WebSocket broadcast).

- [ ] **Step 5: Resend the same batch to confirm dedupe**

Re-run the curl command from Step 3. Expected: `{"accepted":[],"duplicates":["01j9smoke00000000000000001","01j9smoke00000000000000002"]}`.

- [ ] **Step 6: Clean up the smoke rows**

```bash
python manage.py shell -c "
from logs.models import UserActivityLog
n, _ = UserActivityLog.objects.filter(client_event_id__startswith='01j9smoke').delete()
print('deleted', n)
"
```

Expected: `deleted 2`.

Phase A complete. The server endpoint accepts events, dedupes, fans out via WebSocket, and shows up on dashboards.

---

## Phase B — Mobile (React Native + Expo)

Work in `client-mobile/`. Verification toolchain: `pnpm typecheck` and `pnpm lint`. Manual runtime verification on a simulator/device.

### Task M1: Tracker types + action constants

**Files:**
- Create: `lib/activity-tracker/types.ts`

- [ ] **Step 1: Define the public type surface**

Create `lib/activity-tracker/types.ts`:

```typescript
export type ActivityAction =
  | "login"
  | "logout"
  | "open_subject"
  | "open_lesson"
  | "open_activity"
  | "start_activity"
  | "submit_activity"
  | "view_score"
  | "open_notification"
  | "open_announcement"
  | "open_calendar_event"
  | "open_profile";

export type EmitIds = {
  subjectId?: number;
  activityId?: string;
  moduleId?: number;
  entityType?: string;
  entityId?: string;
};

export type PendingEvent = {
  client_event_id: string;
  action: ActivityAction;
  subject_id?: number | null;
  activity_id?: string | null;
  module_id?: number | null;
  entity_type?: string | null;
  entity_id?: string | null;
  description?: string;
  occurred_at: string;
};

export type IngestResponse = {
  accepted: string[];
  duplicates: string[];
};
```

(Note: `PendingEvent` uses snake_case to match exactly what gets POSTed — no transform layer is needed and the type is also the wire shape.)

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS (no usages yet, but the new file must type-check).

- [ ] **Step 3: Review and stage**

Changed: new file only. Stage when satisfied.

---

### Task M2: MMKV-backed persist-first queue

**Files:**
- Create: `lib/activity-tracker/queue.ts`

- [ ] **Step 1: Implement the queue**

Create `lib/activity-tracker/queue.ts`:

```typescript
import { createMMKV } from "react-native-mmkv";
import type { PendingEvent } from "./types";

const KEY_PREFIX = "evt:";
const MAX_QUEUE_SIZE = 5000;
const EVICT_BATCH = 100;

// Dedicated MMKV instance for activity events. Keeps the tracker storage
// isolated from auth/persist-query caches (separate ids, separate files).
const storage = createMMKV({ id: "activity-events" });

let droppedSinceLaunch = 0;

export function enqueue(event: PendingEvent): void {
  if (size() >= MAX_QUEUE_SIZE) {
    evictOldest();
  }
  storage.set(KEY_PREFIX + event.client_event_id, JSON.stringify(event));
}

export function size(): number {
  return storage.getAllKeys().filter((k) => k.startsWith(KEY_PREFIX)).length;
}

export function readBatch(maxN: number): PendingEvent[] {
  const keys = storage
    .getAllKeys()
    .filter((k) => k.startsWith(KEY_PREFIX))
    .sort()
    .slice(0, maxN);

  const events: PendingEvent[] = [];
  for (const key of keys) {
    const raw = storage.getString(key);
    if (!raw) continue;
    try {
      events.push(JSON.parse(raw) as PendingEvent);
    } catch {
      storage.remove(key); // corrupt row — drop it
    }
  }
  return events;
}

export function deleteByClientEventIds(ids: string[]): void {
  for (const id of ids) {
    storage.remove(KEY_PREFIX + id);
  }
}

function evictOldest(): void {
  const keys = storage
    .getAllKeys()
    .filter((k) => k.startsWith(KEY_PREFIX))
    .sort()
    .slice(0, EVICT_BATCH);
  for (const k of keys) storage.remove(k);
  droppedSinceLaunch += keys.length;
}

export function getDroppedSinceLaunch(): number {
  return droppedSinceLaunch;
}

export function _clearForTest(): void {
  for (const k of storage.getAllKeys()) storage.remove(k);
  droppedSinceLaunch = 0;
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: PASS (or note any auto-fixable warnings).

- [ ] **Step 4: Review and stage**

Stage when satisfied.

---

### Task M3: Flush logic with backoff and dedupe handling

**Files:**
- Create: `lib/activity-tracker/flush.ts`

- [ ] **Step 1: Implement the flusher**

Create `lib/activity-tracker/flush.ts`:

```typescript
import api from "@/lib/axios";
import useStore from "@/lib/store";
import { deleteByClientEventIds, readBatch, size } from "./queue";
import type { IngestResponse } from "./types";

const ENDPOINT = "/logs/api/events/";
const FLUSH_BATCH_SIZE = 100;

const BACKOFF_MS = [5_000, 30_000, 120_000, 300_000];
let consecutiveFailures = 0;
let nextEligibleAt = 0;
let flushInFlight: Promise<void> | null = null;

export async function flush(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    try {
      await doFlush();
    } finally {
      flushInFlight = null;
    }
  })();
  return flushInFlight;
}

async function doFlush(): Promise<void> {
  if (Date.now() < nextEligibleAt) return;
  if (size() === 0) return;

  // Skip when offline; NetInfo state lives in the zustand store.
  const { isConnected, isInternetReachable, accessToken } = useStore.getState();
  if (!isConnected || !isInternetReachable || !accessToken) return;

  const events = readBatch(FLUSH_BATCH_SIZE);
  if (events.length === 0) return;

  try {
    const { data } = await api.post<IngestResponse>(ENDPOINT, { events });
    // Server returns camelCase via the response interceptor.
    const accepted = (data as unknown as { accepted: string[] }).accepted ?? [];
    const duplicates = (data as unknown as { duplicates: string[] }).duplicates ?? [];
    deleteByClientEventIds([...accepted, ...duplicates]);
    consecutiveFailures = 0;
    nextEligibleAt = 0;
  } catch (error) {
    consecutiveFailures += 1;
    const delay = BACKOFF_MS[Math.min(consecutiveFailures - 1, BACKOFF_MS.length - 1)];
    nextEligibleAt = Date.now() + delay;
    if (__DEV__) {
      console.warn("[activity-tracker] flush failed; retry in", delay, "ms", error);
    }
  }
}

export function _resetForTest(): void {
  consecutiveFailures = 0;
  nextEligibleAt = 0;
  flushInFlight = null;
}
```

- [ ] **Step 2: Confirm `useStore` exposes the fields used**

```bash
grep -nE "isConnected|isInternetReachable|accessToken" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/lib/store.ts
```

Expected: all three exist. If `isInternetReachable` is named differently in the store, adjust the destructure on line "const { isConnected, isInternetReachable, accessToken } = useStore.getState();" to match.

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Review and stage**

Stage when satisfied.

---

### Task M4: Public `track()` API + interval/AppState orchestration

**Files:**
- Create: `lib/activity-tracker/index.ts`
- Verify dependency exists: `@paralleldrive/cuid2` (already in package.json — confirm).

- [ ] **Step 1: Confirm cuid2 is installed**

```bash
grep -n "@paralleldrive/cuid2" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/package.json
```

Expected: present (per package.json line 30).

- [ ] **Step 2: Implement the public API**

Create `lib/activity-tracker/index.ts`:

```typescript
import { createId } from "@paralleldrive/cuid2";
import { AppState, type AppStateStatus } from "react-native";
import { enqueue, size } from "./queue";
import { flush } from "./flush";
import type { ActivityAction, EmitIds, PendingEvent } from "./types";

const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_THRESHOLD = 20;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;

export function track(action: ActivityAction, ids?: EmitIds, description?: string): void {
  const event: PendingEvent = {
    client_event_id: createId(),
    action,
    subject_id: ids?.subjectId ?? null,
    activity_id: ids?.activityId ?? null,
    module_id: ids?.moduleId ?? null,
    entity_type: ids?.entityType ?? null,
    entity_id: ids?.entityId ?? null,
    description,
    occurred_at: new Date().toISOString(),
  };
  enqueue(event);

  if (size() >= FLUSH_THRESHOLD) {
    void flush();
  }
}

export { flush };

export function startActivityTracker(): () => void {
  if (intervalHandle === null) {
    intervalHandle = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);
  }
  if (appStateSub === null) {
    const handler = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        void flush();
      }
    };
    appStateSub = AppState.addEventListener("change", handler);
  }
  return stopActivityTracker;
}

export function stopActivityTracker(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (appStateSub !== null) {
    appStateSub.remove();
    appStateSub = null;
  }
}

export type { ActivityAction, EmitIds };
```

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Review and stage**

Stage when satisfied.

---

### Task M5: Screen → action registry

**Files:**
- Create: `lib/activity-tracker/registry.ts`

- [ ] **Step 1: Confirm expo-router paths**

Open `app/(main)/` in your editor and confirm these route files exist (paths confirmed during planning, but verify before locking the registry):

- `app/(main)/subject/[subjectId]/subject-details.tsx`
- `app/(main)/course/[courseId]/course-details.tsx`
- `app/(main)/assessment/[assessmentId]/index.tsx`
- `app/(main)/activity/[activityId]/index.tsx`
- `app/(main)/profile/index.tsx`

If any path differs, adjust the registry keys in Step 2 to match the actual file paths (expo-router strips the `app/` prefix and the file extension to build the URL).

- [ ] **Step 2: Implement the registry**

Create `lib/activity-tracker/registry.ts`:

```typescript
import type { ActivityAction, EmitIds } from "./types";

type RegistryEntry = {
  action: ActivityAction;
  extract: (params: Record<string, string | string[] | undefined>) => EmitIds;
};

const asString = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const asNumber = (v: string | string[] | undefined): number | undefined => {
  const s = asString(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Pathname → audit action mapper. Keys are the expo-router URL form of
 * the route file (no `app/`, no extension, group dirs `()` removed).
 *
 * Routes not in this map produce no auto-emit. Add an entry when wiring
 * a new screen that deserves an audit event.
 */
export const screenRegistry: Record<string, RegistryEntry> = {
  "/subject/[subjectId]/subject-details": {
    action: "open_subject",
    extract: (p) => ({ subjectId: asNumber(p.subjectId) }),
  },
  "/course/[courseId]/course-details": {
    action: "open_subject",
    extract: (p) => ({ subjectId: asNumber(p.courseId) }),
  },
  "/assessment/[assessmentId]": {
    action: "open_activity",
    extract: (p) => ({ activityId: asString(p.assessmentId) }),
  },
  "/activity/[activityId]": {
    action: "open_activity",
    extract: (p) => ({ activityId: asString(p.activityId) }),
  },
  "/profile": {
    action: "open_profile",
    extract: () => ({}),
  },
  // Add open_lesson / open_announcement / open_calendar_event / view_score
  // entries here once those routes are confirmed. See spec §4.
};

/**
 * Match a resolved pathname (e.g. "/subject/42/subject-details") to a registry
 * entry by replacing concrete segments with their bracketed template form.
 *
 * Returns `null` if no match.
 */
export function matchPath(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
): { entry: RegistryEntry; templatedPath: string } | null {
  for (const key of Object.keys(screenRegistry)) {
    if (pathMatchesTemplate(pathname, key, params)) {
      return { entry: screenRegistry[key], templatedPath: key };
    }
  }
  return null;
}

function pathMatchesTemplate(
  actual: string,
  template: string,
  params: Record<string, string | string[] | undefined>,
): boolean {
  const a = actual.split("/").filter(Boolean);
  const t = template.split("/").filter(Boolean);
  if (a.length !== t.length) return false;
  for (let i = 0; i < t.length; i += 1) {
    const seg = t[i];
    if (seg.startsWith("[") && seg.endsWith("]")) {
      const paramName = seg.slice(1, -1);
      const paramVal = asString(params[paramName]);
      if (paramVal !== a[i]) return false;
    } else if (seg !== a[i]) {
      return false;
    }
  }
  return true;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Review and stage**

Stage when satisfied.

---

### Task M6: Navigation listener component

**Files:**
- Create: `lib/activity-tracker/NavListener.tsx`

- [ ] **Step 1: Implement the listener**

Create `lib/activity-tracker/NavListener.tsx`:

```typescript
import { useEffect, useRef } from "react";
import { useLocalSearchParams, usePathname } from "expo-router";
import { track } from "./index";
import { matchPath } from "./registry";

/**
 * Mount-and-forget component. Watches the current expo-router pathname and
 * emits an `open_*` audit event when the user navigates onto a screen that
 * the registry maps. No-op for unmapped screens.
 *
 * Renders nothing.
 */
export function NavListener(): null {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const lastEmittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    // De-dupe within a single mount lifecycle: if the user re-enters the
    // same route (e.g. tabs), still emit — that's a meaningful re-open.
    // But avoid double-firing on the same render pass.
    const matched = matchPath(pathname, params as Record<string, string | string[] | undefined>);
    if (!matched) return;

    const key = `${matched.templatedPath}::${JSON.stringify(matched.entry.extract(
      params as Record<string, string | string[] | undefined>,
    ))}`;
    if (lastEmittedRef.current === key) return;
    lastEmittedRef.current = key;

    track(
      matched.entry.action,
      matched.entry.extract(params as Record<string, string | string[] | undefined>),
    );
  }, [pathname, params]);

  return null;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Review and stage**

Stage when satisfied.

---

### Task M7: Mount the tracker in `RootProvider`

**Files:**
- Modify: `providers/RootProvider.tsx`

- [ ] **Step 1: Wire `startActivityTracker` and `NavListener`**

Edit `providers/RootProvider.tsx`:

```typescript
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NetworkBannerProvider } from "@/features/network/NetworkBannerContext";
import { NavListener } from "@/lib/activity-tracker/NavListener";
import { startActivityTracker } from "@/lib/activity-tracker";
import HeroUIProvider from "./HeroUIProvider";
import KeyboardProvider from "./KeyboardProvider";
import NetworkProvider from "./NetworkProvider";
import PowerSyncProvider from "./PowerSyncProvider";
import OneSignalProvider from "./OneSignalProvider";
import QueryProvider from "./QueryProvider";
import ImageProvider from "./ImageProvider";

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const stop = startActivityTracker();
    return stop;
  }, []);

  return (
    <SafeAreaProvider>
      <ImageProvider>
        <OneSignalProvider>
          <NetworkProvider>
            <NetworkBannerProvider>
              <PowerSyncProvider>
                <QueryProvider>
                  <HeroUIProvider>
                    <KeyboardProvider>
                      <NavListener />
                      {children}
                    </KeyboardProvider>
                  </HeroUIProvider>
                </QueryProvider>
              </PowerSyncProvider>
            </NetworkBannerProvider>
          </NetworkProvider>
        </OneSignalProvider>
      </ImageProvider>
    </SafeAreaProvider>
  );
};

export default RootProvider;
```

- [ ] **Step 2: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Boot the app and smoke-verify**

```bash
pnpm start:dev
```

Open the app on a simulator. Sign in. Navigate to a course detail page.

Open the **server-side** dev shell in another terminal:

```bash
cd ../classedge-mobile-test
source venv/bin/activate
python manage.py shell -c "
from logs.models import UserActivityLog
import json
for r in UserActivityLog.objects.filter(client_event_id__isnull=False).order_by('-created_at')[:5]:
    print(r.created_at, r.action, r.client_event_id, r.subject_id, r.activity_id)
"
```

Expected: at least one `open_subject` row with a `client_event_id` populated.

- [ ] **Step 4: Review and stage**

Changed: `providers/RootProvider.tsx`. Stage when satisfied.

---

### Task M8: Wire explicit emit sites — login, logout, submit, start, notification press

**Files (each substep modifies one file):**
- Modify: `features/auth/...` — sign-in success and sign-out handlers
- Modify: `features/assessment/...` — submit and first-answer
- Modify: `features/notifications/...` — list row press

#### Substep 8a — Login emit

- [ ] **Step 1: Locate the sign-in success handler**

```bash
grep -rn "setAccessToken\|accessToken" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/auth | head -20
```

Identify the function that fires after a successful sign-in (typically right after the access token is persisted to the store).

- [ ] **Step 2: Add the emit**

In that function, after the token has been persisted, add:

```typescript
import { track } from "@/lib/activity-tracker";
// ... existing code ...
track("login");
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

#### Substep 8b — Logout emit + flush gate

- [ ] **Step 1: Locate the sign-out handler**

```bash
grep -rn "signOut\|logout\|clearTokens\|clearAccessToken" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/auth | head -20
```

- [ ] **Step 2: Make the handler async and flush before clearing tokens**

Modify the sign-out function. **Order matters** — emit, then await flush, then clear tokens:

```typescript
import { track, flush } from "@/lib/activity-tracker";

export async function signOut(): Promise<void> {
  track("logout");
  await flush();
  // ... existing token-clear / cache-clear code ...
}
```

If the existing function is not async, make it async and update its callers. If the callers can't easily become async, wrap the flush in a `.catch(() => {})` and fire-and-forget:

```typescript
track("logout");
flush().catch(() => {});
// ... existing token-clear code ...
```

The `await` variant is correct (spec §7.7); the fire-and-forget variant is acceptable only if making callers async is invasive.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

#### Substep 8c — Submit-activity emit

- [ ] **Step 1: Locate the submit handler**

```bash
grep -rn "submit_answers\|submitAnswers\|onSubmit" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/assessment | head -20
```

Find the success handler of the submit-answers mutation (or wherever the submission is confirmed).

- [ ] **Step 2: Add the emit**

```typescript
import { track } from "@/lib/activity-tracker";
// In the mutation onSuccess (or equivalent confirmation):
track("submit_activity", { activityId: assessmentId });
```

(Use whatever variable holds the activity ID in scope — `assessmentId`, `activityId`, `data.activityId`, etc.)

- [ ] **Step 3: Typecheck**

#### Substep 8d — Start-activity emit (fires once per attempt)

- [ ] **Step 1: Locate the first-answer save**

```bash
grep -rn "saveAnswer\|answerMutation" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/assessment | head -20
```

Find where the first answer of a new attempt is saved.

- [ ] **Step 2: Add a guarded one-shot emit**

In the assessment screen component (or the closest shared state for the attempt), add a ref and emit on first save:

```typescript
import { useRef } from "react";
import { track } from "@/lib/activity-tracker";

// ... inside the component:
const startedRef = useRef(false);

const handleAnswerChanged = (...args) => {
  if (!startedRef.current) {
    startedRef.current = true;
    track("start_activity", { activityId: assessmentId });
  }
  // ... existing onChange / save logic ...
};
```

Reset `startedRef.current = false` if the user navigates away and back into a new attempt (often this happens naturally because the component unmounts).

- [ ] **Step 3: Typecheck**

#### Substep 8e — Notification press emit

- [ ] **Step 1: Locate the notification list row press handler**

```bash
grep -rn "onPress" /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/features/notifications | head -20
```

- [ ] **Step 2: Add the emit**

```typescript
import { track } from "@/lib/activity-tracker";
// In the row press handler:
track("open_notification", {
  entityType: notification.entityType,
  entityId: String(notification.entityId),
});
```

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

#### Final 8 — Review and stage

- [ ] **Step 4: Review the five changed files together**

The five explicit emits should be the only behavioural changes; everything else is mechanical wiring. Stage when satisfied.

---

### Task M9: End-to-end smoke verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server (server repo)**

```bash
cd ../classedge-mobile-test
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

- [ ] **Step 2: Start the mobile app**

```bash
cd ../client-mobile
pnpm start:dev
```

Open on a simulator or device. Sign in as a student account.

- [ ] **Step 3: Drive the app through the 12 verbs**

In rough order:

1. Sign in → expect `login`.
2. Open a course/subject from the list → expect `open_subject`.
3. Open an assessment → expect `open_activity`.
4. Answer the first question → expect `start_activity`.
5. Submit → expect `submit_activity`.
6. Open the review screen → expect `view_score` (only if the route is in the registry; if not, defer to a follow-up task).
7. Open a notification → expect `open_notification`.
8. Visit profile → expect `open_profile`.
9. Sign out → expect `logout` + final flush.

(Lesson/announcement/calendar verbs need their routes added to the registry first if not already mapped — see Task M5 step 1.)

- [ ] **Step 4: Inspect the audit dashboard**

Open `/audit/dashboard/` in a browser, logged in as admin. Confirm the new rows appear in the live feed in real time (WebSocket).

- [ ] **Step 5: Test offline behaviour**

1. Turn off device wifi/cellular.
2. Open three different courses (3 × `open_subject`).
3. Check on the server that nothing new shows up.
4. Turn the network back on.
5. Within ~10 seconds, the three rows should appear with `occurred_at` timestamps from while-offline and `created_at` from sync time.

- [ ] **Step 6: Test app-kill recovery**

1. Turn off device wifi.
2. Open a course.
3. Force-quit the app.
4. Reopen, sign back in, turn wifi back on.
5. The pre-kill `open_subject` should still appear.

- [ ] **Step 7: Test dedupe**

1. Manually flush twice in quick succession via the React Native dev menu (or insert a temporary debug button calling `flush()` twice).
2. Confirm the server's response contains `duplicates` entries on the second call.
3. Confirm no duplicate rows exist:

```bash
python manage.py shell -c "
from logs.models import UserActivityLog
from django.db.models import Count
dupes = (UserActivityLog.objects
  .filter(client_event_id__isnull=False)
  .values('client_event_id').annotate(c=Count('id')).filter(c__gt=1))
print(list(dupes))
"
```

Expected: empty list.

Phase B complete.

---

## Phase C — Optional follow-ups

### Task C1 (optional): Introduce Jest for the mobile codebase

**Why optional:** Setting up `jest-expo` with proper mocks for `react-native-mmkv`, `expo-router`, NetInfo, and axios is its own half-day project. The tracker is small and type-driven; manual smoke covers the regressions that matter. If/when other features need unit tests, do this then.

**Files:**
- Modify: `package.json` (add `test` script, devDependencies)
- Create: `jest.config.js`, `jest.setup.ts`
- Create: `lib/activity-tracker/__tests__/queue.test.ts` etc.

Outline (not expanded):
1. Add `jest`, `jest-expo`, `@testing-library/react-native`, `@types/jest` devDependencies.
2. Create `jest.config.js` with the `jest-expo` preset.
3. Add `jest.setup.ts` mocking `react-native-mmkv`, `expo-router`, `react-native/Libraries/AppState/AppState`.
4. Port the manual verifications from M2/M3/M4 into unit tests.
5. Add `pnpm test` script.

### Task C2 (optional): "Occurred at" UI surfacing for offline backfills

If `occurred_at` differs from `created_at` by > 60s, the audit dashboard could show a small "(captured while offline at …)" badge. Server-side template change only.

### Task C3 (optional): Per-action retention

Modify `logs/management/commands/prune_audit_log.py` (or add a sibling command) to keep `submit_activity` / `login` forever and trim `open_*` after 30 days. Only do this once volume is actually a problem.

---

## Self-Review

**Spec coverage check (against `2026-06-15-user-activity-tracking-design.md`):**

| Spec section | Plan task |
|---|---|
| §3 Architecture | Phase A + Phase B together |
| §4 Taxonomy — 4 new actions | Task S2 |
| §5 Wire payload — snake_case fields | Task S3 (serializer), Task M1 (types) |
| §6.1 Model migration | Task S1 |
| §6.2 IngestEventsView | Task S5 |
| §6.3 Decisions (reuse log_user_action, post-insert UPDATE, _safe_get, per-event try/except) | Task S5 (explicit in the implementation block) |
| §6.4 Throttling | Task S4 |
| §6.5 URL | Task S6 |
| §6.6 Serializers | Task S3 |
| §7.1 Mobile module layout | Tasks M1–M6 |
| §7.2 Public API | Task M4 |
| §7.3 Queue + cap + drop counter | Task M2 |
| §7.4 Flush triggers, backoff, NetInfo | Task M3 + M4 |
| §7.5 Nav listener + registry | Tasks M5 + M6 |
| §7.6 Explicit call sites | Task M8 |
| §7.7 Sign-out flush ordering | Task M8b |
| §7.8 Wiring into existing files | Task M7 + M8 |
| §8 Privacy/retention | No new code; documented as-is |
| §9 Failure modes | Covered across S5 (dedupe, _safe_get), M2 (cap+evict), M3 (backoff+offline gate), M9 (smoke) |

No gaps found.

**Placeholder scan:** no "TBD"/"TODO"/"implement appropriately" in the plan. The phrases "see existing pattern" appear once (in Task S6 URL wiring, pointing the reader at the existing `# Mobile` block) — that's a navigation hint, not a placeholder.

**Type consistency check:**
- `PendingEvent.client_event_id` (snake) used in `queue.ts`, `flush.ts`, server serializer, and tests — consistent.
- `track(action, ids?, description?)` signature: `EmitIds.subjectId` (camel on the JS side) → `subject_id` (snake on wire). Conversion happens in `track()` itself (Task M4 step 2) — consistent.
- `IngestResponse.{accepted, duplicates}` returned by server and consumed in `flush.ts` — consistent (note: server returns these snake-case keys but the response interceptor passes them through unchanged since they are already camel-compatible single-word names).
- `_safe_get` defined in `views_mobile.py`, used 3 times in the same file — consistent.
- `_default_description` defined and used once — consistent.

No issues found. Plan ready for execution.
