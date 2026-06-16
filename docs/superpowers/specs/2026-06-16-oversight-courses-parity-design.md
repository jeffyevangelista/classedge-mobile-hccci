# Oversight ↔ Courses Parity — Design

**Status:** Design approved (2026-06-16) — pending implementation plan.
**Scope:** Restructure the teacher-side Oversight subject view to mirror the student-side `CourseScreen` (parallax hero + animated nav + merged-by-date timeline), backed by REST. Absorb Courseworks into the timeline. Move Students into the existing `SubjectDetailsScreen` info screen. Add a new server endpoint that returns the merged timeline in one shot.

---

## 1. Motivation

The student-side `/course/[courseId]` view (`screens/main/courses/course/CourseScreen.tsx`) is a single scrolling screen: a parallax hero with the subject photo, an animated nav bar that fades in as the hero scrolls away, and a date-bucketed timeline of materials + assessments below the hero. It is backed by PowerSync (the `useCourseDetails` and `useCourseTimeline` hooks are watch-backed).

The teacher-side equivalent at `/subject/[subjectId]` is structurally and visually different:

- A `material-top-tabs` navigator with **Materials | Courseworks | Students** under a native header.
- Each tab is its own paginated REST list (`useLessons`, `useAssessments`, `useStudents`).
- The "info" affordance is a header button that pushes to `SubjectDetailsScreen` (a flat info layout).

Teachers and students see the same content but the teacher view costs more clicks (three tabs to skim a week's work) and looks unrelated to the student view, despite covering the same domain. This spec brings the two views into structural parity while keeping the teacher data source on REST (no new PowerSync table for the teacher flow).

## 2. Non-goals

- **No parallax/chrome changes to `LessonScreen` or `ActivityScreen`** — they're content-detail screens with no natural hero, and the same components serve the student-side `/lesson/<id>` and `/activity/<id>` routes; touching them changes both flows.
- **No real-time updates for the teacher view.** Pull-to-refresh is sufficient; if real-time becomes a need it applies equally to the existing classroom screens and gets its own spec.
- **No new "students-list" route.** The roster appears inline in `SubjectDetailsScreen` with an inline expand affordance.
- **No teacher-specific badge logic on timeline rows** — no submission counts, no completion percentages. Rows show name + date + (for in-class assessments) the "In class" pill.
- **No changes to the `/(tabs)/oversight` subject list, `OversighCourseList`, or the navigation pattern that lands on `/subject/<id>/`.**

## 3. Architecture

```
┌──────── MOBILE (this repo) ────────┐         ┌────────── SERVER (../classedge-mobile-test) ──────────┐
│                                     │         │                                                       │
│  /subject/[subjectId]/index.tsx     │         │                                                       │
│      └─ SubjectScreen               │  GET    │   /subject/<id>/timeline/                             │
│           ├─ parallax hero          ├────────►│   SubjectTimelineView                                 │
│           │   (useGetSubject)       │         │     ├─ permission: same as siblings                   │
│           ├─ animated nav bar       │  GET    │     │   (/lessons/, /activities/, /students/)        │
│           ├─ info button → ────────►│         │     ├─ Module.objects.filter(...)                     │
│           │   subject-details       │         │     │   .values_list("id","lesson_name","start_date") │
│           └─ <SubjectTimeline/>     │         │     ├─ Activity.objects.filter(...)                   │
│               (useSubjectTimeline)  │         │     │   .values_list("id","activity_name",           │
│                                     │         │     │                "end_time","classroom_mode")     │
│  /subject/[subjectId]/subject-details         │     └─ Response: {results: [TimelineItem, ...]}       │
│      └─ SubjectDetailsScreen        │         │                                                       │
│           ├─ existing layout        │         └───────────────────────────────────────────────────────┘
│           └─ NEW Students section   │
│               (useStudents)         │
│                                     │
│  features/timeline/  ◄─── shared ───┤
│      bucketize, TimelineFilterChips,│
│      TimelineRow, TimelineSkeleton  │
│                                     │
│  features/courses/components/       │
│      CourseTimeline (refactored)    │
│                                     │
│  features/oversight/components/     │
│      SubjectTimeline (new)          │
└─────────────────────────────────────┘
```

### 3.1 One-sentence overview per layer

- **Server:** new `SubjectTimelineView` returns `{results: [TimelineItem]}` for a subject (lessons + activities merged, no pagination, same wire shape the student SQL union already produces — student-specific score fields zeroed).
- **Mobile data layer:** new `getSubjectTimeline()` / `useSubjectTimeline()` in the existing `features/oversight/` module.
- **Mobile UI:** new `SubjectScreen` (parallax) + new `SubjectTimeline` (teacher orchestrator), both consuming a new shared `features/timeline/` module extracted from the existing `CourseTimeline`.
- **Routing:** delete the `subject/[subjectId]/(tabs)/` directory; add `subject/[subjectId]/_layout.tsx` + `index.tsx` mirroring the `course/[courseId]/` shape.

## 4. Server design

### 4.1 New endpoint: `GET /subject/<int:id>/timeline/`

Lives in `subject/views.py`, wired in `subject/urls.py` under the same `<int:id>/...` block as `lessons/`, `activities/`, `students/`.

**Implementation sketch:**

```python
class SubjectTimelineView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [...]  # see §4.2

    def get(self, request, id):
        lessons = Module.objects.filter(
            subject_id=id,
            start_date__isnull=False,
            end_date__isnull=False,           # see §4.3
        ).values_list("id", "lesson_name", "start_date")

        activities = Activity.objects.filter(
            subject_id=id,
            start_time__isnull=False,
            end_time__isnull=False,
        ).values_list("id", "activity_name", "end_time", "classroom_mode")

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

Two cheap `.values_list()` queries, no joins. No DRF serializer — the dicts are already in wire shape. No pagination — like the student-side SQL union, the timeline returns the subject's full content in one shot. If a single subject ever grows past the size where this is reasonable, the `results`-wrapped envelope lets us add pagination without changing callers.

### 4.2 Permissions

The endpoint uses the same auth/permission setup as the existing sibling endpoints under `subject/<id>/...` (`lessons/`, `activities/`, `students/`). The implementation step:

1. Read those three views in `subject/views.py`.
2. Apply whatever auth/permission classes they share to `SubjectTimelineView`.
3. If the siblings differ from one another, default to whatever `students/` uses (this is teacher-monitoring work and the students endpoint is the closest in spirit).

No new permission class is introduced unless implementation finds the siblings already share one and we're merely reusing it. **Specifically: do not add a membership 403 the siblings don't already have.**

### 4.3 Date-quality filters

Items must have well-formed dates before reaching the client (TypeScript `TimelineItem.startDate` is non-nullable on the mobile side). Filter at query time:

- **Lessons:** `start_date` AND `end_date` must be non-null.
- **Activities:** `start_time` AND `end_time` must be non-null.

The `startDate` field on the response is mapped from `lesson.start_date` for materials and from `activity.end_time` for assessments — matching the existing student-side SQL union, so assessments bucketize by due date.

**Open verification at implementation time:** confirm `Module` has both `start_date` and `end_date` columns. The student-side SQL union only references `m.start_date`. If `Module` doesn't have `end_date`, drop the `end_date__isnull=False` filter for lessons; activities keep both filters.

### 4.4 Tests (TDD)

`subject/tests/test_timeline_view.py` covers:

1. Empty subject → 200 + `{results: []}`.
2. Lessons returned with `type: "material"`, `startDate` from `start_date`.
3. Activities returned with `type: "assessment"`, `startDate` from `end_time`.
4. `classroomMode` is `1` for in-class activities, `0` otherwise; `0` for all lessons.
5. Lesson with `null` `start_date` or `null` `end_date` is excluded.
6. Activity with `null` `start_time` or `null` `end_time` is excluded.
7. 401 without JWT.
8. Two subjects' content stays isolated (no cross-subject leakage).

## 5. Mobile design

### 5.1 File map

```
features/
  timeline/                           NEW shared module
    types.ts                          TimelineItem, BucketKey, Filter
    bucketize.ts                      pure: items → 4 buckets, sort rules unchanged
    components/
      TimelineFilterChips.tsx         All / Assessments / Materials chips
      TimelineRow.tsx                 single card row + slots for badges + highlight variant
      TimelineSkeleton.tsx            extracted skeleton

  courses/components/
    CourseTimeline.tsx                REFACTORED — orchestrator only; consumes features/timeline

  oversight/
    oversight.apis.ts                 + getSubjectTimeline(subjectId)
    oversight.hooks.ts                + useSubjectTimeline(subjectId)
    oversight.type.ts                 + TimelineApiResponse shape
    components/
      SubjectTimeline.tsx             NEW teacher orchestrator

screens/main/oversight/
  SubjectScreen.tsx                   NEW — parallax + animated nav + <SubjectTimeline/>
  SubjectDetailsScreen.tsx            EDITED — gains Students roster section

app/(main)/subject/[subjectId]/
  _layout.tsx                         NEW — mirrors course/[courseId]/_layout.tsx
  index.tsx                           NEW — renders <SubjectScreen/>
  subject-details.tsx                 unchanged file; SubjectDetailsScreen edited in place
  (tabs)/                             DELETED in full (hard cut)
```

### 5.2 Shared timeline primitives (`features/timeline/`)

Boundary: anything that looks identical on the student and teacher sides moves in. Anything that's role-specific stays out.

**In the shared module:**
- `TimelineItem` type (matches the existing student-side shape and the new server payload exactly).
- `bucketize(items)` — the existing pure function lifted unchanged from `CourseTimeline.tsx`.
- `<TimelineFilterChips/>` — value, onChange, counts; renders the All / Assessments / Materials chip row.
- `<TimelineRow/>` — accepts item + `onPress` + optional `badges?: React.ReactNode` + optional `highlightVariant?: "due-soon" | "today" | "overdue"`. The row owns icon, title, date label, layout, accessibility; the orchestrator computes and passes badges/variant.
- `<TimelineSkeleton/>` — extracted from `CourseTimelineSkeleton`.

**Stays in each orchestrator (per option 2 chosen during brainstorming):**
- The data hook (`useCourseTimeline` for student, `useSubjectTimeline` for teacher).
- Badge composition (`Submitted · X/Y`, `In class · X/Y`, `Overdue`, etc.).
- Highlight rules (`due-soon`, `today`, `overdue`).
- The row tap target (`/material/<id>` vs `/lesson/<id>`, `/assessment/<id>` vs `/activity/<id>`).

### 5.3 `SubjectTimeline` (teacher orchestrator)

About 80 lines. Mirrors the high-level shape of the refactored `CourseTimeline`. The sketch below uses illustrative names (`BucketSection`, `InClassPill`) for compactness; implementation may inline those as plain `<View>` blocks the way `CourseTimeline` does today.

```ts
const SubjectTimeline = () => {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, isError, error } = useSubjectTimeline(subjectId);

  const items = data?.results ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  );
  const buckets = useMemo(() => bucketize(filtered), [filtered]);
  const counts = {
    all: items.length,
    assessment: items.filter((i) => i.type === "assessment").length,
    material: items.filter((i) => i.type === "material").length,
  };

  if (isLoading) return <TimelineSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;
  if (items.length === 0)
    return <EmptyState icon="FolderOpenIcon" title="No content yet" .../>;

  return (
    <View className="mt-5">
      <TimelineFilterChips value={filter} onChange={setFilter} counts={counts} />
      {visibleBuckets.map(({ key, label }) => (
        <BucketSection key={key} label={label} count={buckets[key].length}>
          {buckets[key].map((item) => (
            <TimelineRow
              key={`${item.id}-${item.type}`}
              item={item}
              onPress={() => router.push(
                item.type === "assessment"
                  ? `/activity/${item.id}`
                  : `/lesson/${item.id}`,
              )}
              badges={
                item.type === "assessment" && item.classroomMode
                  ? <InClassPill />
                  : null
              }
              highlightVariant={key === "today" ? "today" : undefined}
            />
          ))}
        </BucketSection>
      ))}
    </View>
  );
};
```

**No teacher-side `Submitted` / `Overdue` / `due-soon` badges** — those are per-student concepts and Q4 chose to zero out student fields. The only badge that surfaces is **In class** for `classroomMode` assessments (a subject-level property, not student-specific).

### 5.4 `SubjectScreen` (parallax)

Lifted structure-for-structure from `screens/main/courses/course/CourseScreen.tsx`. Concrete differences:

| Concern | `CourseScreen` (student) | `SubjectScreen` (teacher) |
|---|---|---|
| Param | `courseId` | `subjectId` |
| Subject query | `useCourseDetails(courseId)` (PowerSync) | `useGetSubject(subjectId)` (REST, already exists) |
| Hero image source | `AttachmentImage` (PowerSync path) | `<Image source={{ uri }}>` (raw REST URL) with `bg-placeholder.png` fallback |
| Hero scale | `1.5 → 1`, no `translateY` (current `CourseScreen` state) | identical |
| Nav bar fade | transparent → solid on scroll | identical |
| Title binding | `data?.subjectId.subjectName` | `data?.subjectName` |
| Info button push | `/course/<courseId>/course-details` | `/subject/<subjectId>/subject-details` |
| Body | `<CourseTimeline/>` | `<SubjectTimeline/>` |
| Pull-to-refresh | refetches `useCourseDetails` | refetches `useGetSubject` AND `useSubjectTimeline` via `Promise.all` |

**No PowerSync watch parity** — REST is fetch-on-demand. Real-time is out of scope (§2).

### 5.5 `SubjectDetailsScreen` — Students roster section

Appended below the existing Description block. No layout changes to the hero, title, info rows, or description.

**Data:** existing `useStudents(subjectId)` (infinite query). The info screen renders the first page eagerly. `data.pages[0].count` provides the total.

**Layout:**

- Uppercase `STUDENTS · {count}` section label.
- First 5 students rendered as rows: 32×32 `Avatar` (initials fallback), name (semibold), grade/section subtitle. Non-interactive.
- If `count > 5`: a "Show all N students" footer. On tap → `fetchNextPage()` exhausts pagination and renders the rest inline (no new route). Toggles to "Show less" when expanded.

**States:**
- Loading (no cached data): three skeleton rows inside the section.
- Error: inline `ErrorFallback` with retry, scoped to the section — the rest of `SubjectDetailsScreen` still renders.
- Empty (subject with no enrolled students): "No students enrolled yet" inline note, no icon block.

### 5.6 Routing changes

```
app/(main)/subject/[subjectId]/
  _layout.tsx       NEW — Stack with:
                        - <Stack.Screen name="index" options={{ headerShown: false }}/>
                        - <Stack.Screen name="subject-details" options={{ headerTitle: "Course Details" }}/>
  index.tsx         NEW — <SubjectScreen/>
  subject-details.tsx  unchanged file
  (tabs)/           DELETED (all 4 files)
```

The new `_layout.tsx` is a near-copy of `course/[courseId]/_layout.tsx`. `headerShown: false` on `index` lets `SubjectScreen` render its own absolute-positioned animated nav.

**Hard cut**: the `(tabs)` directory is deleted in the same task that adds the new `index.tsx`. No transition period.

**Forward links to the removed tabs** — `OversighCourseList` already links to `/subject/<id>` (the new index, not `/subject/<id>/(tabs)/...`). No other code links into the removed tab routes.

## 6. Data flow

### 6.1 Happy path

1. User taps a subject card on `/(tabs)/oversight` → router pushes `/subject/<id>`.
2. `SubjectScreen` mounts. `useGetSubject(id)` and `useSubjectTimeline(id)` fire in parallel.
3. Hero image, title, and timeline skeleton render immediately; data lands; UI fills in.
4. User scrolls → hero scales up on overscroll, fades out as user scrolls past `IMAGE_HEIGHT`; nav bar fades from transparent to solid; title fades in.
5. User taps the info button → `/subject/<id>/subject-details`. `SubjectDetailsScreen` reuses the warm `useGetSubject` cache, fetches `useStudents` for the roster.
6. User taps a timeline row → `/lesson/<id>` or `/activity/<id>` (existing screens, untouched).
7. User pulls to refresh → both subject and timeline queries refetch in parallel.

### 6.2 Failure paths

| Scenario | UI outcome |
|---|---|
| `useGetSubject` errors, `useSubjectTimeline` succeeds | Hero shows placeholder + empty title; timeline renders normally. |
| `useSubjectTimeline` errors, `useGetSubject` succeeds | Hero renders; timeline section shows `ErrorFallback` with retry. |
| Both error | Screen-level `ErrorFallback` (same pattern as `CourseScreen`). |
| Empty subject (no lessons + no activities) | Timeline shows "No content yet" `EmptyState`. |
| Filter chip empties view | Existing "No matching content" + "Show all" reset (lifted into the shared chip consumer). |
| `subjectPhoto` null | `bg-placeholder.png` fallback (matches `OversighCourseList`). |
| Auth expires mid-scroll | Existing axios refresh interceptor; hard-fail → 401 surfaces via the same `ErrorFallback`. |

## 7. Failure modes considered

| Scenario | Outcome |
|---|---|
| Subject deleted server-side mid-session | `useGetSubject` 404 → screen-level `ErrorFallback`. |
| Lesson/activity rows with `null` dates | Filtered out server-side (§4.3); never reach the client. |
| Stale enrollment on the teacher side | Inherits sibling endpoints' behavior; no new policy. |
| Pull-to-refresh during a pending mutation elsewhere | React Query handles dedupe; no special handling needed. |
| Very large subject (>200 items) | Endpoint still returns everything; mobile renders the full bucketized list. If volume ever bites, add server pagination behind the existing `results`-wrapped envelope. |
| First render flash (cold cache for `useGetSubject`) | One tick of skeleton; matches student-side `CourseScreen`. |

## 8. Out of scope (revisit later)

- Real-time updates for the teacher timeline.
- Parallax/chrome on `LessonScreen` / `ActivityScreen` (these are shared with the student-side; treat separately).
- Server pagination on `/subject/<id>/timeline/`.
- Student-profile tap targets in the roster.
- Search/filter in the roster (the trigger to split Students into its own route).
- Teacher-specific badge logic on timeline rows (submission counts, completion percentages).

## 9. Open implementation questions

Deferred to the implementation plan; the design does not depend on the answer:

- Whether `Module` has an `end_date` column (§4.3). If not, drop the `end_date__isnull=False` filter for lessons.
- Exact permission classes used by the existing sibling endpoints (`lessons/`, `activities/`, `students/`). The new endpoint matches whatever they do (§4.2).
- Whether `CourseTimeline` currently re-uses any other component shape we should preserve when refactoring (the lift is mechanical but worth a careful diff).
