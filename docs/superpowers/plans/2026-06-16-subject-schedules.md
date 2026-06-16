# Subject Schedules on SubjectDetailsScreen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a "Class Schedule" card to the teacher-side `SubjectDetailsScreen` that mirrors the student-side schedule card in `features/courses/components/CourseDetails.tsx`. New REST endpoint serves the data; new mobile hook + section render it.

**Architecture:** Add `SubjectScheduleView` next to `SubjectTimelineView` in `mobile/views/`, wired in `mobile/urls.py`. Reuse the role-based `_subject_is_visible` helper. Mobile gains a `Schedule` type, a `useSubjectSchedules` hook, and a `ClassScheduleSection` that mounts inside `SubjectDetailsScreen` between the existing info card and Description block.

**Tech Stack:** Django + DRF + JWT (server). React Native + TanStack Query (mobile).

**Test discipline:** Server tasks use Django `TestCase` TDD. Mobile tasks use `pnpm typecheck` + manual smoke.

**Commit policy:** Per user preference, this plan does NOT include `git add` / `git commit`. Stage and commit yourself.

**Repo paths used:**
- Server: `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test`
- Mobile: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile`

---

## Phase A — Server

### Task S1: Failing test for `SubjectScheduleView`

**Files:**
- Create: `mobile/tests/test_subject_schedule_view.py`

- [ ] **Step 1: Write the test module**

```python
from datetime import time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from course.models import Semester
from roles.models import Role
from subject.models import Schedule, Subject

User = get_user_model()


def _jwt_for(user):
    return str(RefreshToken.for_user(user).access_token)


class SubjectScheduleViewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create(username="t1", email="t1@x.test")
        # post_save signal creates a 'Student' profile; promote to Teacher.
        teacher_role, _ = Role.objects.get_or_create(name="Teacher")
        cls.teacher.profile.role = teacher_role
        cls.teacher.profile.save()

        today = timezone.now().date()
        cls.current_semester = Semester.objects.create(
            start_date=today - timedelta(days=30),
            end_date=today + timedelta(days=60),
        )
        cls.past_semester = Semester.objects.create(
            start_date=today - timedelta(days=200),
            end_date=today - timedelta(days=100),
            end_semester=True,
        )

        cls.subject = Subject.objects.create(
            subject_name="Math 101", assign_teacher=cls.teacher,
        )
        cls.other_subject = Subject.objects.create(
            subject_name="Bio 201", assign_teacher=cls.teacher,
        )

        cls.active_schedule = Schedule.objects.create(
            subject=cls.subject,
            schedule_start_time=time(8, 0),
            schedule_end_time=time(9, 30),
            days_of_week=["Mon", "Wed"],
            semester=cls.current_semester,
        )
        cls.inactive_schedule = Schedule.objects.create(
            subject=cls.subject,
            schedule_start_time=time(10, 0),
            schedule_end_time=time(11, 30),
            days_of_week=["Tue"],
            semester=cls.past_semester,
        )
        # Belongs to a different subject; must not leak.
        Schedule.objects.create(
            subject=cls.other_subject,
            schedule_start_time=time(13, 0),
            schedule_end_time=time(14, 30),
            days_of_week=["Fri"],
            semester=cls.current_semester,
        )

        cls.url = f"/api/subject/{cls.subject.id}/schedules/"

    def setUp(self):
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(self.teacher)}")

    def test_returns_200_with_results_key(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("results", resp.data)
        self.assertIsInstance(resp.data["results"], list)

    def test_includes_active_schedule_with_correct_shape(self):
        resp = self.client.get(self.url)
        results = resp.data["results"]
        # Both active and inactive are returned; client filters by isActiveSemester.
        self.assertEqual(len(results), 2)
        active = next(r for r in results if r["id"] == self.active_schedule.id)
        self.assertEqual(active["daysOfWeek"], "Mon,Wed")
        self.assertEqual(active["scheduleStartTime"], "08:00:00")
        self.assertEqual(active["scheduleEndTime"], "09:30:00")
        self.assertEqual(active["isActiveSemester"], 1)

    def test_inactive_schedule_has_isActiveSemester_zero(self):
        resp = self.client.get(self.url)
        results = resp.data["results"]
        inactive = next(r for r in results if r["id"] == self.inactive_schedule.id)
        self.assertEqual(inactive["isActiveSemester"], 0)

    def test_unauthenticated_request_rejected(self):
        self.client.credentials()
        resp = self.client.get(self.url)
        self.assertIn(resp.status_code, (401, 403))

    def test_empty_subject_returns_empty_list(self):
        empty = Subject.objects.create(
            subject_name="Empty", assign_teacher=self.teacher,
        )
        resp = self.client.get(f"/api/subject/{empty.id}/schedules/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["results"], [])

    def test_does_not_leak_other_subjects(self):
        resp = self.client.get(self.url)
        subject_ids_in_response = {self.active_schedule.id, self.inactive_schedule.id}
        returned_ids = {r["id"] for r in resp.data["results"]}
        self.assertEqual(returned_ids, subject_ids_in_response)
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
source venv/bin/activate
python manage.py test mobile.tests.test_subject_schedule_view -v 2
```

Expected: all 6 tests fail with 404 (URL not yet wired).

- [ ] **Step 3: Review and stage**

Changed: new test file. No `git add` / `git commit`.

---

### Task S2: Implement `SubjectScheduleView` + URL

**Files:**
- Create: `mobile/views/subject_schedule_views.py`
- Modify: `mobile/views/__init__.py` (one-line export addition)
- Modify: `mobile/urls.py` (one path entry)

- [ ] **Step 1: Create the view**

Create `mobile/views/subject_schedule_views.py`:

```python
"""Mobile-facing schedules endpoint for a single subject.

Returns recurring weekly schedule slots in a wire shape parallel to the
existing student-side PowerSync schema (CourseDetails consumes the same
fields). Reuses the same role-based visibility helper as the timeline
view — if the user can't see the subject, the result is an empty list
(not 403).
"""
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from mobile.views.subject_timeline_views import _subject_is_visible
from subject.models import Schedule


def _format_days_of_week(value):
    """Schedule.days_of_week is a MultiSelectField — list-like at the ORM
    layer, but stored CSV in the DB. Normalize to a comma-joined string
    so the wire shape matches the student-side PowerSync mirror, which
    is a single text column."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return ",".join(str(v) for v in value)
    except TypeError:
        return str(value)


class SubjectScheduleView(APIView):
    """GET /api/subject/<id>/schedules/

    Response: {"results": [ScheduleItem, ...]}
    """

    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, subject_id):
        if not _subject_is_visible(request.user, subject_id):
            return Response({"results": []})

        schedules = Schedule.objects.filter(subject_id=subject_id)

        items = [
            {
                "id": s.id,
                "daysOfWeek": _format_days_of_week(s.days_of_week),
                "scheduleStartTime": s.schedule_start_time.isoformat()
                    if s.schedule_start_time else None,
                "scheduleEndTime": s.schedule_end_time.isoformat()
                    if s.schedule_end_time else None,
                "isActiveSemester": int(bool(s.is_active_semester)),
            }
            for s in schedules
        ]
        return Response({"results": items})
```

- [ ] **Step 2: Export from the package**

Append to `mobile/views/__init__.py` (matching the existing explicit-import style):

```python
from .subject_schedule_views import SubjectScheduleView
```

and add `SubjectScheduleView` to the `all` list.

- [ ] **Step 3: Wire the URL**

In `mobile/urls.py`, add the path next to `subject-timeline` so related routes stay grouped:

```python
    path('api/subject/<int:subject_id>/schedules/', SubjectScheduleView.as_view(), name='subject-schedules'),
```

- [ ] **Step 4: Verify**

```bash
source venv/bin/activate
python manage.py check
python manage.py shell -c "from django.urls import reverse; print(reverse('subject-schedules', kwargs={'subject_id': 1}))"
python manage.py test mobile.tests.test_subject_schedule_view -v 2
```

Expected:
- `check` clean.
- `reverse(...)` prints `/api/subject/1/schedules/`.
- All 6 tests PASS.

If the test fixture references `Semester(end_semester=True)` and the model doesn't have an `end_semester` field, drop that kwarg and adjust the test accordingly (the `is_active_semester` flag is set on Schedule via its own `save()` override which reads `self.semester.end_semester`; if no such field exists, `is_active_semester` defaults to `True` and the inactive test case won't fire — flag that and stop).

- [ ] **Step 5: Review and stage**

Changed: new view file, 1 line in `__init__.py`, 1 line in `urls.py`. No `git add` / `git commit`.

---

### Task S3: Curl smoke test

**Files:** none (verification only).

- [ ] **Step 1: Ensure the dev server is running**

```bash
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000  # in background if not already up
```

- [ ] **Step 2: Get a teacher JWT** (reuse the shell snippet from the timeline S4):

```bash
python manage.py shell -c "
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from subject.models import Subject, Schedule
s = Subject.objects.filter(schedule__isnull=False).distinct().first() or Subject.objects.first()
u = s.assign_teacher
print('subject_id:', s.id)
print('schedule_count:', Schedule.objects.filter(subject=s).count())
print('access:', RefreshToken.for_user(u).access_token)
"
```

- [ ] **Step 3: Hit the endpoint**

```bash
TOKEN="<paste>"
SID="<paste>"
curl -i -s -X GET "http://localhost:8000/api/subject/$SID/schedules/" \
  -H "Authorization: Bearer $TOKEN" | head -40
```

Expected: `HTTP/1.1 200 OK` and `{"results": [{id, daysOfWeek, scheduleStartTime, scheduleEndTime, isActiveSemester}, ...]}`.

- [ ] **Step 4: Sanity-check unauthenticated**

```bash
curl -i -s -X GET "http://localhost:8000/api/subject/$SID/schedules/" -H "Content-Type: application/json" | head -3
```

Expected: 401.

- [ ] **Step 5: Stage server changes (no commit)**.

Phase A complete.

---

## Phase B — Mobile

### Task M1: Type + API + hook

**Files:**
- Modify: `features/oversight/oversight.type.ts`
- Modify: `features/oversight/oversight.apis.ts`
- Modify: `features/oversight/oversight.hooks.ts`

- [ ] **Step 1: Add the type**

Append to `features/oversight/oversight.type.ts`:

```typescript
export type Schedule = {
  id: number;
  daysOfWeek: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  isActiveSemester: number;
};

export type SchedulesApiResponse = {
  results: Schedule[];
};
```

- [ ] **Step 2: Add the API call**

In `features/oversight/oversight.apis.ts`, extend the existing import line from `./oversight.type` to include `SchedulesApiResponse` (do NOT add a second import line), then append:

```typescript
export const getSubjectSchedules = async (
  subjectId: string,
): Promise<SchedulesApiResponse> => {
  return (await api.get(`/subject/${subjectId}/schedules/`)).data;
};
```

- [ ] **Step 3: Add the hook**

In `features/oversight/oversight.hooks.ts`, extend the existing import from `./oversight.apis` to include `getSubjectSchedules`, then append:

```typescript
export const useSubjectSchedules = (subjectId: string) => {
  return useQuery({
    queryKey: ["subject-schedules", subjectId],
    queryFn: () => getSubjectSchedules(subjectId),
    enabled: !!subjectId,
  });
};
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS aside from the two pre-existing classroom errors.

- [ ] **Step 5: Review and stage** — no commit.

---

### Task M2: `ClassScheduleSection` in `SubjectDetailsScreen`

**Files:**
- Modify: `screens/main/oversight/SubjectDetailsScreen.tsx`

The section mounts BETWEEN the existing info card (Instructor/Room) and the Description block. Active-semester-only filter to match student-side behavior.

- [ ] **Step 1: Add imports**

Extend existing imports in `screens/main/oversight/SubjectDetailsScreen.tsx`:

```typescript
import { useSubjectSchedules } from "@/features/oversight/oversight.hooks";
import type { Schedule } from "@/features/oversight/oversight.type";
```

(`Schedule` will collide with the local-only `Schedule` name if one exists — confirm it doesn't before adding the import. The screen doesn't currently use that name.)

- [ ] **Step 2: Add the section component above the default export**

Above `export default SubjectDetailsScreen;`, add:

```typescript
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatScheduleTime = (value: string | undefined | null): string => {
  if (!value) return "";
  // Server returns "HH:MM:SS"; render as 12-hour with am/pm.
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m.toString().padStart(2, "0");
  return `${h12}:${mm} ${period}`;
};

const ClassScheduleSection = ({ subjectId }: { subjectId: string }) => {
  const accentColor = useThemeColor("accent");
  const { data, isLoading, isError, error, refetch } = useSubjectSchedules(
    subjectId,
  );

  const activeSchedules = (data?.results ?? []).filter(
    (s) => s.isActiveSemester === 1,
  );

  if (isLoading) {
    return (
      <View className="mb-5 bg-surface-secondary rounded-2xl p-4">
        <View className="flex-row items-center mb-3">
          <Skeleton className="w-8 h-8 rounded-full mr-3" />
          <Skeleton className="h-4 w-32 rounded" />
        </View>
        <Skeleton className="h-4 w-3/4 rounded mb-2" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="mb-5 bg-surface-secondary rounded-2xl p-4">
        <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
      </View>
    );
  }

  if (activeSchedules.length === 0) return null;

  return (
    <View className="mb-5 bg-surface-secondary rounded-2xl p-4">
      <View className="flex-row items-center mb-3">
        <View className="w-8 h-8 rounded-full bg-accent-soft items-center justify-center mr-3">
          <Icon name="ClockIcon" size={16} color={accentColor} />
        </View>
        <AppText weight="semibold" className="text-sm">
          Class Schedule
        </AppText>
      </View>

      <View className="gap-2.5">
        {activeSchedules.map((schedule: Schedule) => {
          const days = (schedule.daysOfWeek ?? "")
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean)
            .sort(
              (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
            );
          return (
            <View key={schedule.id} className="flex-row items-center gap-2 flex-wrap">
              <View className="flex-row gap-1 flex-wrap">
                {days.map((d) => (
                  <View
                    key={d}
                    className="px-2 py-0.5 rounded-full bg-accent-soft"
                  >
                    <AppText
                      weight="semibold"
                      className="text-[11px] text-accent uppercase tracking-wider"
                    >
                      {d}
                    </AppText>
                  </View>
                ))}
              </View>
              <AppText className="text-sm text-muted">
                {formatScheduleTime(schedule.scheduleStartTime)} –{" "}
                {formatScheduleTime(schedule.scheduleEndTime)}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
};
```

- [ ] **Step 3: Mount the section in `SubjectDetailsScreen`**

Inside the existing `<View className="w-full max-w-3xl mx-auto px-2.5">` wrapper, mount the section **between the info-rows card and the Description block**. Concretely, immediately AFTER the existing `<View className="bg-surface-secondary rounded-2xl px-4 mb-5">…</View>` block (the Instructor/Room card), and BEFORE the `{!!subjectDescription && (…)}` block, add:

```tsx
<ClassScheduleSection subjectId={subjectId ?? ""} />
```

- [ ] **Step 4: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS aside from the two pre-existing classroom errors.

- [ ] **Step 5: Review and stage** — no commit.

---

### Task M3: Manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Boot the app** (`pnpm start:dev`), sign in as a teacher.

- [ ] **Step 2: Navigate** Oversight tab → tap a subject → tap the info button (top-right of the parallax screen) → land on `SubjectDetailsScreen`.

- [ ] **Step 3: Verify** the new "Class Schedule" card appears between the Instructor/Room card and the Description block. Day pills are in `Mon–Sun` order. Time renders as `8:00 am – 9:30 am` style.

- [ ] **Step 4: Edge cases:**
  - A subject with no active schedules → no card shown (section returns `null`).
  - A subject with multiple active schedules → all rendered, each on its own row.
  - Pull-to-refresh from the parent screen doesn't break (the schedules query refetches independently).

- [ ] **Step 5: Confirm student-side has not regressed** — sign in as a student, open a course, confirm the existing schedule card in `CourseDetails` still works (this task didn't touch student code).

---

## Self-Review

**Spec coverage:**
- New endpoint, role-gated like timeline → Task S2.
- Wire shape parallel to student-side `Schedule` type → Task M1.
- Card UI mirrors `CourseDetails`' schedule card → Task M2.
- Placement: between info-rows card and Description → Task M2 Step 3.

**Placeholder scan:** no TBDs.

**Type consistency:** `Schedule` type defined once in `oversight.type.ts`, consumed by `useSubjectSchedules` and `ClassScheduleSection`. Server emits camelCase keys matching the type field-for-field. `isActiveSemester: 0 | 1` (number) matches both server (`int(bool(...))`) and student-side wire shape.

**Open implementation question:** does `Semester` actually have an `end_semester` field? The test fixture relies on it. If not, drop the kwarg in the inactive-schedule fixture and verify `is_active_semester` defaults appropriately on save. Flag this during S1 if the import fails.
