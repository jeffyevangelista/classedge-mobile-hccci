# Oversight ↔ Courses Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the teacher-side Oversight subject view to mirror the student-side `CourseScreen` (parallax hero + animated nav + merged-by-date timeline), backed by REST. Add a server endpoint that returns the merged timeline. Absorb the Students tab into the existing info screen. See `docs/superpowers/specs/2026-06-16-oversight-courses-parity-design.md`.

**Architecture:** New Django endpoint `GET /api/subject/<id>/timeline/` returns lessons + activities in one merged list using the same wire shape the student SQL union already produces. Mobile extracts the timeline rendering primitives from `CourseTimeline` into a shared `features/timeline/` module, then builds a new `SubjectTimeline` orchestrator and a new parallax `SubjectScreen`. The teacher's `(tabs)/` directory is hard-cut and replaced by a single index route at `/subject/[subjectId]/`.

**Tech Stack:** Django 4.x + DRF + JWT (server, in `../classedge-mobile-test`). React Native 0.81 + expo-router 6 + TanStack Query + heroui-native (mobile, this repo).

**Test discipline:**
- **Server tasks** use Django `TestCase` TDD (failing test → confirm fail → minimal impl → confirm pass).
- **Mobile tasks** use type-driven development + `pnpm typecheck` + `pnpm lint` + manual simulator smoke. The repo has no Jest setup; each mobile task ends with a typecheck + lint pass.

**Commit policy:** Per user preference, this plan does **not** include `git add`/`git commit` commands. Each task ends with a "Review and stage" step describing what changed; you stage and commit yourself.

**Repo paths used in this plan:**
- Server: `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test`
- Mobile: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile`

---

## Phase A — Server (Django, `../classedge-mobile-test`)

Activate the project's venv before running any task: `source venv/bin/activate`.

The new endpoint lives in `mobile/views/` (alongside `subject_lesson_views.py`, `lesson_activity_views.py`, `student_per_subject_views.py`) and is wired in `mobile/urls.py` — **not** in `subject/urls.py`. The spec mentions `subject/views.py` in §4.1; that is incorrect — the actual sibling endpoints (`/api/subject/<id>/lessons/`, `/activities/`, `/students/`) live under the `mobile/` app.

### Task S1: Write the failing test for `SubjectTimelineView`

**Files:**
- Create: `mobile/tests/test_subject_timeline_view.py`

- [ ] **Step 1: Write the test module**

Create `mobile/tests/test_subject_timeline_view.py`:

```python
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from activity.models import Activity
from module.models import Module
from roles.models import Role
from subject.models import Subject

User = get_user_model()


def _jwt_for(user):
    return str(RefreshToken.for_user(user).access_token)


class SubjectTimelineViewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher = User.objects.create(username="t1", email="t1@x.test")
        # A post_save signal on CustomUser auto-creates a Profile with role
        # 'Student'. Promote the test teacher to 'Teacher' so the view's
        # role-based visibility check (mirrored from SubjectLessonListView)
        # treats them as a teacher.
        teacher_role, _ = Role.objects.get_or_create(name="Teacher")
        cls.teacher.profile.role = teacher_role
        cls.teacher.profile.save()

        cls.subject = Subject.objects.create(
            subject_name="Math 101", assign_teacher=cls.teacher,
        )
        cls.other_subject = Subject.objects.create(
            subject_name="Bio 201", assign_teacher=cls.teacher,
        )

        now = timezone.now()
        cls.lesson_ok = Module.objects.create(
            subject=cls.subject,
            file_name="Chapter 1",
            start_date=now - timedelta(days=2),
            end_date=now + timedelta(days=2),
        )
        cls.lesson_missing_end = Module.objects.create(
            subject=cls.subject,
            file_name="Draft Lesson",
            start_date=now - timedelta(days=1),
            end_date=None,
        )
        cls.lesson_missing_start = Module.objects.create(
            subject=cls.subject,
            file_name="Draft Lesson 2",
            start_date=None,
            end_date=now + timedelta(days=1),
        )

        cls.activity_ok = Activity.objects.create(
            subject=cls.subject,
            activity_name="Quiz 1",
            start_time=now - timedelta(days=1),
            end_time=now + timedelta(days=3),
            classroom_mode=False,
        )
        cls.activity_classroom = Activity.objects.create(
            subject=cls.subject,
            activity_name="Drill 1",
            start_time=now,
            end_time=now + timedelta(hours=2),
            classroom_mode=True,
        )
        cls.activity_missing_end = Activity.objects.create(
            subject=cls.subject,
            activity_name="Draft Quiz",
            start_time=now,
            end_time=None,
            classroom_mode=False,
        )
        cls.activity_missing_start = Activity.objects.create(
            subject=cls.subject,
            activity_name="Draft Quiz (no start)",
            start_time=None,
            end_time=now + timedelta(days=2),
            classroom_mode=False,
        )

        # Belongs to a different subject; must NOT leak into responses.
        Module.objects.create(
            subject=cls.other_subject,
            file_name="Other subject lesson",
            start_date=now - timedelta(days=2),
            end_date=now + timedelta(days=2),
        )

        cls.url = f"/api/subject/{cls.subject.id}/timeline/"

    def setUp(self):
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(self.teacher)}")

    def test_returns_200_with_results_key(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("results", resp.data)
        self.assertIsInstance(resp.data["results"], list)

    def test_includes_lessons_with_correct_shape(self):
        resp = self.client.get(self.url)
        materials = [r for r in resp.data["results"] if r["type"] == "material"]
        self.assertEqual(len(materials), 1)
        row = materials[0]
        self.assertEqual(row["id"], str(self.lesson_ok.id))
        self.assertEqual(row["fileName"], "Chapter 1")
        self.assertEqual(row["type"], "material")
        self.assertEqual(row["hasSubmission"], 0)
        self.assertEqual(row["showScore"], 0)
        self.assertEqual(row["maxScore"], 0)
        self.assertEqual(row["totalScore"], 0)
        self.assertEqual(row["classroomMode"], 0)
        self.assertIn("startDate", row)
        self.assertIsNotNone(row["startDate"])

    def test_includes_activities_with_correct_shape(self):
        resp = self.client.get(self.url)
        assessments = [r for r in resp.data["results"] if r["type"] == "assessment"]
        self.assertEqual(len(assessments), 2)
        names = {a["fileName"] for a in assessments}
        self.assertEqual(names, {"Quiz 1", "Drill 1"})

        # Full-shape check on Quiz 1 (parallel to the lessons shape test).
        quiz = next(r for r in assessments if r["fileName"] == "Quiz 1")
        self.assertEqual(quiz["id"], str(self.activity_ok.pk))
        self.assertEqual(quiz["type"], "assessment")
        self.assertEqual(quiz["hasSubmission"], 0)
        self.assertEqual(quiz["showScore"], 0)
        self.assertEqual(quiz["maxScore"], 0)
        self.assertEqual(quiz["totalScore"], 0)
        self.assertEqual(quiz["classroomMode"], 0)
        self.assertIn("startDate", quiz)
        self.assertIsNotNone(quiz["startDate"])

    def test_assessment_startDate_uses_end_time(self):
        resp = self.client.get(self.url)
        quiz = next(r for r in resp.data["results"] if r["fileName"] == "Quiz 1")
        # startDate on assessments is mapped from end_time (due date).
        # We check it matches the activity's end_time to within a second.
        self.assertEqual(
            quiz["startDate"][:19],
            self.activity_ok.end_time.isoformat()[:19],
        )

    def test_classroom_mode_reflects_reality(self):
        resp = self.client.get(self.url)
        quiz = next(r for r in resp.data["results"] if r["fileName"] == "Quiz 1")
        drill = next(r for r in resp.data["results"] if r["fileName"] == "Drill 1")
        self.assertEqual(quiz["classroomMode"], 0)
        self.assertEqual(drill["classroomMode"], 1)

    def test_lesson_missing_date_is_excluded(self):
        resp = self.client.get(self.url)
        names = [r["fileName"] for r in resp.data["results"]]
        self.assertNotIn("Draft Lesson", names)
        self.assertNotIn("Draft Lesson 2", names)

    def test_activity_missing_end_time_is_excluded(self):
        resp = self.client.get(self.url)
        names = [r["fileName"] for r in resp.data["results"]]
        self.assertNotIn("Draft Quiz", names)

    def test_activity_missing_start_time_is_excluded(self):
        resp = self.client.get(self.url)
        names = [r["fileName"] for r in resp.data["results"]]
        self.assertNotIn("Draft Quiz (no start)", names)

    def test_unauthenticated_request_rejected(self):
        self.client.credentials()  # drop auth header
        resp = self.client.get(self.url)
        self.assertIn(resp.status_code, (401, 403))

    def test_empty_subject_returns_empty_list(self):
        empty_subject = Subject.objects.create(
            subject_name="Empty", assign_teacher=self.teacher,
        )
        resp = self.client.get(f"/api/subject/{empty_subject.id}/timeline/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["results"], [])

    def test_does_not_leak_other_subjects(self):
        resp = self.client.get(self.url)
        names = [r["fileName"] for r in resp.data["results"]]
        self.assertNotIn("Other subject lesson", names)
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
python manage.py test mobile.tests.test_subject_timeline_view -v 2
```

Expected: all tests FAIL with `404` (URL not yet wired) or `ImportError`.

- [ ] **Step 3: Review and stage**

Changed: new test file only. Stage when satisfied.

---

### Task S2: Implement `SubjectTimelineView`

**Files:**
- Create: `mobile/views/subject_timeline_views.py`
- Modify: `mobile/views/__init__.py` (export the new view alongside siblings)

- [ ] **Step 1: Confirm the existing `__init__.py` export pattern**

```bash
cat mobile/views/__init__.py
```

You'll see lines like `from .subject_lesson_views import *` for each sibling. Confirm before you add a parallel entry.

- [ ] **Step 2: Implement the view**

Create `mobile/views/subject_timeline_views.py`:

```python
"""Mobile-facing merged timeline endpoint for a single subject.

Returns lessons + activities in one shot using the same wire shape the
student-side SQL union produces (see CourseTimeline). Student-specific
score fields (hasSubmission, showScore, maxScore, totalScore) are zeroed
because the teacher view has no per-student state to show.

Role-based access mirrors the sibling endpoints
(SubjectLessonListView, LessonActivityListView): teachers see only the
subjects they teach, students see only the ones they're enrolled in.
Outside that, the queryset is empty — no 403.
"""
from django.db.models import Q
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from activity.models import Activity
from course.models import SubjectEnrollment
from module.models import Module
from subject.models import Subject


def _user_role_name(user):
    return (
        getattr(getattr(getattr(user, "profile", None), "role", None), "name", "") or ""
    ).lower()


def _subject_is_visible(user, subject_id):
    """Return True if the user is allowed to see this subject under the
    same rules the sibling lessons/activities views apply. Used to gate
    the entire response (so we never return mixed-permission rows).
    """
    role = _user_role_name(user)
    if role == "teacher":
        return Subject.objects.filter(
            Q(pk=subject_id),
            Q(assign_teacher=user)
            | Q(substitute_teacher=user, allow_substitute_teacher=True)
            | Q(collaborators=user),
        ).exists()
    if role == "student":
        return SubjectEnrollment.objects.filter(
            subject_id=subject_id, student=user,
        ).exists()
    # Other authenticated users (admin, registrar, etc.) — match sibling
    # behavior: allow read.
    return True


class SubjectTimelineView(APIView):
    """GET /api/subject/<id>/timeline/

    Response: {"results": [TimelineItem, ...]}
    """

    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, subject_id):
        if not _subject_is_visible(request.user, subject_id):
            return Response({"results": []})

        lessons = Module.objects.filter(
            subject_id=subject_id,
            start_date__isnull=False,
            end_date__isnull=False,
        ).values_list("id", "file_name", "start_date")

        activities = Activity.objects.filter(
            subject_id=subject_id,
            start_time__isnull=False,
            end_time__isnull=False,
        ).values_list("local_id", "activity_name", "end_time", "classroom_mode")
        # NOTE: Activity's PK is `local_id` (cuid CharField), not `id` — using
        # `"id"` here would raise FieldError. See activity/models/activity_model.py.

        items = [
            {
                "id": str(lid),
                "fileName": name,
                "startDate": start.isoformat(),
                "type": "material",
                "hasSubmission": 0,
                "showScore": 0,
                "maxScore": 0,
                "totalScore": 0,
                "classroomMode": 0,
            }
            for lid, name, start in lessons
        ] + [
            {
                "id": str(aid),
                "fileName": name,
                "startDate": end.isoformat(),
                "type": "assessment",
                "hasSubmission": 0,
                "showScore": 0,
                "maxScore": 0,
                "totalScore": 0,
                "classroomMode": 1 if cm else 0,
            }
            for aid, name, end, cm in activities
        ]
        return Response({"results": items})
```

- [ ] **Step 3: Export the new view from the package**

Append to `mobile/views/__init__.py` (following the same pattern as the siblings):

```python
from .subject_timeline_views import *  # noqa: F401,F403
```

If `__init__.py` uses explicit re-exports (not wildcard), append `from .subject_timeline_views import SubjectTimelineView` instead and add it to `__all__` if one is defined.

- [ ] **Step 4: Quick syntax check (the URL is still missing, so tests will still fail on 404)**

```bash
python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 5: Review and stage**

Changed: new `mobile/views/subject_timeline_views.py`, 1-line addition to `mobile/views/__init__.py`. Stage when satisfied.

---

### Task S3: Wire URL in `mobile/urls.py`

**Files:**
- Modify: `mobile/urls.py` (add one path entry under the Subjects block)

- [ ] **Step 1: Add the URL**

Edit `mobile/urls.py`. Find the existing `# Subjects` block (around line 26). Add the new endpoint **next to its siblings** so the related routes stay together:

```python
    # Subjects
    path("api/subject/<int:subject_id>/students/", StudentsPerSubjectView.as_view(), name="subject-enrollments"),
    path('api/subject/<int:id>/', SubjectEnrollmentRetrieveView.as_view(), name='subjects'),
    path('api/subject/<int:subject_id>/lessons/', SubjectLessonListView.as_view(), name='lessons'),
    path('api/subject/<int:subject_id>/activities/', LessonActivityListView.as_view(), name='lesson-activities'),
    path('api/subject/<int:subject_id>/timeline/', SubjectTimelineView.as_view(), name='subject-timeline'),  # NEW
    path('api/subject/lessons/activities/<int:subject_id>/', StudentActivityListView.as_view(), name='submit-activity'),
```

(The `from mobile.views import *` at the top of `mobile/urls.py` already exposes `SubjectTimelineView` because Task S2 added it to the package's `__init__.py`.)

- [ ] **Step 2: Confirm the URL resolves**

```bash
python manage.py shell -c "from django.urls import reverse; print(reverse('subject-timeline', kwargs={'subject_id': 1}))"
```

Expected: `/api/subject/1/timeline/`.

- [ ] **Step 3: Run the tests**

```bash
python manage.py test mobile.tests.test_subject_timeline_view -v 2
```

Expected: all 10 tests PASS.

If `test_unauthenticated_request_rejected` returns 200 instead of 401/403, confirm `JWTAuthentication` is listed first in `authentication_classes` (matching the siblings).

If `test_assessment_startDate_uses_end_time` fails due to timezone formatting, verify the test's `[:19]` truncation matches both sides (the comparison drops fractional seconds and timezone suffix). Adjust the slice if your `isoformat()` output differs.

- [ ] **Step 4: Review and stage**

Changed: 1-line addition to `mobile/urls.py`. Stage when satisfied.

---

### Task S4: Curl smoke test against running dev server

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server in one terminal**

```bash
python manage.py runserver 0.0.0.0:8000
```

- [ ] **Step 2: Obtain a JWT for a real teacher user**

```bash
python manage.py shell -c "
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from subject.models import Subject
s = Subject.objects.first()
u = s.assign_teacher
print('subject_id:', s.id)
print('teacher:', u.email, 'id:', u.id)
print('access:', RefreshToken.for_user(u).access_token)
"
```

Copy the access token and the subject id.

- [ ] **Step 3: Hit the new endpoint**

```bash
TOKEN="<paste access token>"
SID="<paste subject id>"
curl -i -s -X GET "http://localhost:8000/api/subject/$SID/timeline/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -40
```

Expected: `HTTP/1.1 200 OK` and a body shaped like `{"results": [{"id": "...", "fileName": "...", "startDate": "...", "type": "material", ...}, ...]}`.

- [ ] **Step 4: Sanity-check with a non-member user**

In the shell, find a user who is neither a teacher nor an enrollee of that subject and re-issue the curl with that user's token. Expected: `{"results": []}` (not 403).

- [ ] **Step 5: Review and stage**

No code changes — verification only. Phase A complete.

---

## Phase B — Mobile (React Native, `client-mobile/`)

Verification toolchain: `pnpm typecheck` and `pnpm lint`. Manual runtime verification on a simulator at the end.

### Task M1: Add type, API call, and hook for the timeline

**Files:**
- Modify: `features/oversight/oversight.type.ts`
- Modify: `features/oversight/oversight.apis.ts`
- Modify: `features/oversight/oversight.hooks.ts`

- [ ] **Step 1: Add the wire-shape type**

Append to `features/oversight/oversight.type.ts`:

```typescript
export type TimelineItem = {
  id: string;
  fileName: string;
  startDate: string;
  type: "material" | "assessment";
  hasSubmission: number;
  showScore: number;
  maxScore: number;
  totalScore: number;
  classroomMode: number;
};

export type TimelineApiResponse = {
  results: TimelineItem[];
};
```

- [ ] **Step 2: Add the API call**

Append to `features/oversight/oversight.apis.ts`:

```typescript
import { TimelineApiResponse } from "./oversight.type";
```

(merge with the existing import if the file already imports from `./oversight.type`)

```typescript
export const getSubjectTimeline = async (
  subjectId: string,
): Promise<TimelineApiResponse> => {
  return (await api.get(`/subject/${subjectId}/timeline/`)).data;
};
```

- [ ] **Step 3: Add the hook**

Append to `features/oversight/oversight.hooks.ts`:

```typescript
// merge into existing import
import { getSubjectTimeline } from "./oversight.apis";

export const useSubjectTimeline = (subjectId: string) => {
  return useQuery({
    queryKey: ["subject-timeline", subjectId],
    queryFn: () => getSubjectTimeline(subjectId),
    enabled: !!subjectId,
  });
};
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Review and stage**

Changed: 3 files, all additive. Stage when satisfied.

---

### Task M2: Extract shared timeline primitives into `features/timeline/`

**Files:**
- Create: `features/timeline/types.ts`
- Create: `features/timeline/bucketize.ts`
- Create: `features/timeline/components/TimelineFilterChips.tsx`
- Create: `features/timeline/components/TimelineRow.tsx`
- Create: `features/timeline/components/TimelineSkeleton.tsx`

This task adds the new module **alongside** the existing `CourseTimeline.tsx`. The next task (M3) refactors `CourseTimeline.tsx` to consume the new primitives. Splitting it this way means the student-side keeps working continuously.

- [ ] **Step 1: Create `features/timeline/types.ts`**

```typescript
export type TimelineItem = {
  id: string;
  fileName: string;
  startDate: string;
  type: "material" | "assessment";
  hasSubmission: number;
  showScore: number;
  maxScore: number;
  totalScore: number;
  classroomMode: number;
};

export type Filter = "all" | "assessment" | "material";

export type BucketKey = "upcoming" | "today" | "thisWeek" | "earlier";

export type TimelineRowHighlight = "today" | "due-soon" | "overdue";
```

- [ ] **Step 2: Create `features/timeline/bucketize.ts`**

Lifted verbatim from the current `CourseTimeline.tsx:30-65`:

```typescript
import dayjs from "dayjs";
import type { BucketKey, TimelineItem } from "./types";

export const BUCKET_ORDER: { key: BucketKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This Week" },
  { key: "earlier", label: "Earlier" },
];

export const bucketize = (
  items: TimelineItem[],
): Record<BucketKey, TimelineItem[]> => {
  const today = dayjs().startOf("day");
  const weekCutoff = today.subtract(6, "day");
  const buckets: Record<BucketKey, TimelineItem[]> = {
    upcoming: [],
    today: [],
    thisWeek: [],
    earlier: [],
  };
  for (const item of items) {
    const d = dayjs(item.startDate).startOf("day");
    if (d.isAfter(today)) buckets.upcoming.push(item);
    else if (d.isSame(today)) buckets.today.push(item);
    else if (!d.isBefore(weekCutoff)) buckets.thisWeek.push(item);
    else buckets.earlier.push(item);
  }
  buckets.upcoming.sort(
    (a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  for (const k of ["today", "thisWeek", "earlier"] as const) {
    buckets[k].sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );
  }
  return buckets;
};
```

- [ ] **Step 3: Create `features/timeline/components/TimelineFilterChips.tsx`**

Lifted from `CourseTimeline.tsx:158-201`, generalized to take its `counts` map directly:

```typescript
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import type { Filter } from "../types";

type Props = {
  value: Filter;
  onChange: (next: Filter) => void;
  counts: Record<Filter, number>;
};

const OPTIONS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "assessment", label: "Assessments" },
  { key: "material", label: "Materials" },
];

export const TimelineFilterChips = ({ value, onChange, counts }: Props) => {
  return (
    <View className="w-full max-w-3xl mx-auto px-2 mb-3 flex-row gap-2">
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${opt.label}, ${counts[opt.key]} items`}
            accessibilityState={{ selected: active }}
            android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
            className={`px-3 py-1.5 rounded-full active:opacity-80 ${
              active ? "bg-accent" : "bg-surface-secondary border border-border"
            }`}
          >
            <AppText
              weight="semibold"
              className={`text-xs ${
                active ? "text-accent-foreground" : "text-foreground"
              }`}
            >
              {opt.label} · {counts[opt.key]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
};
```

- [ ] **Step 4: Create `features/timeline/components/TimelineRow.tsx`**

Generalized from `CourseTimeline.tsx:203-306`. Owns icon, title, date label, layout, accessibility. Accepts:
- `item` — the timeline item.
- `onPress` — push handler.
- `dateLabel` — caller decides "Due …" vs "Posted …" prefix.
- `highlightVariant` — caller decides if this row gets a colored border.
- `badges` — caller-rendered React node placed after the date label.

```typescript
import { Pressable, View } from "react-native";
import { Card, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import type { TimelineItem, TimelineRowHighlight } from "../types";

type Props = {
  item: TimelineItem;
  onPress: () => void;
  dateLabel: string;
  highlightVariant?: TimelineRowHighlight;
  badges?: React.ReactNode;
};

export const TimelineRow = ({
  item,
  onPress,
  dateLabel,
  highlightVariant,
  badges,
}: Props) => {
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");
  const isAssessment = item.type === "assessment";

  const iconName = isAssessment ? "PencilLineIcon" : "BookOpenTextIcon";
  const iconColor = isAssessment ? accentColor : mutedColor;
  const iconBgClass = isAssessment ? "bg-accent-soft" : "bg-surface-secondary";

  const borderClass =
    highlightVariant === "today" || highlightVariant === "due-soon"
      ? "border-accent"
      : "border-border";

  const accessibilityLabel = `Open ${
    isAssessment ? "assessment" : "material"
  }: ${item.fileName}${highlightVariant === "overdue" ? " (overdue)" : ""}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="w-full max-w-3xl mx-auto active:opacity-80 rounded-xl overflow-hidden mb-1"
    >
      <Card
        className={`rounded-xl flex-row items-center gap-3 shadow-none border ${borderClass}`}
      >
        <View className={`p-2 rounded-full ${iconBgClass}`}>
          <Icon name={iconName} size={24} color={iconColor} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.fileName}
          </AppText>
          <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
            <AppText className="text-xs text-muted">{dateLabel}</AppText>
            {badges}
          </View>
        </View>
      </Card>
    </Pressable>
  );
};
```

- [ ] **Step 5: Create `features/timeline/components/TimelineSkeleton.tsx`**

Lifted from `CourseTimeline.tsx:308-337`:

```typescript
import { View } from "react-native";
import { Card, Skeleton } from "heroui-native";

export const TimelineSkeleton = () => {
  return (
    <View className="mt-5">
      <View className="w-full max-w-3xl mx-auto px-2 mb-3 flex-row gap-2">
        <Skeleton className="h-7 w-12 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </View>
      <View className="w-full max-w-3xl mx-auto px-3 mb-1">
        <Skeleton className="h-3 w-20 rounded" />
      </View>
      {Array(5)
        .fill(0)
        .map((_, index) => (
          <View key={index} className="w-full max-w-3xl mx-auto">
            <Card className="rounded-xl flex-row items-center gap-3 shadow-none border border-border mb-1">
              <Skeleton className="w-10 h-10 rounded-full" />
              <View className="flex-1 gap-1.5">
                <Skeleton className="h-5 w-3/4 rounded" />
                <View className="flex-row items-center gap-1.5">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </View>
              </View>
            </Card>
          </View>
        ))}
    </View>
  );
};
```

- [ ] **Step 6: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS. Note: the new files have no consumers yet (Task M3 wires them in); they must still type-check standalone.

- [ ] **Step 7: Review and stage**

Changed: 5 new files under `features/timeline/`. No existing files touched. Stage when satisfied.

---

### Task M3: Refactor `CourseTimeline.tsx` to consume the shared primitives

**Files:**
- Modify: `features/courses/components/CourseTimeline.tsx`

The student-side `CourseTimeline` swaps inlined bucketize/chips/row/skeleton for imports from `features/timeline/`. Student-specific badge logic and the highlight rules stay in this file.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `features/courses/components/CourseTimeline.tsx` with:

```typescript
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";
import { AppText } from "@/components/AppText";
import { useCourseTimeline } from "../courses.hooks";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/utils/formatDate";
import {
  BUCKET_ORDER,
  bucketize,
} from "@/features/timeline/bucketize";
import type {
  BucketKey,
  Filter,
  TimelineItem,
  TimelineRowHighlight,
} from "@/features/timeline/types";
import { TimelineFilterChips } from "@/features/timeline/components/TimelineFilterChips";
import { TimelineRow } from "@/features/timeline/components/TimelineRow";
import { TimelineSkeleton } from "@/features/timeline/components/TimelineSkeleton";

const CourseTimeline = () => {
  const { courseId } = useLocalSearchParams();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, isError, error } = useCourseTimeline(
    courseId as string,
  );

  const items = (data as TimelineItem[] | undefined) ?? [];

  const filtered = useMemo(
    () =>
      filter === "all" ? items : items.filter((item) => item.type === filter),
    [items, filter],
  );

  const buckets = useMemo(() => bucketize(filtered), [filtered]);

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: items.length,
      assessment: items.filter((i) => i.type === "assessment").length,
      material: items.filter((i) => i.type === "material").length,
    }),
    [items],
  );

  if (isLoading) return <TimelineSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="FolderOpenIcon"
        title="No content yet"
        description="No content found for this course"
      />
    );
  }

  const visibleBuckets = BUCKET_ORDER.filter(
    ({ key }) => buckets[key].length > 0,
  );

  return (
    <View className="mt-5">
      <TimelineFilterChips value={filter} onChange={setFilter} counts={counts} />

      {visibleBuckets.length === 0 ? (
        <View className="items-center">
          <EmptyState
            icon="FolderOpenIcon"
            title="No matching content"
            description="Try a different filter"
          />
          <Pressable
            onPress={() => setFilter("all")}
            accessibilityRole="button"
            accessibilityLabel="Show all items"
            className="mt-2 px-4 py-2 rounded-full bg-accent-soft active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-accent">
              Show all
            </AppText>
          </Pressable>
        </View>
      ) : (
        visibleBuckets.map(({ key, label }) => (
          <View key={key} className="mb-4">
            <View className="w-full max-w-3xl mx-auto px-3 mb-1">
              <AppText
                weight="semibold"
                className="text-xs uppercase tracking-wider text-muted"
              >
                {label} · {buckets[key].length}
              </AppText>
            </View>
            {buckets[key].map((item) => (
              <StudentRow key={`${item.id}-${item.type}`} item={item} bucket={key} />
            ))}
          </View>
        ))
      )}
    </View>
  );
};

// Student-side row: composes the shared TimelineRow with submission-state
// badges, "due-soon" / "today" / "overdue" highlight rules, and the
// student routes (/material, /assessment).
const StudentRow = ({
  item,
  bucket,
}: {
  item: TimelineItem;
  bucket: BucketKey;
}) => {
  const router = useRouter();
  const isAssessment = item.type === "assessment";
  const formattedDate = formatDate(item.startDate, isAssessment);
  const dateLabel = isAssessment
    ? `Due ${formattedDate}`
    : `Posted ${formattedDate}`;

  const isClassroomActivity = isAssessment && !!item.classroomMode;
  const isOverdue =
    isAssessment &&
    !isClassroomActivity &&
    !item.hasSubmission &&
    new Date(item.startDate).getTime() < Date.now();

  const dueSoon =
    bucket === "upcoming" &&
    isAssessment &&
    !item.hasSubmission &&
    !isClassroomActivity &&
    dayjs(item.startDate).diff(dayjs(), "day") <= 3;

  let highlightVariant: TimelineRowHighlight | undefined;
  if (isOverdue) highlightVariant = "overdue";
  else if (bucket === "today" || dueSoon) highlightVariant = "today";

  const badges = isClassroomActivity ? (
    <View className="px-2 py-0.5 rounded-full bg-accent-soft">
      <AppText weight="semibold" className="text-[10px] text-accent">
        {item.hasSubmission && item.showScore
          ? `In class · ${item.totalScore}/${item.maxScore}`
          : "In class"}
      </AppText>
    </View>
  ) : item.hasSubmission ? (
    <View className="px-2 py-0.5 rounded-full bg-accent-soft">
      <AppText weight="semibold" className="text-[10px] text-accent">
        {item.showScore
          ? `Submitted · ${item.totalScore}/${item.maxScore}`
          : "Submitted"}
      </AppText>
    </View>
  ) : isOverdue ? (
    <View className="px-2 py-0.5 rounded-full bg-danger-soft">
      <AppText weight="semibold" className="text-[10px] text-danger">
        Overdue
      </AppText>
    </View>
  ) : null;

  const handlePress = () => {
    router.push(
      isAssessment ? `/assessment/${item.id}` : `/material/${item.id}`,
    );
  };

  return (
    <TimelineRow
      item={item}
      onPress={handlePress}
      dateLabel={dateLabel}
      highlightVariant={highlightVariant}
      badges={badges}
    />
  );
};

export default CourseTimeline;
```

- [ ] **Step 2: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Smoke-verify the student side hasn't regressed**

Boot the app:

```bash
pnpm start:dev
```

Sign in as a student. Open a course. Confirm:
1. The timeline still loads and renders date buckets identical to before.
2. Filter chips still toggle and counts are right.
3. Tapping an assessment row pushes to `/assessment/<id>`.
4. Tapping a material row pushes to `/material/<id>`.
5. The "Submitted · X/Y" badge appears for submitted items.
6. An overdue assessment shows the red "Overdue" badge.
7. A row in the "Today" bucket has an accent-colored border.

If anything looks off, diff against the pre-refactor state — the refactor is purely mechanical.

- [ ] **Step 4: Review and stage**

Changed: `features/courses/components/CourseTimeline.tsx` (replaced). Stage when satisfied.

---

### Task M4: Create `SubjectTimeline` (teacher orchestrator)

**Files:**
- Create: `features/oversight/components/SubjectTimeline.tsx`

- [ ] **Step 1: Implement the orchestrator**

Create `features/oversight/components/SubjectTimeline.tsx`:

```typescript
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText } from "@/components/AppText";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/utils/formatDate";
import { useSubjectTimeline } from "../oversight.hooks";
import {
  BUCKET_ORDER,
  bucketize,
} from "@/features/timeline/bucketize";
import type {
  Filter,
  TimelineItem,
  TimelineRowHighlight,
} from "@/features/timeline/types";
import { TimelineFilterChips } from "@/features/timeline/components/TimelineFilterChips";
import { TimelineRow } from "@/features/timeline/components/TimelineRow";
import { TimelineSkeleton } from "@/features/timeline/components/TimelineSkeleton";

const SubjectTimeline = () => {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, isError, error } = useSubjectTimeline(
    subjectId ?? "",
  );

  const items = data?.results ?? [];

  const filtered = useMemo(
    () =>
      filter === "all" ? items : items.filter((i) => i.type === filter),
    [items, filter],
  );

  const buckets = useMemo(() => bucketize(filtered), [filtered]);

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: items.length,
      assessment: items.filter((i) => i.type === "assessment").length,
      material: items.filter((i) => i.type === "material").length,
    }),
    [items],
  );

  if (isLoading) return <TimelineSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="FolderOpenIcon"
        title="No content yet"
        description="No materials or activities published yet"
      />
    );
  }

  const visibleBuckets = BUCKET_ORDER.filter(
    ({ key }) => buckets[key].length > 0,
  );

  return (
    <View className="mt-5">
      <TimelineFilterChips value={filter} onChange={setFilter} counts={counts} />

      {visibleBuckets.length === 0 ? (
        <View className="items-center">
          <EmptyState
            icon="FolderOpenIcon"
            title="No matching content"
            description="Try a different filter"
          />
          <Pressable
            onPress={() => setFilter("all")}
            accessibilityRole="button"
            accessibilityLabel="Show all items"
            className="mt-2 px-4 py-2 rounded-full bg-accent-soft active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-accent">
              Show all
            </AppText>
          </Pressable>
        </View>
      ) : (
        visibleBuckets.map(({ key, label }) => (
          <View key={key} className="mb-4">
            <View className="w-full max-w-3xl mx-auto px-3 mb-1">
              <AppText
                weight="semibold"
                className="text-xs uppercase tracking-wider text-muted"
              >
                {label} · {buckets[key].length}
              </AppText>
            </View>
            {buckets[key].map((item) => (
              <TeacherRow
                key={`${item.id}-${item.type}`}
                item={item}
                isToday={key === "today"}
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
};

// Teacher-side row: routes to /lesson or /activity, surfaces only the
// "In class" pill for classroomMode activities, and uses the "today"
// highlight when the bucket is "today". No per-student state.
const TeacherRow = ({
  item,
  isToday,
}: {
  item: TimelineItem;
  isToday: boolean;
}) => {
  const router = useRouter();
  const isAssessment = item.type === "assessment";
  const isClassroomActivity = isAssessment && !!item.classroomMode;
  const formattedDate = formatDate(item.startDate, isAssessment);
  const dateLabel = isAssessment
    ? `Due ${formattedDate}`
    : `Posted ${formattedDate}`;

  const highlightVariant: TimelineRowHighlight | undefined = isToday
    ? "today"
    : undefined;

  const badges = isClassroomActivity ? (
    <View className="px-2 py-0.5 rounded-full bg-accent-soft">
      <AppText weight="semibold" className="text-[10px] text-accent">
        In class
      </AppText>
    </View>
  ) : null;

  const handlePress = () => {
    router.push(
      isAssessment ? `/activity/${item.id}` : `/lesson/${item.id}`,
    );
  };

  return (
    <TimelineRow
      item={item}
      onPress={handlePress}
      dateLabel={dateLabel}
      highlightVariant={highlightVariant}
      badges={badges}
    />
  );
};

export default SubjectTimeline;
```

- [ ] **Step 2: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Review and stage**

Changed: 1 new file. Stage when satisfied.

---

### Task M5: Create `SubjectScreen` (parallax)

**Files:**
- Create: `screens/main/oversight/SubjectScreen.tsx`

- [ ] **Step 1: Implement the parallax screen**

Create `screens/main/oversight/SubjectScreen.tsx`. The structure mirrors `screens/main/courses/course/CourseScreen.tsx`; the differences are listed inline in comments.

```typescript
import { AppText } from "@/components/AppText";
import BackButton from "@/components/BackButton";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { useGetSubject, useSubjectTimeline } from "@/features/oversight/oversight.hooks";
import SubjectTimeline from "@/features/oversight/components/SubjectTimeline";
import { getApiErrorMessage } from "@/lib/api-error";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { useCallback, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NAV_HEIGHT = 56;

const SubjectScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const IMAGE_HEIGHT = Math.round(screenHeight * 0.28);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const subjectQuery = useGetSubject(subjectId ?? "");
  const timelineQuery = useSubjectTimeline(subjectId ?? "");

  const surfaceColor = useThemeColor("surface");
  const foregroundColor = useThemeColor("foreground");
  const borderColor = useThemeColor("border");

  // Pull-to-refresh refetches BOTH the subject metadata AND the timeline
  // in parallel — diverges from CourseScreen, which only refetches the
  // PowerSync-watched details query (the watch covers the timeline).
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([subjectQuery.refetch(), timelineQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [subjectQuery, timelineQuery]);

  const refreshControl = useMemo(
    () => <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />,
    [refreshing, onRefresh],
  );

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transformOrigin: "top",
    transform: [
      {
        scale: interpolate(
          scrollOffset.value,
          [-IMAGE_HEIGHT, 0],
          [1.5, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const navBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [0, IMAGE_HEIGHT],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const navTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [IMAGE_HEIGHT, IMAGE_HEIGHT + 30],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const floatingBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [0, IMAGE_HEIGHT],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.container} className="bg-background">
      {/* Animated Navigation Bar */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top,
          height: insets.top + NAV_HEIGHT,
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: surfaceColor,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: borderColor,
            },
            navBgStyle,
          ]}
        />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
          }}
        >
          <View>
            <Animated.View
              style={[styles.floatingBtn, floatingBtnStyle]}
              className="bg-white/70 dark:bg-black/50"
            />
            <View className="w-10 h-10 rounded-full flex justify-center items-center">
              <BackButton tintColor={foregroundColor} />
            </View>
          </View>
          <Animated.View
            style={[{ flex: 1, marginHorizontal: 4 }, navTitleStyle]}
          >
            <AppText
              weight="semibold"
              className="text-lg text-foreground"
              numberOfLines={1}
            >
              {subjectQuery.data?.subjectName ?? ""}
            </AppText>
          </Animated.View>
          <View>
            <Animated.View
              style={[styles.floatingBtn, floatingBtnStyle]}
              className="bg-white/70 dark:bg-black/50"
            />
            <Pressable
              onPress={() =>
                router.push(`/subject/${subjectId}/subject-details`)
              }
              accessibilityRole="button"
              accessibilityLabel="Open subject details"
              android_ripple={{
                color: "rgba(0,0,0,0.1)",
                borderless: true,
              }}
              hitSlop={4}
              className="w-10 h-10 rounded-full flex justify-center items-center active:opacity-70"
            >
              <Icon
                name="InfoIcon"
                size={22}
                color={foregroundColor}
                style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Parallax ScrollView */}
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={1}
        refreshControl={refreshControl}
      >
        <Animated.View
          style={[
            styles.imageHeader,
            { height: IMAGE_HEIGHT },
            headerAnimatedStyle,
          ]}
          className="bg-default"
        >
          {subjectQuery.isLoading ? (
            <Skeleton style={StyleSheet.absoluteFill} />
          ) : (
            <Image
              source={
                subjectQuery.data?.subjectPhoto
                  ? { uri: subjectQuery.data.subjectPhoto }
                  : require("@/assets/placeholder/bg-placeholder.png")
              }
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="disk"
            />
          )}
        </Animated.View>

        <View style={styles.content} className="bg-background">
          {subjectQuery.isLoading ? (
            <View className="gap-4">
              <View className="gap-2">
                <Skeleton className="h-6 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-1/3 rounded-full" />
              </View>
            </View>
          ) : subjectQuery.isError ? (
            <ErrorComponent message={getApiErrorMessage(subjectQuery.error)} />
          ) : (
            <View className="gap-1">
              <AppText
                weight="semibold"
                className="text-lg md:text-xl text-foreground leading-snug"
              >
                {subjectQuery.data?.subjectName}
              </AppText>
              {subjectQuery.data?.subjectType && (
                <AppText className="text-xs md:text-sm text-muted">
                  {subjectQuery.data.subjectType}
                </AppText>
              )}
            </View>
          )}
          <SubjectTimeline />
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageHeader: {
    overflow: "hidden",
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 24,
    gap: 16,
    overflow: "hidden",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    minHeight: "100%",
  },
  floatingBtn: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
  },
});

export default SubjectScreen;
```

**Differences from `CourseScreen.tsx` to verify after writing:**
- Param: `subjectId` (not `courseId`).
- Subject query: `useGetSubject` (REST), not `useCourseDetails`.
- Hero `Image` uses `{ uri }` with placeholder fallback — no `AttachmentImage` (the teacher subject photo is a raw REST URL).
- Title binding: `subjectQuery.data?.subjectName` (not `data?.subjectId.subjectName`).
- Info-button route: `/subject/${subjectId}/subject-details` (not `/course/${courseId}/course-details`).
- Body: `<SubjectTimeline/>` (not `<CourseTimeline/>`).
- `onRefresh` fires `subjectQuery.refetch()` AND `timelineQuery.refetch()` in parallel.

- [ ] **Step 2: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS. (Routes don't exist yet — that's Task M6. The router types are loose enough that `router.push('/subject/...')` typechecks regardless.)

- [ ] **Step 3: Review and stage**

Changed: 1 new file. Stage when satisfied.

---

### Task M6: Wire the new route layout and delete the `(tabs)/` directory

**Files:**
- Create: `app/(main)/subject/[subjectId]/_layout.tsx`
- Create: `app/(main)/subject/[subjectId]/index.tsx`
- Delete: `app/(main)/subject/[subjectId]/(tabs)/_layout.tsx`
- Delete: `app/(main)/subject/[subjectId]/(tabs)/index.tsx`
- Delete: `app/(main)/subject/[subjectId]/(tabs)/courseworks.tsx`
- Delete: `app/(main)/subject/[subjectId]/(tabs)/students.tsx`
- Keep unchanged: `app/(main)/subject/[subjectId]/subject-details.tsx` (the existing file just imports `SubjectDetailsScreen`)

- [ ] **Step 1: Create the new layout**

Create `app/(main)/subject/[subjectId]/_layout.tsx` (near-copy of `course/[courseId]/_layout.tsx`):

```typescript
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import BackButton from "@/components/BackButton";
import { Platform, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const SubjectLayout = () => {
  const { subjectId } = useLocalSearchParams();
  const router = useRouter();
  const headerOptions = useThemedHeaderOptions();

  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerTitle: "",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          headerRight: ({ tintColor }) => (
            <Pressable
              onPress={() =>
                router.push(`/(main)/subject/${subjectId}/subject-details`)
              }
              className="w-9 h-9 rounded-full flex justify-center items-center"
            >
              <Icon
                name="InfoIcon"
                color={tintColor}
                style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
              />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="subject-details"
        options={{
          headerTitle: "Subject Details",
        }}
      />
    </Stack>
  );
};

export default SubjectLayout;
```

- [ ] **Step 2: Create the new index route**

Create `app/(main)/subject/[subjectId]/index.tsx`:

```typescript
import SubjectScreen from "@/screens/main/oversight/SubjectScreen";

const SubjectRoute = () => {
  return <SubjectScreen />;
};

export default SubjectRoute;
```

- [ ] **Step 3: Delete the `(tabs)/` directory entirely**

```bash
rm -rf "app/(main)/subject/[subjectId]/(tabs)"
```

- [ ] **Step 4: Confirm nothing else links into the removed paths**

```bash
```
Use the Grep tool:
- pattern: `subject/\[subjectId\]/\(tabs\)` (literal — looking for any code or doc that still references the old tab paths)
- pattern: `/subject/[^/]+/students`, `/subject/[^/]+/courseworks`, `/subject/[^/]+/index` (look for old links to the tab routes)

Expected: zero matches outside `docs/` and any historical plans/specs. If any production code link survives, fix it.

`features/oversight/components/OversighCourseList.tsx` already links to `/subject/${subject.id}` — that's correct.

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Smoke-verify the new route**

```bash
pnpm start:dev
```

Sign in as a teacher. From the Oversight tab, tap a subject card. Confirm:
1. The parallax screen renders with the subject's hero image.
2. The animated nav bar starts transparent and fades to solid as you scroll.
3. The info button (top-right) routes to `/subject/<id>/subject-details`.
4. The timeline renders below the hero with date buckets, filter chips, and tappable rows.
5. Tapping a material row → `/lesson/<id>` opens the existing `LessonScreen`.
6. Tapping an activity row → `/activity/<id>` opens the existing `ActivityScreen`.
7. Pull-to-refresh works.

If any tab-related route is still reachable, the deletion in Step 3 missed a file — re-check.

- [ ] **Step 7: Review and stage**

Changed: 2 new files, 4 deleted files. Stage when satisfied.

---

### Task M7: Add the Students roster section to `SubjectDetailsScreen`

**Files:**
- Modify: `screens/main/oversight/SubjectDetailsScreen.tsx`

The section appends below the existing Description block. Hero, title, info rows, description stay unchanged.

- [ ] **Step 1: Add imports**

In `screens/main/oversight/SubjectDetailsScreen.tsx`, extend the imports to include what the new section needs:

```typescript
import { useEffect, useState } from "react";
import { useStudents } from "@/features/oversight/oversight.hooks";
import { Avatar, Card } from "heroui-native";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { Icon } from "@/components/Icon";
import { Pressable } from "react-native";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";
import type { Student } from "@/features/oversight/oversight.type";
```

(Merge with existing imports — e.g. `useEffect` is already imported, and `Pressable`/`useState` may need new entries. `Avatar`/`Card`/`Skeleton` need to be added from `heroui-native`.)

- [ ] **Step 2: Add the section component above the default export**

Above `export default SubjectDetailsScreen;`, add:

```typescript
const VISIBLE_DEFAULT = 5;

const StudentsRosterSection = ({ subjectId }: { subjectId: string }) => {
  const [expanded, setExpanded] = useState(false);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useStudents(subjectId);

  // Tolerate both flat-page and {results} shapes — mirrors StudentList.
  const students: Student[] = (data?.pages ?? []).flatMap((page) => {
    if (!page) return [] as Student[];
    if (Array.isArray(page)) return page as Student[];
    const results = (page as { results?: Student[] }).results;
    return Array.isArray(results) ? results : ([] as Student[]);
  });

  const total =
    (data?.pages?.[0] as { count?: number } | undefined)?.count ??
    students.length;

  // Exhaust pagination on first expand so the inline list shows everyone.
  useEffect(() => {
    if (expanded && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [expanded, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const canExpand = total > VISIBLE_DEFAULT;
  const visible =
    expanded || !canExpand ? students : students.slice(0, VISIBLE_DEFAULT);
  const hiddenCount = Math.max(0, total - VISIBLE_DEFAULT);

  return (
    <View className="mb-5">
      <AppText
        weight="semibold"
        className="text-[11px] text-muted uppercase tracking-wider mb-2 px-1"
      >
        Students · {total}
      </AppText>

      {isLoading ? (
        <View className="bg-surface-secondary rounded-2xl px-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <View key={idx}>
              <View className="flex-row items-center gap-3 py-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <View className="flex-1 gap-1.5">
                  <Skeleton className="h-4 w-2/3 rounded" />
                </View>
              </View>
              {idx < 2 ? <View className="h-px bg-border" /> : null}
            </View>
          ))}
        </View>
      ) : isError ? (
        <View className="bg-surface-secondary rounded-2xl p-4">
          <ErrorFallback
            message={getApiErrorMessage(error)}
            onRefetch={refetch}
          />
        </View>
      ) : students.length === 0 ? (
        <View className="bg-surface-secondary rounded-2xl p-4">
          <AppText className="text-sm text-muted">
            No students enrolled yet
          </AppText>
        </View>
      ) : (
        <View className="bg-surface-secondary rounded-2xl px-4">
          {visible.map((student, idx) => (
            <View key={student.id}>
              <View className="flex-row items-center gap-3 py-3">
                <Avatar alt={toTitleCase(student.name) || "Student"} size="sm">
                  <AttachmentAvatarImage path={student.studentPhoto} />
                  <AvatarFallbackImage />
                </Avatar>
                <AppText
                  weight="semibold"
                  className="text-sm flex-1"
                  numberOfLines={1}
                >
                  {toTitleCase(student.name) || "Unknown student"}
                </AppText>
              </View>
              {idx < visible.length - 1 ? (
                <View className="h-px bg-border" />
              ) : null}
            </View>
          ))}

          {canExpand ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? "Show fewer students"
                  : `Show all ${total} students`
              }
              hitSlop={6}
              className="py-3 active:opacity-70 flex-row items-center gap-1 self-start"
            >
              <AppText weight="semibold" className="text-sm text-accent">
                {expanded
                  ? "Show less"
                  : `Show all ${total} students (+${hiddenCount})`}
              </AppText>
              <Icon
                name={expanded ? "CaretUpIcon" : "CaretDownIcon"}
                size={14}
              />
              {expanded && isFetchingNextPage ? (
                <AppText className="text-xs text-muted ml-2">
                  Loading…
                </AppText>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
};
```

- [ ] **Step 3: Mount the section inside `SubjectDetailsScreen`**

In the existing `SubjectDetailsScreen` JSX, immediately after the Description block (the existing `{!!subjectDescription && (…)}` block), inside the same `<View className="w-full max-w-3xl mx-auto px-2.5">` wrapper, add:

```tsx
<StudentsRosterSection subjectId={subjectId ?? ""} />
```

- [ ] **Step 4: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Smoke-verify**

Boot the app, sign in as a teacher, open a subject from Oversight, tap the info button. Confirm:
1. The existing hero + title + Instructor + Room + Description rows render unchanged.
2. The new "STUDENTS · N" section appears below Description.
3. Up to 5 students render with avatar + name.
4. If the subject has more than 5 students, the "Show all N students" CTA appears.
5. Tapping the CTA expands the list inline (with a "Loading…" indicator if pagination is in flight).
6. A subject with zero students shows the "No students enrolled yet" inline note.

- [ ] **Step 6: Review and stage**

Changed: 1 file. Stage when satisfied.

---

### Task M8: End-to-end smoke verification

**Files:** none (verification only)

- [ ] **Step 1: Start the server (server repo)**

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

Open on a simulator. Sign in as a teacher account.

- [ ] **Step 3: Walk the teacher flow**

1. Open the Oversight tab. Subject cards render as before.
2. Tap a subject. Parallax screen mounts; hero, animated nav, and timeline appear.
3. Scroll. Hero scales up on overscroll, fades out past `IMAGE_HEIGHT`; nav background fades from transparent to solid; title text fades in; floating button backgrounds fade out.
4. Toggle filter chips. Counts and visible rows update correctly.
5. Tap a material row → `LessonScreen` opens at `/lesson/<id>`. Back works.
6. Tap an activity row → `ActivityScreen` opens at `/activity/<id>`. Back works.
7. Tap the info button → `SubjectDetailsScreen` opens. Hero/info/description render. Students section renders below.
8. Expand the Students section (if applicable). Pagination exhausts, "Loading…" disappears, full list shows.
9. Back to `SubjectScreen`. Pull to refresh. Both subject metadata and timeline visibly re-fetch.

- [ ] **Step 4: Walk the student flow (regression check)**

Sign out, sign in as a student. Open a course from `/(tabs)/courses`. Confirm the student-side `CourseScreen` still works identically to before the refactor:
1. Parallax hero + animated nav unchanged.
2. CourseTimeline still bucketizes correctly.
3. "Submitted · X/Y" badge still appears.
4. "Overdue" badge still appears on past-due unsubmitted assessments.
5. Today/due-soon highlight border still appears.
6. Material taps route to `/material/<id>`; assessment taps route to `/assessment/<id>`.

If any of these regress, diff `CourseTimeline.tsx` against the pre-M3 version — the refactor is mechanical and should preserve every behavior.

- [ ] **Step 5: Confirm dead routes are unreachable**

Try to navigate manually (via the in-app dev menu or by editing URL on web build, if available):
- `/(main)/subject/<id>/(tabs)`
- `/(main)/subject/<id>/(tabs)/courseworks`
- `/(main)/subject/<id>/(tabs)/students`

Expected: "Unmatched Route" or equivalent expo-router 404.

- [ ] **Step 6: Network failure check**

In the simulator, disable internet briefly while on the SubjectScreen. Pull to refresh. Confirm the timeline section surfaces `ErrorFallback` with a retry while the hero stays rendered (no screen-level crash). Re-enable network, tap retry; data loads.

- [ ] **Step 7: Review and stage**

No code changes — verification only. Plan complete.

---

## Self-Review

**Spec coverage check (against `2026-06-16-oversight-courses-parity-design.md`):**

| Spec section | Plan task |
|---|---|
| §3 Architecture | Phase A + Phase B together |
| §4.1 Endpoint shape | Task S2 |
| §4.2 Permissions (mirror siblings) | Task S2 step 2 (`_subject_is_visible`) |
| §4.3 Date-quality filters | Task S2 step 2 (queryset filters) |
| §4.4 Tests | Task S1 |
| §5.1 File map | Tasks M1–M7 |
| §5.2 Shared primitives | Task M2 |
| §5.3 SubjectTimeline | Task M4 |
| §5.4 SubjectScreen | Task M5 |
| §5.5 Students roster | Task M7 |
| §5.6 Routing | Task M6 |
| §6 Data flow | Verified in Task M8 |
| §7 Failure modes | Verified in Task M8 step 6 |
| §8 Out of scope | No tasks (intentional) |
| §9 Open implementation questions | Verified inline: `Module.end_date` confirmed present in `module/models/module.py`; sibling permission pattern confirmed in `mobile/views/subject_lesson_views.py`; spec's `subject/views.py` location is wrong (corrected to `mobile/views/`) |

No gaps found.

**Placeholder scan:** no "TBD"/"TODO"/"implement appropriately" in the plan. The phrase "see existing pattern" appears once (Task M7 step 1, when noting that import merges may overlap existing imports) — that's a navigation hint, not a placeholder. The phrase "Use the Grep tool" in Task M6 step 4 is a tool-use instruction, not a placeholder.

**Type consistency check:**
- `TimelineItem` defined twice (once in `features/oversight/oversight.type.ts` Task M1, once in `features/timeline/types.ts` Task M2). Both definitions are structurally identical. The oversight version exists because `getSubjectTimeline` returns `TimelineApiResponse` which references `TimelineItem`, and `oversight.apis.ts` historically owns its own types. **Consistency check passes** because the shapes match field-for-field; if a future change touches one, the other needs the same edit. Acceptable duplication for now — flagged here for awareness.
- `Filter` and `BucketKey` types defined once in `features/timeline/types.ts`, consumed by both `CourseTimeline` (Task M3) and `SubjectTimeline` (Task M4) — consistent.
- `bucketize()` signature: `(items: TimelineItem[]) => Record<BucketKey, TimelineItem[]>` — used identically in both orchestrators.
- `TimelineRow` prop names: `item`, `onPress`, `dateLabel`, `highlightVariant`, `badges` — matches in M3 (CourseTimeline's `StudentRow`) and M4 (SubjectTimeline's `TeacherRow`).
- `useSubjectTimeline` return type: `UseQueryResult<TimelineApiResponse>` → `data?.results` (M4) and `data?.results` parallel to `data.pages.flatMap(...)` for the student-side infinite query — different shapes but each consumer reads its own correctly.
- Server response `{results: [...]}` envelope matches the mobile `TimelineApiResponse.results` field — consistent end-to-end.

No issues found. Plan ready for execution.
