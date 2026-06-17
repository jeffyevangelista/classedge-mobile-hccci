# Archived Courses + Drawer Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global `TabsHeader` with per-tab headers, introduce a `Drawer` navigator above the tabs, and surface "Archived Courses" + (Student-only) "Orbit Program" filters through the drawer. Archived data is REST-backed and role-scoped server-side. See `docs/superpowers/specs/2026-06-16-archived-courses-and-drawer-design.md`.

**Architecture:**
- **Server (Django):** new endpoint `GET /api/mobile/archived-courses/` that returns past-semester data grouped by semester, scoped per role (Student/Teacher/Program Head/Academic Director). Time Keeper → 403.
- **Mobile (Expo Router):** wrap `(tabs)` with a new `(drawer)` layout. `TabsHeader` moves into the Home screen body. All non-Home tabs use the default `Tabs` header with `<SyncCenter />` on the right. Courses/Teaching/Oversight tabs gain a hamburger that opens a custom drawer. Drawer items dispatch a `view` URL search param (`current` | `archived` | `coil` | `hali` | `cte`). The active screen reads the param and selects the right data hook.

**Tech Stack:** Django 4.x + DRF + JWT (server, in `../classedge-mobile-test`). React Native 0.81 + expo-router 6 + `@react-navigation/drawer` (to be installed) + TanStack Query + heroui-native (mobile, this repo).

**Test discipline:**
- **Server tasks** use Django `TestCase` TDD (failing test → confirm fail → minimal impl → confirm pass).
- **Mobile tasks** use type-driven development with `pnpm typecheck` + `pnpm lint` + manual simulator smoke. The repo has no Jest setup; each mobile task ends with a typecheck + lint pass.

**Commit policy:** Per user preference (`feedback_no_auto_commit`), this plan does **not** include `git add`/`git commit` commands. Each task ends with a "Review and stage" step describing what changed; you stage and commit yourself.

**Repo paths used in this plan:**
- Server: `/Users/jeffthedev/Desktop/classedge-hccci/classedge-mobile-test`
- Mobile: `/Users/jeffthedev/Desktop/classedge-hccci/client-mobile`

---

## Phase A — Server (Django, `../classedge-mobile-test`)

Activate the project's venv before running any task: `source venv/bin/activate`.

The new endpoint lives in `mobile/views/` and is wired in `mobile/urls.py` (matches the existing sibling endpoints like `/api/subject/<id>/lessons/`).

### Task S1: Write the failing test for `ArchivedCoursesView` (Student case)

**Files:**
- Create: `mobile/tests/test_archived_courses_view.py`

- [ ] **Step 1: Create the test module**

Create `mobile/tests/test_archived_courses_view.py`:

```python
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Semester
from course.models import SubjectEnrollment
from roles.models import Role
from subject.models import Subject

User = get_user_model()


def _jwt_for(user):
    return str(RefreshToken.for_user(user).access_token)


def _make_semester(days_ago_end: int, days_ago_start: int, name: str = "Past Sem"):
    now = timezone.now()
    return Semester.objects.create(
        name=name,
        start_date=now - timedelta(days=days_ago_start),
        end_date=now - timedelta(days=days_ago_end),
    )


class ArchivedCoursesStudentTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.student_role = Role.objects.create(name="Student")
        cls.student = User.objects.create(username="s1", email="s1@x.test")
        cls.student.roles.add(cls.student_role)

        cls.past_sem = _make_semester(days_ago_end=30, days_ago_start=120, name="Fall 2025")
        cls.current_sem = Semester.objects.create(
            name="Spring 2026",
            start_date=timezone.now() - timedelta(days=10),
            end_date=timezone.now() + timedelta(days=60),
        )

        cls.past_subject = Subject.objects.create(
            subject_name="Past Calculus", subject_code="MATH101",
        )
        cls.current_subject = Subject.objects.create(
            subject_name="Current Bio", subject_code="BIO101",
        )

        SubjectEnrollment.objects.create(
            user=cls.student, subject=cls.past_subject, semester=cls.past_sem,
            status="completed", is_active_semester=False,
        )
        SubjectEnrollment.objects.create(
            user=cls.student, subject=cls.current_subject, semester=cls.current_sem,
            status="enrolled", is_active_semester=True,
        )

    def test_student_sees_only_past_enrollments(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(self.student)}")
        resp = self.client.get("/api/mobile/archived-courses/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        semesters = data["results"]
        self.assertEqual(len(semesters), 1)
        self.assertEqual(semesters[0]["semester"]["name"], "Fall 2025")
        self.assertEqual(len(semesters[0]["courses"]), 1)
        self.assertEqual(semesters[0]["courses"][0]["subject_code"], "MATH101")
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `python manage.py test mobile.tests.test_archived_courses_view.ArchivedCoursesStudentTests -v 2`
Expected: FAIL — URL not found or import error.

- [ ] **Step 3: Review and stage**

You added one new test file. Confirm there are no other changes before committing.

### Task S2: Wire URL + stub view returning empty results

**Files:**
- Create: `mobile/views/archived_courses_view.py`
- Modify: `mobile/urls.py`

- [ ] **Step 1: Create the stub view**

Create `mobile/views/archived_courses_view.py`:

```python
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class ArchivedCoursesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {"results": [], "pagination": {"page": 1, "page_size": 5, "total_semesters": 0, "has_next": False}},
            status=status.HTTP_200_OK,
        )
```

- [ ] **Step 2: Wire the URL**

In `mobile/urls.py`, add the import and pattern:

```python
from mobile.views.archived_courses_view import ArchivedCoursesView

urlpatterns = [
    # ...existing patterns...
    path("archived-courses/", ArchivedCoursesView.as_view(), name="mobile-archived-courses"),
]
```

- [ ] **Step 3: Re-run the test**

Run: `python manage.py test mobile.tests.test_archived_courses_view.ArchivedCoursesStudentTests -v 2`
Expected: still FAIL — assertion error on `len(semesters) == 1` (we return empty).

- [ ] **Step 4: Review and stage**

You added one new view file and modified `mobile/urls.py`.

### Task S3: Implement the Student queryset path

**Files:**
- Modify: `mobile/views/archived_courses_view.py`
- Create: `mobile/serializers/archived_courses_serializers.py`

- [ ] **Step 1: Create the serializers**

Create `mobile/serializers/archived_courses_serializers.py`:

```python
from rest_framework import serializers

from accounts.models import Semester
from subject.models import Subject


class ArchivedSemesterCourseSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    is_coil = serializers.BooleanField(source="is_coil_subject", default=False)
    is_hali = serializers.BooleanField(source="is_hali_subject", default=False)
    is_cte = serializers.BooleanField(source="is_cte_subject", default=False)

    class Meta:
        model = Subject
        fields = (
            "id", "subject_name", "subject_code", "subject_photo",
            "room_number", "teacher_name", "is_coil", "is_hali", "is_cte",
        )

    def get_teacher_name(self, obj):
        t = obj.assign_teacher
        if not t:
            return None
        first = getattr(t, "first_name", "") or ""
        last = getattr(t, "last_name", "") or ""
        return f"{first} {last}".strip() or None


class ArchivedSemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = ("id", "name", "start_date", "end_date")
```

(If field names differ from the actual `Subject` model — `is_coil_subject` vs `is_coil` — adjust the `source` argument to match `subject/models/subject_model.py`. Verify before running tests.)

- [ ] **Step 2: Update the view to scope by role**

Replace `mobile/views/archived_courses_view.py` content:

```python
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Semester
from course.models import SubjectEnrollment
from mobile.serializers.archived_courses_serializers import (
    ArchivedSemesterCourseSerializer,
    ArchivedSemesterSerializer,
)
from subject.models import Subject

DEFAULT_PAGE_SIZE = 5


def _user_roles(user) -> set[str]:
    return set(user.roles.values_list("name", flat=True))


def _past_semester_qs():
    return Semester.objects.filter(end_date__lt=timezone.now()).order_by("-end_date")


def _student_subjects_for_semester(user, semester):
    enrolled_subject_ids = SubjectEnrollment.objects.filter(
        user=user, semester=semester,
    ).values_list("subject_id", flat=True)
    return Subject.objects.filter(id__in=enrolled_subject_ids)


class ArchivedCoursesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = _user_roles(request.user)
        if "Time Keeper" in roles:
            raise PermissionDenied("Time Keeper role cannot access archived courses.")

        page = int(request.query_params.get("page", 1))
        page_size = DEFAULT_PAGE_SIZE
        all_past = list(_past_semester_qs())
        total = len(all_past)
        start = (page - 1) * page_size
        page_semesters = all_past[start : start + page_size]

        results = []
        for sem in page_semesters:
            subjects = self._subjects_for_role(request.user, roles, sem)
            if not subjects.exists():
                continue
            results.append({
                "semester": ArchivedSemesterSerializer(sem).data,
                "courses": ArchivedSemesterCourseSerializer(subjects, many=True).data,
            })

        return Response({
            "results": results,
            "pagination": {
                "page": page, "page_size": page_size,
                "total_semesters": total, "has_next": start + page_size < total,
            },
        }, status=status.HTTP_200_OK)

    def _subjects_for_role(self, user, roles, sem):
        if "Student" in roles:
            return _student_subjects_for_semester(user, sem)
        # Other roles wired in later tasks; return empty for now.
        return Subject.objects.none()
```

- [ ] **Step 3: Re-run the test**

Run: `python manage.py test mobile.tests.test_archived_courses_view.ArchivedCoursesStudentTests -v 2`
Expected: PASS.

- [ ] **Step 4: Review and stage**

You added one serializer file and replaced the view content.

### Task S4: Teacher case

**Files:**
- Modify: `mobile/tests/test_archived_courses_view.py`
- Modify: `mobile/views/archived_courses_view.py`

- [ ] **Step 1: Add the failing test class**

Append to `mobile/tests/test_archived_courses_view.py`:

```python
class ArchivedCoursesTeacherTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher_role = Role.objects.create(name="Teacher")
        cls.teacher = User.objects.create(username="t1", email="t1@x.test")
        cls.teacher.roles.add(cls.teacher_role)

        cls.past_sem = _make_semester(days_ago_end=30, days_ago_start=120, name="Fall 2025")
        cls.past_assigned = Subject.objects.create(
            subject_name="Past History", subject_code="HIST101",
            assign_teacher=cls.teacher, semester=cls.past_sem,
        )
        cls.past_not_assigned = Subject.objects.create(
            subject_name="Past Music", subject_code="MUS101",
            semester=cls.past_sem,
        )

    def test_teacher_sees_only_assigned_past_subjects(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(self.teacher)}")
        resp = self.client.get("/api/mobile/archived-courses/")
        self.assertEqual(resp.status_code, 200)
        sems = resp.json()["results"]
        self.assertEqual(len(sems), 1)
        codes = [c["subject_code"] for c in sems[0]["courses"]]
        self.assertEqual(codes, ["HIST101"])
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `python manage.py test mobile.tests.test_archived_courses_view.ArchivedCoursesTeacherTests -v 2`
Expected: FAIL — Teacher path returns empty.

- [ ] **Step 3: Add the Teacher branch**

In `archived_courses_view.py`, replace `_subjects_for_role` body:

```python
    def _subjects_for_role(self, user, roles, sem):
        if "Student" in roles:
            return _student_subjects_for_semester(user, sem)
        if "Teacher" in roles:
            return Subject.objects.filter(assign_teacher=user, semester=sem)
        return Subject.objects.none()
```

- [ ] **Step 4: Re-run the test**

Expected: PASS.

- [ ] **Step 5: Review and stage**

### Task S5: Program Head case (dept-scoped)

**Files:**
- Modify: `mobile/tests/test_archived_courses_view.py`
- Modify: `mobile/views/archived_courses_view.py`

> **Note for the implementer:** Inspect `accounts/models/*` and `subject/models/subject_model.py` to confirm how a Program Head's department links to subjects. Likely a `Subject.department` FK + a `Profile.department` FK. The exact attribute names below assume that shape; if your schema uses a different name (e.g., `program` instead of `department`), adjust the filter in step 3.

- [ ] **Step 1: Add the failing test class**

Append:

```python
class ArchivedCoursesProgramHeadTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        from accounts.models import Department  # adjust import to actual location
        cls.ph_role = Role.objects.create(name="Program Head")
        cls.cs_dept = Department.objects.create(name="Computer Science")
        cls.other_dept = Department.objects.create(name="Music")

        cls.ph = User.objects.create(username="ph1", email="ph1@x.test", department=cls.cs_dept)
        cls.ph.roles.add(cls.ph_role)

        cls.past_sem = _make_semester(days_ago_end=30, days_ago_start=120, name="Fall 2025")
        cls.cs_subject = Subject.objects.create(
            subject_name="Past Algo", subject_code="CS201",
            semester=cls.past_sem, department=cls.cs_dept,
        )
        cls.music_subject = Subject.objects.create(
            subject_name="Past Theory", subject_code="MUS201",
            semester=cls.past_sem, department=cls.other_dept,
        )

    def test_program_head_sees_only_dept_past_subjects(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(self.ph)}")
        resp = self.client.get("/api/mobile/archived-courses/")
        self.assertEqual(resp.status_code, 200)
        sems = resp.json()["results"]
        codes = [c["subject_code"] for c in sems[0]["courses"]]
        self.assertEqual(codes, ["CS201"])
```

- [ ] **Step 2: Confirm failure**

Run: `python manage.py test mobile.tests.test_archived_courses_view.ArchivedCoursesProgramHeadTests -v 2`
Expected: FAIL.

- [ ] **Step 3: Add the Program Head branch**

In `_subjects_for_role`:

```python
        if "Program Head" in roles:
            return Subject.objects.filter(
                department=user.department, semester=sem,
            )
```

- [ ] **Step 4: Re-run and pass.**

- [ ] **Step 5: Review and stage.**

### Task S6: Academic Director case (institution-wide)

**Files:**
- Modify: `mobile/tests/test_archived_courses_view.py`
- Modify: `mobile/views/archived_courses_view.py`

- [ ] **Step 1: Add the failing test class**

Append:

```python
class ArchivedCoursesAcademicDirectorTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ad_role = Role.objects.create(name="Academic Director")
        cls.ad = User.objects.create(username="ad1", email="ad1@x.test")
        cls.ad.roles.add(cls.ad_role)
        cls.past_sem = _make_semester(days_ago_end=30, days_ago_start=120, name="Fall 2025")
        Subject.objects.create(
            subject_name="Past CS", subject_code="CS301", semester=cls.past_sem,
        )
        Subject.objects.create(
            subject_name="Past Music", subject_code="MUS301", semester=cls.past_sem,
        )

    def test_academic_director_sees_all_past_subjects(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(self.ad)}")
        resp = self.client.get("/api/mobile/archived-courses/")
        codes = sorted(c["subject_code"] for c in resp.json()["results"][0]["courses"])
        self.assertEqual(codes, ["CS301", "MUS301"])
```

- [ ] **Step 2: Confirm failure, then add the AD branch**

In `_subjects_for_role`:

```python
        if "Academic Director" in roles:
            return Subject.objects.filter(semester=sem)
```

- [ ] **Step 3: Re-run, pass, review and stage.**

### Task S7: Time Keeper gets 403

**Files:**
- Modify: `mobile/tests/test_archived_courses_view.py`

- [ ] **Step 1: Add the failing test**

Append:

```python
class ArchivedCoursesTimeKeeperTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.tk_role = Role.objects.create(name="Time Keeper")
        cls.tk = User.objects.create(username="tk1", email="tk1@x.test")
        cls.tk.roles.add(cls.tk_role)

    def test_time_keeper_forbidden(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(self.tk)}")
        resp = self.client.get("/api/mobile/archived-courses/")
        self.assertEqual(resp.status_code, 403)
```

- [ ] **Step 2: Run — expected: PASS (already covered in Task S3 by `PermissionDenied`).**

- [ ] **Step 3: If it fails, add the early raise in `get()` (already present in Task S3). Review and stage.**

### Task S8: UserActivityLog entry

**Files:**
- Modify: `logs/models.py`
- Modify: `mobile/views/archived_courses_view.py`
- Modify: `mobile/tests/test_archived_courses_view.py`

- [ ] **Step 1: Add the action constant**

In `logs/models.py`, find the `ACTION_*` constants block and add:

```python
    ACTION_VIEW_ARCHIVED_COURSES = "view_archived_courses"
```

If the constants are declared inside `class UserActivityLog`, insert in the same scope as the existing `ACTION_*` siblings. Also append `(ACTION_VIEW_ARCHIVED_COURSES, "View archived courses")` to the `ACTION_CHOICES` tuple.

- [ ] **Step 2: Add the failing test**

Append to `mobile/tests/test_archived_courses_view.py`:

```python
from logs.models import UserActivityLog

class ArchivedCoursesAuditTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.role = Role.objects.create(name="Student")
        cls.user = User.objects.create(username="aud1", email="aud1@x.test")
        cls.user.roles.add(cls.role)

    def test_archive_view_logs_audit_event(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {_jwt_for(self.user)}")
        self.client.get("/api/mobile/archived-courses/")
        log = UserActivityLog.objects.filter(
            user=self.user, action=UserActivityLog.ACTION_VIEW_ARCHIVED_COURSES,
        )
        self.assertEqual(log.count(), 1)
```

- [ ] **Step 3: Confirm failure, then add logging**

In `archived_courses_view.py`, after the `PermissionDenied` check inside `get()`:

```python
        UserActivityLog.objects.create(
            user=request.user,
            action=UserActivityLog.ACTION_VIEW_ARCHIVED_COURSES,
        )
```

Import `UserActivityLog` at the top of the file.

- [ ] **Step 4: Re-run all archive tests**

Run: `python manage.py test mobile.tests.test_archived_courses_view -v 2`
Expected: ALL PASS.

- [ ] **Step 5: Review and stage**

You modified `logs/models.py`, `mobile/views/archived_courses_view.py`, and the test file. If `logs/models.py` introduces a new migration requirement, generate it (`python manage.py makemigrations logs`) and include it in your stage.

---

## Phase B — Mobile navigation chrome (`/Users/jeffthedev/Desktop/classedge-hccci/client-mobile`)

### Task M1: Install `@react-navigation/drawer` and its peer

**Files:** none (package install)

- [ ] **Step 1: Install**

Run: `pnpm add @react-navigation/drawer`

`react-native-gesture-handler` and `react-native-reanimated` are already installed (see `package.json` deps).

- [ ] **Step 2: Verify typecheck still passes**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 3: Review and stage**

Stage `package.json` + `pnpm-lock.yaml`.

### Task M2: Create the `(drawer)` layout with a stub drawer content

**Files:**
- Create: `app/(main)/(drawer)/_layout.tsx`
- Create: `components/AppDrawerContent.tsx`
- Modify: `app/(main)/_layout.tsx`
- Modify: file system: move `(tabs)/` under `(drawer)/`

- [ ] **Step 1: Move the `(tabs)` directory under `(drawer)`**

Run: `mkdir -p /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/\(main\)/\(drawer\) && mv /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/\(main\)/\(tabs\) /Users/jeffthedev/Desktop/classedge-hccci/client-mobile/app/\(main\)/\(drawer\)/`

- [ ] **Step 2: Create the stub drawer content**

Create `components/AppDrawerContent.tsx`:

```tsx
import { DrawerContentScrollView, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { View } from "react-native";
import { AppText } from "@/components/AppText";

const AppDrawerContent = (props: DrawerContentComponentProps) => {
  return (
    <DrawerContentScrollView {...props}>
      <View className="p-4">
        <AppText weight="semibold" className="text-lg">Menu</AppText>
      </View>
    </DrawerContentScrollView>
  );
};

export default AppDrawerContent;
```

- [ ] **Step 3: Create the drawer layout**

Create `app/(main)/(drawer)/_layout.tsx`:

```tsx
import { Drawer } from "expo-router/drawer";
import AppDrawerContent from "@/components/AppDrawerContent";
import useStore from "@/lib/store";

const DrawerLayout = () => {
  const { authUser } = useStore();
  const isTimeKeeper = authUser?.role === "Time Keeper";

  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        swipeEnabled: !isTimeKeeper,
        drawerStyle: { width: "78%" },
      }}
    />
  );
};

export default DrawerLayout;
```

- [ ] **Step 4: Update the parent Stack to expect `(drawer)` instead of `(tabs)`**

In `app/(main)/_layout.tsx`, change the line:

```tsx
        <Stack.Screen name="(tabs)" />
```

to:

```tsx
        <Stack.Screen name="(drawer)" />
```

- [ ] **Step 5: Typecheck + lint + simulator smoke**

Run: `pnpm typecheck` then `pnpm lint`. Then `pnpm ios` (or `pnpm android`) and confirm the app boots into the existing tabs (still showing `TabsHeader`). Swipe from the left edge — the stub "Menu" drawer should appear.

- [ ] **Step 6: Review and stage**

### Task M3: Move `<TabsHeader />` into the Home screen body

**Files:**
- Modify: `app/(main)/(drawer)/(tabs)/_layout.tsx`
- Modify: `screens/main/HomeScreen.tsx`

- [ ] **Step 1: Remove the global `<TabsHeader />` from the tabs layout**

In `app/(main)/(drawer)/(tabs)/_layout.tsx`, delete line 58 (`<TabsHeader />`) AND remove the `import TabsHeader` line. The `Animated.View` should now wrap only `<View style={{ flex: 1 }}><Tabs ...>...</Tabs></View>`.

- [ ] **Step 2: Render `<TabsHeader />` inside `HomeScreen`**

Edit `screens/main/HomeScreen.tsx`. Import `TabsHeader` and render it inside `Screen` above `ScreenScrollView`:

```tsx
import TabsHeader from "@/components/TabsHeader";

// ...inside the return:
  return (
    <Screen>
      <TabsHeader />
      <ScreenScrollView /* ... */>
        {/* existing content */}
      </ScreenScrollView>
    </Screen>
  );
```

- [ ] **Step 3: Simulator smoke**

Boot the app. Verify the greeting + avatar appears on the Home tab and is **absent** from Courses, Calendar, Notifications (those tabs now have no header at all — we wire the default header in Task M4).

- [ ] **Step 4: Typecheck + lint, review and stage.**

### Task M4: Enable per-tab default headers, with SyncCenter on right

**Files:**
- Modify: `app/(main)/(drawer)/(tabs)/_layout.tsx`

- [ ] **Step 1: Flip global `headerShown` and add per-screen overrides**

Inside `screenOptions`, change `headerShown: false` to `headerShown: true`. Then update each `Tabs.Screen` block:

For `index` (Home):

```tsx
          <Tabs.Screen
            name="index"
            options={{
              headerShown: false,
              tabBarIcon: ({ focused, color }) => (
                <TabIcon focused={focused} color={color} IconElement="HouseIcon" />
              ),
              tabBarLabel: "Home",
            }}
          />
```

For `calendar`:

```tsx
          <Tabs.Screen
            name="calendar"
            options={{
              headerTitle: "Calendar",
              headerRight: () => <SyncCenter />,
              tabBarIcon: /* unchanged */,
              tabBarLabel: "Calendar",
            }}
          />
```

For `notifications` — same pattern, headerTitle "Notifications" + `headerRight`.

For `teaching`, `oversight`, `courses` — defer the `headerLeft` hamburger to Task M6. For now just set `headerTitle` and `headerRight`:

```tsx
            options={{
              headerTitle: "Courses",
              headerRight: () => <SyncCenter />,
              tabBarIcon: /* unchanged */,
              tabBarLabel: "Courses",
            }}
```

Import `SyncCenter` at the top of the file:

```tsx
import SyncCenter from "@/features/sync/components/SyncCenter";
```

- [ ] **Step 2: Smoke each tab**

Boot the app. Verify:
- Home shows `TabsHeader` (greeting + avatar) and no default header
- Calendar / Notifications show a bar with title + cloud icon on right
- Courses / Teaching / Oversight show title + cloud icon on right (no hamburger yet)

- [ ] **Step 3: Typecheck + lint, review and stage.**

### Task M5: Create the `HamburgerButton`

**Files:**
- Create: `components/HamburgerButton.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Pressable } from "react-native";
import { useNavigation } from "expo-router";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { Icon } from "@/components/Icon";
import { useThemeColor } from "heroui-native";

const HamburgerButton = () => {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const tint = useThemeColor("foreground");
  return (
    <Pressable
      onPress={() => navigation.getParent("drawer")?.openDrawer?.() ?? navigation.openDrawer?.()}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      hitSlop={8}
      className="p-2 active:opacity-60"
    >
      <Icon name="ListIcon" size={22} color={tint} />
    </Pressable>
  );
};

export default HamburgerButton;
```

> If `"ListIcon"` is not in your `Icon` registry, substitute another phosphor icon already in use (e.g., `"ListBulletsIcon"`). Confirm by grepping `components/Icon.tsx` or the icon list.

- [ ] **Step 2: Typecheck + lint, review and stage.**

### Task M6: Wire the hamburger into Courses, Teaching, Oversight (Time Keeper excluded)

**Files:**
- Modify: `app/(main)/(drawer)/(tabs)/_layout.tsx`

- [ ] **Step 1: Add the role read and conditional `headerLeft`**

At the top of `TabsLayout` near the existing `useStore` call, no change needed — `authUser` is already destructured.

Update the `oversight` screen options to set `headerLeft` only when the role is not Time Keeper:

```tsx
          <Tabs.Protected
            guard={
              authUser?.role === "Program Head" ||
              authUser?.role === "Academic Director" ||
              authUser?.role === "Time Keeper"
            }
          >
            <Tabs.Screen
              name="oversight"
              options={{
                headerTitle: "Courses",
                headerRight: () => <SyncCenter />,
                headerLeft: authUser?.role !== "Time Keeper"
                  ? () => <HamburgerButton />
                  : undefined,
                tabBarIcon: /* unchanged */,
                tabBarLabel: "Oversight",
              }}
            />
          </Tabs.Protected>
```

Add `headerLeft: () => <HamburgerButton />` to `courses` and `teaching` screen options unconditionally. Import `HamburgerButton` at the top.

- [ ] **Step 2: Smoke each role**

Boot the app, sign in as a Student → Courses tab shows hamburger. Sign in as a Teacher → Teaching tab shows hamburger. Sign in as Program Head → Oversight tab shows hamburger. Sign in as Time Keeper → Oversight tab has NO hamburger and swipe-from-left does not open the drawer.

- [ ] **Step 3: Typecheck + lint, review and stage.**

### Task M7: Build out `AppDrawerContent` with role-correct items

**Files:**
- Create: `features/auth/roleNav.ts`
- Modify: `components/AppDrawerContent.tsx`

- [ ] **Step 1: Create the role-tab mapping helper**

Create `features/auth/roleNav.ts`:

```ts
export type ArchiveCapableRole =
  | "Student" | "Teacher" | "Program Head" | "Academic Director";

export type ViewKey = "current" | "archived" | "coil" | "hali" | "cte";

export const getRoleTabPath = (role: string | undefined): string | null => {
  if (role === "Student") return "/(main)/(drawer)/(tabs)/courses";
  if (role === "Teacher") return "/(main)/(drawer)/(tabs)/teaching";
  if (role === "Program Head" || role === "Academic Director")
    return "/(main)/(drawer)/(tabs)/oversight";
  return null;
};

type DrawerItem = { label: string; view: ViewKey; section?: string };

export const getDrawerItems = (role: string | undefined): DrawerItem[] => {
  if (role === "Student")
    return [
      { label: "My Courses", view: "current" },
      { label: "Archived Courses", view: "archived" },
      { label: "COIL", view: "coil", section: "Orbit Program" },
      { label: "HALI", view: "hali", section: "Orbit Program" },
      { label: "CTE", view: "cte", section: "Orbit Program" },
    ];
  if (role === "Teacher")
    return [
      { label: "Teaching", view: "current" },
      { label: "Archived Courses", view: "archived" },
    ];
  if (role === "Program Head" || role === "Academic Director")
    return [
      { label: "Courses", view: "current" },
      { label: "Archived Courses", view: "archived" },
    ];
  return [];
};
```

- [ ] **Step 2: Build the drawer content**

Replace `components/AppDrawerContent.tsx`:

```tsx
import { DrawerContentScrollView, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Avatar } from "heroui-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { useUserDetails } from "@/features/profile/profile.hooks";
import { getGreeting } from "@/utils/getGreeting";
import { toTitleCase } from "@/utils/toTitleCase";
import useStore from "@/lib/store";
import { getDrawerItems, getRoleTabPath, type ViewKey } from "@/features/auth/roleNav";

const AppDrawerContent = (props: DrawerContentComponentProps) => {
  const { authUser } = useStore();
  const { data: userDetailsRows } = useUserDetails();
  const userDetails = userDetailsRows?.[0];
  const firstName = userDetails?.firstName;

  const items = getDrawerItems(authUser?.role);
  const roleTabPath = getRoleTabPath(authUser?.role);
  const { view: activeView = "current" } = useLocalSearchParams<{ view?: ViewKey }>();

  const onItemPress = (view: ViewKey) => {
    if (!roleTabPath) return;
    router.replace({ pathname: roleTabPath, params: { view } });
    props.navigation.closeDrawer();
  };

  // Group items by section
  const sections: { name?: string; items: typeof items }[] = [];
  for (const item of items) {
    if (!item.section) {
      sections.push({ items: [item] });
      continue;
    }
    const last = sections.at(-1);
    if (last?.name === item.section) last.items.push(item);
    else sections.push({ name: item.section, items: [item] });
  }

  return (
    <DrawerContentScrollView {...props} contentContainerClassName="pt-4">
      <Pressable
        onPress={() => router.push("/(main)/profile")}
        className="flex-row items-center gap-3 px-4 pb-4 border-b border-border"
      >
        <Avatar size="md" alt="user-profile" className="border border-border">
          <AttachmentAvatarImage path={userDetails?.studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>
        <View>
          <AppText weight="semibold" className="text-base text-foreground">
            {firstName ? toTitleCase(firstName.split(" ")[0]) : "—"}
          </AppText>
          <AppText className="text-[11px] text-muted">{getGreeting()}</AppText>
        </View>
      </Pressable>

      {sections.map((section, sIdx) => (
        <View key={section.name ?? `s${sIdx}`} className="px-2 pt-3">
          {section.name && (
            <AppText className="text-[10px] text-muted tracking-wider uppercase px-3 pb-1">
              {section.name}
            </AppText>
          )}
          {section.items.map((item) => {
            const isActive = item.view === activeView;
            return (
              <Pressable
                key={item.view}
                onPress={() => onItemPress(item.view)}
                className={`px-3 py-3 rounded-lg my-0.5 active:opacity-70 ${
                  isActive ? "bg-foreground" : "bg-transparent"
                } ${section.name ? "ml-3" : ""}`}
              >
                <AppText
                  weight="semibold"
                  className={isActive ? "text-background" : "text-foreground"}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </DrawerContentScrollView>
  );
};

export default AppDrawerContent;
```

- [ ] **Step 3: Simulator smoke per role**

- Student opens the drawer → sees "My Courses" (active), "Archived Courses", and an ORBIT PROGRAM section with COIL/HALI/CTE indented.
- Teacher → "Teaching" (active), "Archived Courses".
- Program Head / Academic Director → "Courses" (active), "Archived Courses".
- Time Keeper → can't open the drawer.

Tap any item → drawer closes, route changes to the role's tab with `?view=<key>`. (Title doesn't update yet — wired in Task M9.)

- [ ] **Step 4: Typecheck + lint, review and stage.**

---

## Phase C — Mobile Student data (Courses tab)

### Task M8: Add `isActiveSemester` filter to "current" view query

**Files:**
- Modify: `features/courses/courses.service.ts`

- [ ] **Step 1: Update `getStudentCourses` to filter to active semester**

In `features/courses/courses.service.ts`, modify the `where` clause:

```ts
export const getStudentCourses = (studentId: number) => {
  return db.query.studentEnrolledCoursesTable.findMany({
    where: (enrollment, { eq, and }) =>
      and(
        eq(enrollment.studentId, studentId),
        eq(enrollment.isActiveSemester, 1),
      ),
    with: {
      // ...unchanged
    },
  });
};
```

> Why: today the call returns *every* enrollment row PowerSync has synced. To make "My Courses" actually mean *current term*, we explicitly filter on `isActiveSemester = 1`. PowerSync may already scope this server-side via sync rules, in which case the filter is a no-op. Defensive either way.

- [ ] **Step 2: Smoke the Courses tab**

Boot as a Student. Verify the Courses tab still shows current-term enrollments. If you have past enrollments in seed data, they should now be absent from the default view.

- [ ] **Step 3: Typecheck + lint, review and stage.**

### Task M9: Header title syncs to `view` param

**Files:**
- Modify: `screens/main/courses/CoursesScreen.tsx`

- [ ] **Step 1: Read view + set the navigation title**

Replace `screens/main/courses/CoursesScreen.tsx`:

```tsx
import { useEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import Screen from "@/components/screen";
import CourseList from "@/features/courses/components/CourseList";
import type { ViewKey } from "@/features/auth/roleNav";

const TITLE_BY_VIEW: Record<ViewKey, string> = {
  current: "My Courses",
  archived: "Archived Courses",
  coil: "COIL",
  hali: "HALI",
  cte: "CTE",
};

const CoursesScreen = () => {
  const { view = "current" } = useLocalSearchParams<{ view?: ViewKey }>();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ title: TITLE_BY_VIEW[view] });
  }, [navigation, view]);

  return (
    <Screen>
      <CourseList />
    </Screen>
  );
};

export default CoursesScreen;
```

- [ ] **Step 2: Smoke the title swap**

Open Courses → "My Courses". Open drawer → tap Archived Courses → header changes to "Archived Courses". Tap COIL → header reads "COIL". (The list contents won't change yet — that's wired in the next tasks.)

- [ ] **Step 3: Typecheck + lint, review and stage.**

### Task M10: Orbit hook + service (Student only, PowerSync-backed)

**Files:**
- Modify: `features/courses/courses.service.ts`
- Create: `features/courses/orbit.hooks.ts`

- [ ] **Step 1: Add the Orbit query builder**

Append to `features/courses/courses.service.ts`:

```ts
import type { SQL } from "drizzle-orm";

type OrbitFlag = "coil" | "hali" | "cte";

const orbitColumnByFlag: Record<OrbitFlag, "isCoil" | "isHali" | "isCte"> = {
  coil: "isCoil",
  hali: "isHali",
  cte: "isCte",
};

export const getStudentOrbitCourses = (studentId: number, flag: OrbitFlag) => {
  return db.query.studentEnrolledCoursesTable.findMany({
    where: (enrollment, { eq, and, exists }) =>
      and(
        eq(enrollment.studentId, studentId),
        eq(enrollment.isActiveSemester, 1),
        // Use a subquery on the joined subject — drizzle's `with` doesn't
        // support filtering inside the join, so we filter via subquery.
        // The exact subquery shape depends on the schema; if drizzle's
        // relations API can't express this cleanly, switch to a raw
        // `usePowerSyncQuery` with a hand-written SQL string in the hook.
      ),
    with: {
      subjectId: {
        columns: {
          // KEEP the orbit flags this time so consumers can verify
          isCoil: true,
          isHali: true,
          isCte: true,
          subjectDescription: false,
          duration: false,
        },
        with: {
          assignTeacherId: {
            columns: { firstName: true, lastName: true },
          },
        },
      },
    },
  });
};

export const orbitFlagToColumn = orbitColumnByFlag;
```

> If drizzle's relational `where` cannot reach into the joined `subjectId.isCoil`, fall back to a raw SQL `usePowerSyncQuery` call in the hook instead — the schema layer treats subject as a separate table. Validate during step 3.

- [ ] **Step 2: Create the hook**

Create `features/courses/orbit.hooks.ts`:

```ts
import { useMemo } from "react";
import { useQuery as usePowerSyncQuery } from "@powersync/react-native";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import useStore from "@/lib/store";
import { getStudentOrbitCourses } from "./courses.service";

type OrbitFlag = "coil" | "hali" | "cte";

export const useOrbitCourses = (flag: OrbitFlag) => {
  const authUser = useStore((s) => s.authUser);
  const studentId = authUser?.id ?? 0;

  const { data: rows, isLoading, isFetching, error, refresh } =
    usePowerSyncQuery(toCompilableQuery(getStudentOrbitCourses(studentId, flag)));

  const data = useMemo(
    () =>
      (rows ?? []).filter((e) => {
        if (e.subjectId == null) return false;
        if (flag === "coil") return e.subjectId.isCoil;
        if (flag === "hali") return e.subjectId.isHali;
        return e.subjectId.isCte;
      }),
    [rows, flag],
  );

  return {
    data,
    isLoading,
    isFetching,
    isError: !!error,
    error,
    refetch: refresh ?? (async () => {}),
    isRefetching: isFetching && !isLoading,
  };
};
```

- [ ] **Step 3: Typecheck + lint, review and stage.**

### Task M11: Archived hook (REST + useInfiniteQuery)

**Files:**
- Create: `features/courses/archive.apis.ts`
- Create: `features/courses/archive.hooks.ts`
- Create: `features/courses/archive.types.ts`

- [ ] **Step 1: Types**

Create `features/courses/archive.types.ts`:

```ts
export type ArchivedCourse = {
  id: number;
  subjectName: string;
  subjectCode: string;
  subjectPhoto: string | null;
  roomNumber: string | null;
  teacherName: string | null;
  isCoil: boolean;
  isHali: boolean;
  isCte: boolean;
};

export type ArchivedSemester = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
};

export type ArchivedSemesterGroup = {
  semester: ArchivedSemester;
  courses: ArchivedCourse[];
};

export type ArchivedCoursesPage = {
  results: ArchivedSemesterGroup[];
  pagination: {
    page: number;
    pageSize: number;
    totalSemesters: number;
    hasNext: boolean;
  };
};
```

- [ ] **Step 2: API call (axios — snake-to-camel happens automatically per `lib/axios.ts`)**

Create `features/courses/archive.apis.ts`:

```ts
import api from "@/lib/axios";
import type { ArchivedCoursesPage } from "./archive.types";

export const getArchivedCoursesApi = async (page: number) => {
  const { data } = await api.get<ArchivedCoursesPage>("/api/mobile/archived-courses/", {
    params: { page },
  });
  return data;
};
```

- [ ] **Step 3: Hook**

Create `features/courses/archive.hooks.ts`:

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import useStore from "@/lib/store";
import { getArchivedCoursesApi } from "./archive.apis";

export const useArchivedCourses = () => {
  const authUser = useStore((s) => s.authUser);

  return useInfiniteQuery({
    queryKey: ["archived-courses", authUser?.id],
    enabled: !!authUser?.id,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getArchivedCoursesApi(pageParam as number),
    getNextPageParam: (last) =>
      last.pagination.hasNext ? last.pagination.page + 1 : undefined,
  });
};
```

- [ ] **Step 4: Typecheck + lint, review and stage.**

### Task M12: `ArchivedCourseList` SectionList component

**Files:**
- Create: `features/courses/components/ArchivedCourseList.tsx`

- [ ] **Step 1: Build the SectionList**

```tsx
import { ActivityIndicator, Pressable, SectionList, View } from "react-native";
import { router } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { useArchivedCourses } from "../archive.hooks";
import type { ArchivedCourse } from "../archive.types";

const ArchivedCourseList = () => {
  const { isConnected, isInternetReachable } = useStore();
  const isOffline = !isConnected || !isInternetReachable;
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } =
    useArchivedCourses();
  const mutedColor = useThemeColor("muted");

  if (isError) {
    return <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />;
  }
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const groups = (data?.pages ?? []).flatMap((p) => p.results);
  const totalCourses = groups.reduce((n, g) => n + g.courses.length, 0);

  if (totalCourses === 0) {
    if (isOffline) return <OfflineEmpty section="archived courses" />;
    return (
      <EmptyState
        icon="BookOpenIcon"
        title="No archived courses"
        description="Past semester courses will appear here."
      />
    );
  }

  const sections = groups.map((g) => ({
    title: g.semester.name,
    data: g.courses,
  }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => `arc-${item.id}`}
      onRefresh={refetch}
      refreshing={isRefetching}
      onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null}
      renderSectionHeader={({ section }) => (
        <View className="px-4 py-2 bg-background">
          <AppText weight="semibold" className="text-base text-foreground">{section.title}</AppText>
        </View>
      )}
      renderItem={({ item }) => <ArchivedRow item={item} mutedColor={mutedColor} />}
    />
  );
};

const ArchivedRow = ({ item, mutedColor }: { item: ArchivedCourse; mutedColor: string }) => {
  return (
    <View className="px-2 py-1">
      <Pressable
        onPress={() => router.push(`/course/${item.id}`)}
        className="active:opacity-80 rounded-xl overflow-hidden"
      >
        <Card className="p-0 shadow-none rounded-xl border border-border">
          <Card.Body className="gap-2.5">
            <AttachmentImage
              path={item.subjectPhoto}
              fallback={
                <Image
                  source={require("@/assets/placeholder/bg-placeholder.png")}
                  className="rounded-t-xl w-full aspect-video"
                  contentFit="cover"
                />
              }
              className="rounded-t-xl w-full aspect-video"
              contentFit="cover"
              cachePolicy="disk"
            />
            <View className="px-4 pb-4 gap-1">
              <AppText weight="semibold" className="text-base leading-6" numberOfLines={2}>
                {item.subjectName}
              </AppText>
              <View className="flex-row items-center gap-1.5">
                <Icon name="MapPinIcon" size={14} color={mutedColor} />
                <AppText numberOfLines={1} className="text-xs text-muted flex-1">
                  {item.roomNumber || "TBA"}
                </AppText>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Icon name="ChalkboardTeacherIcon" size={14} color={mutedColor} />
                <AppText numberOfLines={1} className="text-xs text-muted flex-1">
                  {item.teacherName || "Unassigned"}
                </AppText>
              </View>
            </View>
          </Card.Body>
        </Card>
      </Pressable>
    </View>
  );
};

export default ArchivedCourseList;
```

- [ ] **Step 2: Typecheck + lint, review and stage.**

### Task M13: Wire `CourseList` to accept an injected query + add view switch in `CoursesScreen`

**Files:**
- Modify: `features/courses/components/CourseList.tsx`
- Modify: `screens/main/courses/CoursesScreen.tsx`

- [ ] **Step 1: Make `CourseList` accept a `query` prop**

In `CourseList.tsx`, change the function signature:

```tsx
type CourseListProps = {
  query?: ReturnType<typeof useStudentCourses>;
};

const CourseList = ({ query }: CourseListProps = {}) => {
  // ...
  const fallbackQuery = useStudentCourses();
  const { data, isLoading, isError, error, refetch, isRefetching } = query ?? fallbackQuery;
  // ...rest unchanged
};
```

Hooks-rules note: `useStudentCourses()` always runs (it's just memoized PowerSync-backed; not used if `query` is passed). This is acceptable since it doesn't violate the rules of hooks.

> If the React rules-of-hooks bother you, alternative: render two sibling components — `<CourseListWith data={query} />` vs `<CourseListSelf />` — and have CoursesScreen pick. Either works.

- [ ] **Step 2: Add the view switch in `CoursesScreen`**

Replace `screens/main/courses/CoursesScreen.tsx` with the view-aware shell:

```tsx
import { useEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import Screen from "@/components/screen";
import CourseList from "@/features/courses/components/CourseList";
import ArchivedCourseList from "@/features/courses/components/ArchivedCourseList";
import { useStudentCourses } from "@/features/courses/courses.hooks";
import { useOrbitCourses } from "@/features/courses/orbit.hooks";
import type { ViewKey } from "@/features/auth/roleNav";

const TITLE_BY_VIEW: Record<ViewKey, string> = {
  current: "My Courses",
  archived: "Archived Courses",
  coil: "COIL",
  hali: "HALI",
  cte: "CTE",
};

const CoursesScreen = () => {
  const { view = "current" } = useLocalSearchParams<{ view?: ViewKey }>();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ title: TITLE_BY_VIEW[view] });
  }, [navigation, view]);

  if (view === "archived") {
    return (
      <Screen>
        <ArchivedCourseList />
      </Screen>
    );
  }
  if (view === "coil" || view === "hali" || view === "cte") {
    return (
      <Screen>
        <OrbitListShell flag={view} />
      </Screen>
    );
  }
  return (
    <Screen>
      <CourseList />
    </Screen>
  );
};

const OrbitListShell = ({ flag }: { flag: "coil" | "hali" | "cte" }) => {
  const q = useOrbitCourses(flag);
  return <CourseList query={q} />;
};

export default CoursesScreen;
```

- [ ] **Step 3: Smoke per view**

Student boots app. Tap drawer → My Courses → list of current enrollments. Tap Archived → SectionList of past semesters fetched from `/api/mobile/archived-courses/`. Tap COIL → list filtered to COIL-flagged enrollments. Repeat HALI, CTE.

- [ ] **Step 4: Typecheck + lint, review and stage.**

---

## Phase D — Mobile Teacher data (Teaching tab)

### Task M14: Extract TeachingScreen body, then wrap in a view switch

**Files:**
- Create: `features/teaching/components/TeachingCourseList.tsx`
- Modify: `screens/main/TeachingScreen.tsx`

`TeachingScreen.tsx` today holds all the search/sort/list logic inline (uses `useTeachingCourses`, FlashList, etc.). Extract that into a feature component, then turn `TeachingScreen` into a view switch like `CoursesScreen`.

- [ ] **Step 1: Move the body into `TeachingCourseList`**

Create `features/teaching/components/TeachingCourseList.tsx`. Copy the entire current `TeachingScreen` function body (the JSX returned, plus its hooks/state) into a new component called `TeachingCourseList`. Do NOT include the outer `<Screen>` wrapper — that stays in the parent. Keep all imports the new file needs; remove `import Screen from "@/components/screen";` from the new file since the wrapper moves up.

Default-export `TeachingCourseList`.

- [ ] **Step 2: Replace `TeachingScreen` with the view switch**

Overwrite `screens/main/TeachingScreen.tsx`:

```tsx
import { useEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import Screen from "@/components/screen";
import ArchivedCourseList from "@/features/courses/components/ArchivedCourseList";
import TeachingCourseList from "@/features/teaching/components/TeachingCourseList";
import type { ViewKey } from "@/features/auth/roleNav";

const TeachingScreen = () => {
  const { view = "current" } = useLocalSearchParams<{ view?: ViewKey }>();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      title: view === "archived" ? "Archived Courses" : "Teaching",
    });
  }, [navigation, view]);

  if (view === "archived") {
    return (
      <Screen>
        <ArchivedCourseList />
      </Screen>
    );
  }
  return (
    <Screen>
      <TeachingCourseList />
    </Screen>
  );
};

export default TeachingScreen;
```

- [ ] **Step 3: Smoke**

Teacher signs in → Teaching tab shows hamburger. Default view = Teaching, identical to before the refactor. Tap Archived → archived endpoint serves teacher-scoped past assignments grouped by semester.

- [ ] **Step 4: Typecheck + lint, review and stage.**

---

## Phase E — Mobile Program Head / Academic Director data (Oversight tab)

### Task M15: Wrap OversightScreen in a view switch

**Files:**
- Modify: `screens/main/oversight/OversightScreen.tsx`

`OversightScreen.tsx` is already a thin shell that renders `<OversighCourseList />` (note: the existing filename has a typo — keep it). Add the view switch around it.

- [ ] **Step 1: Replace the screen body**

Overwrite `screens/main/oversight/OversightScreen.tsx`:

```tsx
import { useEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import Screen from "@/components/screen";
import OversighCourseList from "@/features/oversight/components/OversighCourseList";
import ArchivedCourseList from "@/features/courses/components/ArchivedCourseList";
import useStore from "@/lib/store";
import type { ViewKey } from "@/features/auth/roleNav";

const OversightScreen = () => {
  const { view = "current" } = useLocalSearchParams<{ view?: ViewKey }>();
  const navigation = useNavigation();
  const { authUser } = useStore();
  const isTimeKeeper = authUser?.role === "Time Keeper";

  useEffect(() => {
    navigation.setOptions({
      title: view === "archived" ? "Archived Courses" : "Courses",
    });
  }, [navigation, view]);

  // Time Keeper has no archive access; always render the existing oversight
  // list. (The drawer is also disabled for this role via swipeEnabled in
  // (drawer)/_layout.tsx.)
  if (!isTimeKeeper && view === "archived") {
    return (
      <Screen>
        <ArchivedCourseList />
      </Screen>
    );
  }
  return (
    <Screen>
      <OversighCourseList />
    </Screen>
  );
};

export default OversightScreen;
```

- [ ] **Step 2: Smoke per role**

- Program Head signs in → Oversight tab shows hamburger. Default = Courses. Tap Archived → archived endpoint serves dept-scoped past subjects.
- Academic Director → same flow, institution-wide data.
- Time Keeper → no hamburger, no swipe; Oversight body unchanged regardless of any `?view=` URL the user might paste.

- [ ] **Step 3: Typecheck + lint, review and stage.**

---

## Phase F — Polish + smoke

### Task M16: Manual smoke test checklist

**Files:** none

Run the full app on simulator. Verify each box:

- [ ] Home tab shows `TabsHeader` (greeting + avatar + cloud icon)
- [ ] Calendar tab shows default header with "Calendar" + cloud icon on right, no hamburger
- [ ] Notifications tab shows default header with "Notifications" + cloud icon on right, no hamburger
- [ ] Student: Courses tab has hamburger + cloud icon
- [ ] Student drawer: My Courses (active) · Archived Courses · ORBIT PROGRAM > COIL/HALI/CTE
- [ ] Tapping each Student drawer item updates `?view=` and header title
- [ ] Student archived view fetches from REST and displays SectionList grouped by semester
- [ ] Student COIL/HALI/CTE views filter PowerSync data correctly
- [ ] Teacher: Teaching tab has hamburger
- [ ] Teacher drawer: Teaching (active) · Archived Courses
- [ ] Program Head / Academic Director: Oversight tab has hamburger
- [ ] Program Head / Academic Director drawer: Courses (active) · Archived Courses
- [ ] Time Keeper: Oversight tab has NO hamburger, swipe does NOT open drawer
- [ ] Offline state on archived view shows OfflineEmpty fallback
- [ ] Title swaps without flicker on view change
- [ ] No console warnings about nested navigators

---

## Self-Review Notes

- Every spec section has at least one implementing task. Server endpoint = S1–S8. Header swap = M3–M4. Drawer = M2, M5–M7. Per-role data integration = M8–M15. Smoke = M16.
- The plan assumes `Semester`/`SubjectEnrollment`/`Department` field names match common Django patterns; tasks flag where the implementer must verify against actual schema.
- "Current" PowerSync filter (M8) makes the existing screen's data scope explicit. If your seed data shows no past enrollments today, the change is invisible.
- No placeholders: every step has either code or a specific command + expected output.
- Git commit steps are absent per repo preference; each task ends with "Review and stage".
