# Archived Courses + Drawer Navigation — Design

**Date:** 2026-06-16
**Status:** Draft, awaiting user review

## 1. Goals & Scope

Replace the global `TabsHeader` with per-tab headers, introduce a `Drawer` navigator layered above the tabs, and surface "Archived Courses" + "Orbit Program" filters through the drawer. The drawer item set is role-specific.

### In scope
- Move `<TabsHeader />` from `app/(main)/(tabs)/_layout.tsx` (where it currently wraps the entire `Tabs` navigator) into `app/(main)/(tabs)/index.tsx` so it renders only on the Home tab.
- Enable expo-router's default `Tabs` header on all non-Home tabs (Courses, Teaching, Oversight, Calendar, Notifications). Every non-Home tab gets `headerRight = <SyncCenter />`.
- Wrap the tab navigator with a `Drawer` layout (`app/(main)/(drawer)/_layout.tsx`). The drawer is custom-rendered and applied only to the three "courses-shaped" tabs.
- Drawer items are filters on the active tab, dispatched as a `view` URL search param.
- Archived view: past-semester data, REST/API-backed, paginated by semester, role-scoped server-side.
- Orbit Program (Student only): client-side filter on existing PowerSync course data using `isCoil` / `isHali` / `isCte` flags.

### Out of scope
- Full Courses screen redesign (density, status pills, Today rail). The Courses screen body keeps its current single-column tall-card layout.
- Per-course manual archive control. Archiving is implicit (semester end date in the past).
- Profile screen changes.
- Calendar / Notifications visual or layout changes beyond the new header.
- Time Keeper drawer: explicitly excluded — the Oversight tab renders without a hamburger or drawer for that role.
- Expanding PowerSync sync rules to include past-semester data.

## 2. Navigation Architecture

### File structure

```
app/(main)/
  _layout.tsx                  (existing Stack — unchanged)
  (drawer)/                    ← NEW directory
    _layout.tsx                ← NEW: Drawer navigator
    (tabs)/                    ← existing tab group moves under (drawer)
      _layout.tsx              (existing — modified)
      index.tsx                (Home — gains <TabsHeader /> in body)
      courses.tsx
      teaching.tsx
      oversight.tsx
      calendar.tsx
      notifications.tsx
components/
  TabsHeader.tsx               (existing — unchanged, just relocated as a consumer)
  AppDrawerContent.tsx         ← NEW: custom drawer content
  HamburgerButton.tsx          ← NEW: small Pressable calling navigation.openDrawer()
features/courses/
  archive.hooks.ts             ← NEW: useArchivedCourses (REST + useInfiniteQuery)
  orbit.hooks.ts               ← NEW: useOrbitCourses(flag) — Student PowerSync filter
screens/main/courses/
  CoursesScreen.tsx            (existing — gains a view-param switch)
  ArchivedCourseList.tsx       ← NEW: SectionList grouped by semester
```

### Drawer layout (`(drawer)/_layout.tsx`)

- Uses expo-router's `Drawer` (from `expo-router/drawer`, backed by `@react-navigation/drawer`).
- `drawerContent={(props) => <AppDrawerContent {...props} />}` for fully custom panel rendering.
- `screenOptions.headerShown = false` — header ownership stays with the inner Tabs navigator.
- Swipe-to-open is enabled globally. For Time Keeper, the drawer becomes inert by passing `swipeEnabled: false`. Role detection uses `useStore().authUser?.role` to match the existing pattern in `(tabs)/_layout.tsx:19`.

### Tabs layout changes (`(tabs)/_layout.tsx`)

- Remove `<TabsHeader />` from line 58 (the global wrapper above `<Tabs>`).
- Flip global `screenOptions.headerShown` from `false` to `true`.
- `index` (Home): keep `headerShown: false`. Home renders `<TabsHeader />` inside its own body.
- `courses` / `teaching` / `oversight`:
  - `headerLeft = () => <HamburgerButton />` — except for Time Keeper on Oversight, where it's `undefined`.
  - `headerRight = () => <SyncCenter />`.
  - `headerTitle = <derived from view param>` — set via `useEffect` inside the screen body using `navigation.setOptions({ title })`.
- `calendar` / `notifications`:
  - `headerLeft` unset.
  - `headerRight = () => <SyncCenter />`.
  - `headerTitle = "Calendar"` / `"Notifications"`.

### Filter state — URL search param `view`

- Param key: `view`
- Values: `'current' | 'archived' | 'coil' | 'hali' | 'cte'`
- Default: `'current'` (absent param)
- Reader: `useLocalSearchParams<{ view?: '...' }>()` inside the screen
- Writer: drawer items call `router.replace('<role-tab>?view=<key>')` and then `navigation.closeDrawer()`
- Persistence: each tab maintains its own param via expo-router's tab state, so switching tabs and returning preserves the filter

### Drawer item routing

The drawer item's target tab depends on the user's role:

| Role | Target tab path |
|---|---|
| Student | `/(main)/(drawer)/(tabs)/courses` |
| Teacher | `/(main)/(drawer)/(tabs)/teaching` |
| Program Head, Academic Director | `/(main)/(drawer)/(tabs)/oversight` |
| Time Keeper | (no drawer rendered) |

Resolution helper: `getRoleTabPath(role)` lives in `features/auth/roleNav.ts`.

## 3. Drawer Contents & Per-Role Behavior

### Panel structure (top to bottom)

1. **User header block** — same data source as `TabsHeader` (`useUserDetails`):
   - Avatar (44px) using `AttachmentAvatarImage` + `AvatarFallbackImage` (matches TabsHeader.tsx:42-44).
   - First name (title-cased) on top; greeting (`getGreeting()`) beneath.
   - Tappable; navigates to `/(main)/profile` (matches TabsHeader behavior).
   - Bottom-bordered separator.
2. **Items** — role-specific (see table below).
3. **Section labels** — small uppercase label rendered above a group (e.g., `ORBIT PROGRAM`).
4. **Visual rules**:
   - Active item: filled background using `bg-foreground` + `text-background`.
   - Inactive: transparent background, regular text color.
   - Icons in 22×22 rounded squares with a light accent fill.
   - No badges or counts in v1.

### Items per role

| Role | Tab | Drawer items (in order) |
|---|---|---|
| Student | Courses | `My Courses` (current) · `Archived Courses` · *Orbit Program* → `COIL` · `HALI` · `CTE` |
| Teacher | Teaching | `Teaching` (current) · `Archived Courses` |
| Program Head / Academic Director | Oversight | `Courses` (current) · `Archived Courses` |
| Time Keeper | Oversight | *(no drawer)* |

### Header title per `view`

| Role | `current` | `archived` | `coil` | `hali` | `cte` |
|---|---|---|---|---|---|
| Student | "My Courses" | "Archived Courses" | "COIL" | "HALI" | "CTE" |
| Teacher | "Teaching" | "Archived Courses" | n/a | n/a | n/a |
| Program Head / Academic Director | "Courses" | "Archived Courses" | n/a | n/a | n/a |

### Per-view data scope

| View | Student | Teacher | Program Head | Academic Director |
|---|---|---|---|---|
| `current` | own enrollments in current semester | own assigned subjects in current semester | dept subjects in current semester | all subjects in current semester |
| `archived` | own enrollments in past semesters | own assigned in past semesters | dept past subjects | all past subjects |
| `coil` | own enrollments where `isCoil = 1` | n/a | n/a | n/a |
| `hali` | own enrollments where `isHali = 1` | n/a | n/a | n/a |
| `cte` | own enrollments where `isCte = 1` | n/a | n/a | n/a |

`AppDrawerContent` builds its item list via `getDrawerItems(role)` returning a typed structure of `{ items, sections }`. No hard-coded role branches in JSX.

## 4. Server + Data Flow

### Data sources by view

| View | Source | New server work? |
|---|---|---|
| `current` | Existing PowerSync (`studentEnrolledCoursesTable` for Student; equivalents for Teacher/Oversight) | None |
| `archived` | New REST endpoint | Yes — new view + serializer + URL |
| `coil` / `hali` / `cte` (Student) | Existing PowerSync (`coursesTable.isCoil/isHali/isCte`) | None |

### Why REST (and not PowerSync) for archived

PowerSync sync rules are scoped to the active semester (confirmed by the `isActiveSemester = 1` filter in `getStudentCourses`). Expanding sync rules to include all historical data would balloon device storage — especially for Academic Director, who would sync the entire institution's history. REST + TanStack Query covers occasional access cleanly, with cached pages within a session.

### New server endpoint

```
GET /api/mobile/archived-courses/?page=<n>
```

Lives under `mobile/views/` (alongside `subject_lesson_views.py`, etc.), wired in `mobile/urls.py`. Role-aware on the server, matching the existing `SubjectViewSet` pattern in `subject/views/subject_view.py:26-84`:

| Role | Server queryset |
|---|---|
| Student | `SubjectEnrollment.objects.filter(user=user, semester__end_date__lt=today)` joined to `Subject` |
| Teacher | `Subject.objects.filter(assign_teacher=user, semester__end_date__lt=today)` |
| Program Head | `Subject.objects.filter(department=user.department, semester__end_date__lt=today)` |
| Academic Director | `Subject.objects.filter(semester__end_date__lt=today)` |
| Time Keeper | `403 Forbidden` |

(Exact ORM relationships TBD during implementation — depends on whether `department` is on `Subject` or via a join; verify against `subject/models/subject_model.py:11-93`.)

### Response shape

Semester-grouped, paginated by *semester*:

```json
{
  "results": [
    {
      "semester": {
        "id": 12,
        "name": "Fall 2025",
        "start_date": "2025-08-15",
        "end_date": "2025-12-20"
      },
      "courses": [
        {
          "id": 401,
          "subject_name": "Calculus",
          "subject_code": "MATH101",
          "subject_photo": "<url>",
          "room_number": "204",
          "teacher_name": "Mr. Cruz",
          "is_coil": false,
          "is_hali": false,
          "is_cte": false
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 5,
    "total_semesters": 12,
    "has_next": true
  }
}
```

Page size = 5 semesters per page (configurable). Newest semester first.

### Permissions & audit

- Permission class: `IsAuthenticated`; role check happens in `get_queryset()` and via an early `PermissionDenied` raise for Time Keeper.
- Audit: extend `UserActivityLog.ACTION_*` with `ACTION_VIEW_ARCHIVED_COURSES` and log on every successful request.

### Client hooks

```
features/courses/archive.hooks.ts (new)
  useArchivedCourses()
    Uses useInfiniteQuery from @tanstack/react-query
    queryKey: ['archived-courses', authUser.id]
    fetchPage: GET /api/mobile/archived-courses/?page=<n>
    Flattens results into a SectionList-ready shape:
      [{ title: 'Fall 2025', data: [Course, Course, ...] }, ...]

features/courses/orbit.hooks.ts (new — Student only)
  useOrbitCourses(flag: 'coil' | 'hali' | 'cte')
    Same Drizzle/PowerSync query as useStudentCourses(),
    + WHERE clause on coursesTable[isCoil|isHali|isCte] = 1
    Returns the same shape as useStudentCourses

features/courses/courses.hooks.ts (existing — unchanged)
  useStudentCourses() continues to drive view='current'
```

### Rendering switch (`screens/main/courses/CoursesScreen.tsx`)

```ts
const { view = 'current' } = useLocalSearchParams<{ view?: ViewKey }>();

if (view === 'archived') return <ArchivedCourseList />;
if (view === 'coil' || view === 'hali' || view === 'cte') {
  return <CourseList coursesQuery={useOrbitCourses(view)} />;
}
return <CourseList coursesQuery={useStudentCourses()} />;
```

Teaching and Oversight screens follow the same pattern with their own data hooks.

### Offline behavior

- `current` and Orbit views: work offline (PowerSync).
- `archived`: requires network. When offline:
  - If cached pages exist (TanStack Query keepPreviousData), show them with a banner explaining staleness.
  - Otherwise, show an offline empty state with retry CTA.

## 5. Testing, Risks, Acceptance

### Testing strategy

**Server (TDD per repo convention):**
- File: `mobile/tests/test_archived_courses_view.py`
- Failing test → confirm fail → minimal impl → confirm pass.
- Cases:
  - Student sees only own past enrollments.
  - Teacher sees only own past assignments.
  - Program Head sees dept-scoped past subjects.
  - Academic Director sees institution-wide past subjects.
  - Time Keeper receives 403.
  - Empty result for users with no past data returns `results: []`.
  - Pagination boundary: page 1 last semester ≠ page 2 first semester.
  - `UserActivityLog` row is created with `ACTION_VIEW_ARCHIVED_COURSES`.

**Mobile (type-driven, no Jest in this repo):**
- `pnpm typecheck` after each task.
- `pnpm lint` after each task.
- Manual simulator smoke per role:
  - Open drawer from hamburger and from swipe-left edge.
  - Tap each role-appropriate drawer item; verify title swap, list contents, offline state.
  - Verify hamburger is absent for Time Keeper.
  - Verify TabsHeader appears only on Home.
  - Verify SyncCenter appears on the right of every non-Home tab header.

### Risks / things to watch

- **Drawer swipe vs. card carousels.** If the Courses cards (or any nested horizontal scroll) clashes with the drawer swipe gesture, narrow the drawer's `edgeWidth` to require swipe from the far left.
- **`SubjectViewSet` role logic drift.** Extract the role → queryset mapping into a shared helper so the archived endpoint and the existing endpoint never disagree.
- **TabsHeader `paddingTop: insets.top`.** Currently sized to sit at the very top (TabsHeader.tsx:36). When wrapped inside the Home screen body, double-padding is possible. Inspect Home's existing layout; drop the inset padding from TabsHeader if the Home shell already handles safe-area.
- **Header title swap.** Use `useEffect` keyed on `view` to call `navigation.setOptions({ title })`. Watch for animation flicker; if visible, use the static `options.headerTitle` with a function that reads from a context.
- **Time Keeper inheritance.** Two independent code paths gate Time Keeper access: `headerLeft` (no hamburger) and Drawer `swipeEnabled` (no swipe). Both must check `role === "Time Keeper"`; missing one leaves a back door.
- **`getStudentCourses` filter.** Confirm the existing query in `features/courses/courses.service.ts` filters by `isActiveSemester = 1` before relying on the assumption. If it doesn't, "current" view in our new system will inadvertently include past data.

### Open items deferred (not blockers)

- Migrating Archived view to PowerSync if Academic Director usage is heavy enough to justify the sync footprint.
- Server-side `?flag=` filter for Orbit (today: client-side, Student-only).
- Per-course manual archive control (rejected for this iteration).
- Full Courses screen redesign (Today rail, density list, status pills) — separate spec.

### Acceptance criteria

- [ ] `TabsHeader` renders only on the Home tab; all other tabs show the default Tabs header with `<SyncCenter />` on the right.
- [ ] Courses, Teaching, Oversight tabs render a hamburger that opens the drawer — except Time Keeper on Oversight.
- [ ] Drawer renders role-correct items (Student / Teacher / Program Head & AD / Time Keeper-absent).
- [ ] Drawer item tap navigates to the role's tab with `?view=<key>`, closes the drawer, and updates the header title.
- [ ] `view=current` uses the existing PowerSync hook with no regression in the existing Courses screen.
- [ ] `view=archived` uses the new REST endpoint, lists past semesters grouped, paginated by semester.
- [ ] `view=coil|hali|cte` (Student) filters existing PowerSync data by the relevant flag.
- [ ] Server endpoint role-scopes correctly; Time Keeper receives 403.
- [ ] `UserActivityLog` records `ACTION_VIEW_ARCHIVED_COURSES` on each successful archive fetch.
- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] Manual simulator smoke passes for Student, Teacher, Program Head, Academic Director, and Time Keeper.
