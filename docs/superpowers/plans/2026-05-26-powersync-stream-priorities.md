# PowerSync Stream Priorities — Snappy Cold Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user enter the app as soon as their identity + current-term metadata sync, then progressively fill in courses, then assessments, instead of blocking on the full sync of every stream.

**Architecture:** Three changes split between backend sync rules and the React Native client. (1) Re-tier the existing `streams` block in `sync-rules.yaml` into four priority bands (0/1/2/3 reserved). (2) Replace `SyncGate`'s "every stream synced" check with PowerSync's first-class `status.statusForPriority(0).hasSynced` primitive so the splash screen releases on priority-0 only. (3) Add per-screen "still syncing" pills for screens whose data is in priority 2 so the user knows fresh data is on its way without staring at a blank list.

**Tech Stack:** `@powersync/common@1.52.0` (verified: `SyncStatus.statusForPriority` exists at `node_modules/@powersync/common/src/db/crud/SyncStatus.ts:190`), `@powersync/react-native@1.34.0`, PowerSync service (backend sync rules — `config: edition: 3`).

**Project conventions:**
- No Jest/Vitest setup — verification is `pnpm typecheck` + `pnpm lint` + manual device runs.
- Per the user's standing instruction, this plan does **not** auto-stage or auto-commit.
- Backend sync-rules file location depends on the user's PowerSync infra setup; the plan uses `sync-rules.yaml` as a placeholder and asks the user to confirm before Task A starts.

**Priority assignment summary (decision points the user should sign off on before execution):**

| Priority | Streams | Rationale |
|---|---|---|
| **0 — blocks app entry** | `user_identity`, `current_term_data` | Tiny payload (single profile row + small semester/term tables). Without these, no header, no greeting, no tab routing — nothing else works. |
| **1 — fills shortly after entry** | `user_notifications`, `student_enrolled_courses`, `courses_and_schedule`, `announcements_and_events`, `assigned_courses_for_teacher` | The data that drives the home tab, courses tab, calendar tab. User sees a usable app within seconds of opening. |
| **2 — background, non-blocking** | `course_materials_and_assessments`, `current_term_courses` | Heavy — assessments, question banks, retake records, classroom student lists. Per-screen "syncing…" pills cover the UX gap. |
| **3 — reserved** | (none today) | Available for future "low-value" streams. |

**Key change from today's structure:** the existing `user_data` stream is split into `user_identity` (the rows the app's chrome needs to render) and `user_notifications` (the user's bell list, which can lag). If notifications stay coupled to identity at priority 0, the gate stalls on a potentially large `logs_notification` table.

**Out of scope (deferred):**
- Backend re-bucketing for partial sync within a single stream (e.g., paginating notifications). The split above is sufficient.
- Parameterized stream subscriptions from the client — the existing `auto_subscribe: true` model is fine.
- Migrating React-Query API hooks (`useCourseStudents` etc.) to PowerSync `watch()` — separate concern.

---

## File Structure

**Modified files:**
- `sync-rules.yaml` (or wherever the user keeps their PowerSync sync rules — confirm path before Task A) — re-tier `streams[*].priority`, split `user_data` into `user_identity` + `user_notifications`.
- `features/sync/components/SyncGate.tsx` — switch the gate condition from "every stream synced" to `status.statusForPriority(0).hasSynced`.
- `features/sync/components/SyncingPill.tsx` (**new**) — small reusable badge that shows "Syncing…" when a given priority hasn't finished syncing yet.
- `screens/main/courses/course/material/MaterialsListScreen.tsx`, `screens/main/courses/course/assessment/AssessmentsListScreen.tsx` (or wherever those lists live — Task C confirms paths) — render `<SyncingPill priority={2} />` near the list header.

**No files deleted. No schema changes.**

---

## Task A: Re-Tier Backend Sync Rules

**Why:** Stream priorities are a server-side construct — the client cannot fake them. Until the YAML reassigns priorities, the client gate has nothing to release on. This task is the foundation everything else depends on.

**Files:**
- Modify: `sync-rules.yaml` (confirm the actual path with the user before editing — could be `infra/powersync/sync-rules.yaml`, `.powersync/sync-rules.yaml`, or a separate repo).

**Risk:** Medium. A bad priority assignment can break the gate for everyone. The risk is mitigated because `auto_subscribe: true` is preserved on all streams — every user still receives every stream they used to; only the *order* changes.

**Deployment note:** PowerSync's `sync-rules.yaml` is hot-reloadable on most deployments, but a sync-rules change triggers a full re-sync for connected clients (the service rebuilds bucket assignments). Roll out during a low-traffic window. Existing client builds will continue to work because they don't yet depend on the new priorities — they'll just see all streams sync as before, possibly with the new priority order having no UX effect until Task B ships.

- [ ] **Step 1: Confirm the sync-rules file path with the user**

The plan assumes a single `sync-rules.yaml`. If the user keeps it in a separate ops repo, get the absolute path before editing.

- [ ] **Step 2: Replace the `streams` block**

Replace the entire `streams:` section of the current sync rules with the following. The `with:` and `config:` blocks above it stay unchanged.

```yaml
streams:
  # ============================================================
  # PRIORITY 0 — blocks app entry (must be tiny and fast)
  # ============================================================

  user_identity:
    auto_subscribe: true
    priority: 0
    queries:
      - SELECT * FROM accounts_customuser WHERE id = CAST(auth.user_id() AS INTEGER)
      - SELECT * FROM accounts_profile WHERE user_id = CAST(auth.user_id() AS INTEGER)

  current_term_data:
    auto_subscribe: true
    priority: 0
    queries:
      - SELECT * FROM course_semester WHERE end_semester = FALSE
      - SELECT * FROM course_term WHERE semester_id IN current_semester

  # ============================================================
  # PRIORITY 1 — fills in shortly after app entry
  # ============================================================

  user_notifications:
    auto_subscribe: true
    priority: 1
    queries:
      # NOTE: column is `user_id_id` if the Django FK field is named
      # `user_id = ForeignKey(...)` (Django auto-appends `_id`).
      # Confirm against logs/models.py — change to `user_id` if the FK
      # field is named `user` instead.
      - SELECT * FROM logs_notification WHERE user_id_id = CAST(auth.user_id() AS INTEGER)

  announcements_and_events:
    auto_subscribe: true
    priority: 1
    queries:
      - SELECT * FROM calendars_event
      - SELECT * FROM calendars_announcement
      - SELECT * FROM calendars_announcement_events
      - |
        SELECT * FROM accounts_profile
        WHERE user_id IN (SELECT created_by_id FROM calendars_event)
      - |
        SELECT * FROM accounts_profile
        WHERE user_id IN (SELECT created_by_id FROM calendars_announcement)

  student_enrolled_courses:
    auto_subscribe: true
    priority: 1
    query: |
      SELECT * FROM course_subjectenrollment
      WHERE student_id = CAST(auth.user_id() AS INTEGER)
        AND is_active_semester = TRUE

  courses_and_schedule:
    auto_subscribe: true
    priority: 1
    queries:
      - |
        SELECT id, subject_name, subject_description, subject_code,
               subject_photo, room_number, is_hali, is_coil, is_cte,
               duration, assign_teacher_id, subject_type
        FROM subject_subject
        WHERE id IN student_enrollments
      - |
        SELECT id, schedule_start_time, schedule_end_time,
               days_of_week, subject_id, is_active_semester
        FROM subject_schedule
        WHERE is_active_semester = TRUE
          AND subject_id IN student_enrollments
      - |
        SELECT * FROM accounts_profile
        WHERE user_id IN (
          SELECT assign_teacher_id FROM subject_subject
          WHERE id IN student_enrollments
        )

  assigned_courses_for_teacher:
    auto_subscribe: true
    priority: 1
    query: |
      SELECT id, subject_name, subject_description, subject_code,
             subject_photo, room_number, is_hali, is_coil, is_cte,
             duration, assign_teacher_id, subject_type
      FROM subject_subject
      WHERE id IN teacher_subjects

  # ============================================================
  # PRIORITY 2 — background, non-blocking
  # ============================================================

  course_materials_and_assessments:
    auto_subscribe: true
    priority: 2
    queries:
      # Materials
      - |
        SELECT id, file_name, file, iframe_code, url, start_date,
               end_date, description, subject_id
        FROM module_module
        WHERE subject_id IN student_enrollments
      # Assessments
      - |
        SELECT local_id AS id, * FROM activity_activity
        WHERE subject_id IN student_enrollments
      # Student's own assessment instances
      - |
        SELECT local_id AS id, * FROM activity_studentactivity
        WHERE subject_id IN student_enrollments
          AND student_id = CAST(auth.user_id() AS INTEGER)
      # Question bank
      - |
        SELECT * FROM activity_activityquestion
        WHERE subject_id IN student_enrollments
      - |
        SELECT * FROM activity_questionchoice
        WHERE subject_id IN student_enrollments
      - SELECT * FROM activity_quiztype
      # Student's own attempts
      - |
        SELECT local_id AS id, * FROM activity_retakerecord
        WHERE student_id = CAST(auth.user_id() AS INTEGER)
      # Student's own attempt answer details
      - |
        SELECT local_id AS id, * FROM activity_retakerecorddetail
        WHERE student_id = CAST(auth.user_id() AS INTEGER)
      # NOTE: `activity_studentquestion` MUST exist in client AppSchema
      # (powersync/schema.ts). PowerSync silently drops rows for tables
      # the client doesn't declare.
      - |
        SELECT * FROM activity_studentquestion
        WHERE student_id = CAST(auth.user_id() AS INTEGER)

  current_term_courses:
    auto_subscribe: true
    priority: 2
    queries:
      - |
        SELECT * FROM course_subjectenrollment
        WHERE subject_id IN teacher_subjects
          AND is_active_semester = TRUE
      - |
        SELECT
          local_id AS id, local_id, activity_name, start_time, end_time,
          show_score, max_retake, time_duration, max_score, passing_score,
          passing_score_type, retake_method, activity_instruction,
          is_graded, shuffle_questions, subject_id, activity_type_id,
          classroom_mode, term_id
        FROM activity_activity
        WHERE subject_id IN teacher_subjects
          AND classroom_mode = TRUE
      - |
        SELECT * FROM activity_activitytype
        WHERE name <> 'Attendance'
      - |
        SELECT id, first_name, last_name, student_photo, user_id
        FROM accounts_profile
        WHERE user_id IN (
          SELECT student_id FROM course_subjectenrollment
          WHERE subject_id IN teacher_subjects
            AND is_active_semester = TRUE
        )
      - |
        SELECT local_id AS id, * FROM activity_studentactivity
        WHERE subject_id IN teacher_subjects
```

- [ ] **Step 3: Lint the YAML**

If the user has a PowerSync CLI installed, run their usual validation command (e.g. `powersync diagnose -p sync-rules.yaml` or the equivalent). If not, at minimum run a YAML linter to catch syntax errors before deploy.

- [ ] **Step 4: Deploy to a non-production PowerSync instance first**

If staging exists, push the new rules there. If not, get explicit user approval to roll directly to prod (with the understanding that connected clients will trigger a re-sync).

- [ ] **Step 5: Smoke-test with the unmodified client**

Connect a device build that does NOT yet include the Task B/C client changes. Confirm:
- The app still loads (the existing `SyncGate` will continue waiting for every stream).
- All previously-visible data still appears — no rows missing for any user role.
- Streams sync in the new priority order (visible in PowerSync logs).

Until Task B ships, users see no UX change — that's expected. This step is purely to confirm the new YAML doesn't break sync.

- [ ] **Step 6: Checkpoint**

Report to the user:
- The deployed sync-rules diff.
- Confirmation that a smoke-test client still works with the new rules.
- Any unexpected behavior in PowerSync service logs (rejected queries, schema mismatches).

Pause for user review before starting Task B.

---

## Task B: Make `SyncGate` Release on Priority 0

**Why:** With Task A deployed, the server is now ready to release priority-0 data before priority-1/2 data. But today's `SyncGate` (`features/sync/components/SyncGate.tsx:11-14`) waits for `streams.every((s) => s.subscription.hasSynced === true)` — meaning it still blocks on every stream regardless of priority. This task is the change that actually delivers the cold-start speedup users feel.

**Files:**
- Modify: `features/sync/components/SyncGate.tsx` (full rewrite — file is 40 lines)

**Risk:** Low. The change is a single condition swap, well-isolated behind one component. `useStatus().statusForPriority(0)` always returns a `SyncPriorityStatus` (never null per SDK contract — see `SyncStatus.ts:190-205`), so the new condition is type-safe without defensive null checks.

- [ ] **Step 1: Read the current `SyncGate`**

The current full file (`features/sync/components/SyncGate.tsx`) is:

```tsx
import { useEffect, useRef, useState } from "react";
import { useStatus } from "@powersync/react-native";
import SyncSplash from "./SyncSplash";

type Props = { children: React.ReactNode };

export const SyncGate = ({ children }: Props) => {
  const status = useStatus();
  const streams = status.syncStreams;

  const allStreamsSynced =
    streams != null &&
    streams.length > 0 &&
    streams.every((s) => s.subscription.hasSynced === true);

  // Returning user with cached data: hasSynced is true the moment SQLite
  // opens, so we can let them in immediately even if currently offline.
  // Capture at mount so a mid-session flip doesn't confuse us.
  const wasSyncedAtMountRef = useRef<boolean | null>(null);
  if (wasSyncedAtMountRef.current === null) {
    wasSyncedAtMountRef.current = status.hasSynced === true;
  }
  const returningUser = wasSyncedAtMountRef.current === true;

  // First-time sync latch: once every stream is synced, stay open even if
  // connectivity drops (which clears syncStreams metadata).
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (allStreamsSynced) setOpened(true);
  }, [allStreamsSynced]);

  if (returningUser || opened) {
    return <>{children}</>;
  }

  return <SyncSplash />;
};

export default SyncGate;
```

- [ ] **Step 2: Replace the file contents**

Replace the entire file with:

```tsx
import { useEffect, useRef, useState } from "react";
import { useStatus } from "@powersync/react-native";
import SyncSplash from "./SyncSplash";

type Props = { children: React.ReactNode };

// Priority 0 covers user identity + current term metadata — the minimum
// needed to render the app shell. See sync-rules.yaml for the assignment.
const ENTRY_PRIORITY = 0;

export const SyncGate = ({ children }: Props) => {
  const status = useStatus();
  const prioritySynced = status.statusForPriority(ENTRY_PRIORITY).hasSynced === true;

  // Returning user with cached data: hasSynced is true the moment SQLite
  // opens, so we can let them in immediately even if currently offline.
  // Capture at mount so a mid-session flip doesn't confuse us.
  const wasSyncedAtMountRef = useRef<boolean | null>(null);
  if (wasSyncedAtMountRef.current === null) {
    wasSyncedAtMountRef.current = status.hasSynced === true;
  }
  const returningUser = wasSyncedAtMountRef.current === true;

  // First-time sync latch: once priority 0 is synced, stay open even if
  // connectivity drops (which can clear transient sync metadata).
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (prioritySynced) setOpened(true);
  }, [prioritySynced]);

  if (returningUser || opened) {
    return <>{children}</>;
  }

  return <SyncSplash />;
};

export default SyncGate;
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: pass. `statusForPriority` is a real method on `SyncStatus` (`@powersync/common/src/db/crud/SyncStatus.ts:190`) and `useStatus` returns a `SyncStatus`.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: no new errors in `SyncGate.tsx`.

- [ ] **Step 5: Verify the behaviour change on device — cold-start path**

Pre-condition: have a test account whose sync data is non-trivial (at least 100+ assessment rows so the priority-2 sync visibly takes time).

a. Uninstall the app (forces fresh sync with empty SQLite).
b. Reinstall and sign in.
c. Time how long the splash screen stays visible. Before this change: it stayed until every stream was synced. After this change: it should release as soon as priority 0 (just identity + term metadata) finishes — typically a couple of seconds on a normal connection.
d. After release, the courses tab should render. Some screens may briefly show empty lists while priority-2 data is still arriving — that's the gap Task C fills.

- [ ] **Step 6: Verify the cached / offline path**

a. Kill the app after a successful sync.
b. Turn airplane mode on.
c. Re-open the app. Expected: the app enters immediately via the `returningUser` branch — same behaviour as before (no regression).

- [ ] **Step 7: Checkpoint**

Report to the user:
- Diff of `SyncGate.tsx`.
- Wall-clock time from "tap Sign In" to "courses tab visible" before vs after.
- Confirmation that the offline cached-entry path still works.
- Any screens that look unacceptably empty while priority-2 is still syncing — these become the candidates for Task C.

Pause for user review before starting Task C.

---

## Task C: Per-Screen "Syncing…" Affordances for Priority-2 Screens

**Why:** Task B lets the user into the app fast, but they'll briefly see empty lists on screens that consume priority-2 data (materials, assessments, classroom lists). A small visible "Syncing…" pill near the list header signals "this isn't empty forever, fresh data is on its way." Without it, the empty state looks like a bug.

**Files:**
- Create: `features/sync/components/SyncingPill.tsx`
- Modify: the two list screens that show priority-2 data. Confirm exact paths at Step 1 — likely candidates from `git ls-files` patterns:
  - `screens/main/courses/course/material/*ListScreen.tsx`
  - `screens/main/courses/course/assessment/*ListScreen.tsx`
  - `screens/main/classroom/*ListScreen.tsx` (teacher path)

**Risk:** Very low. Pure additive UI — no logic changes to data flow.

- [ ] **Step 1: Identify the priority-2 screens**

Use Glob/Grep to find the components that render lists of assessments, materials, or classroom activities. Confirm with the user before editing if any feel ambiguous. Common candidates:

```
screens/main/courses/course/material/
screens/main/courses/course/assessment/
screens/main/classroom/
```

- [ ] **Step 2: Create `SyncingPill.tsx`**

Create `features/sync/components/SyncingPill.tsx`:

```tsx
import { useStatus } from "@powersync/react-native";
import { Text, View } from "react-native";

type Props = {
  /** The priority level this pill represents. Pill is visible while
   *  the given priority has not yet finished its first sync. */
  priority: number;
  /** Optional label override. Defaults to "Syncing…" */
  label?: string;
};

export const SyncingPill = ({ priority, label = "Syncing…" }: Props) => {
  const status = useStatus();
  const synced = status.statusForPriority(priority).hasSynced === true;
  if (synced) return null;

  return (
    <View className="self-start rounded-full bg-amber-100 px-2 py-0.5">
      <Text className="text-xs text-amber-900">{label}</Text>
    </View>
  );
};

export default SyncingPill;
```

(If the project uses a different className/styling convention — confirm via a quick `Grep "rounded-full"` in `features/` and align to whatever pattern is in use.)

- [ ] **Step 3: Render the pill on each priority-2 screen**

For each list screen identified in Step 1, import `SyncingPill` and render it next to or just below the list's section header. Example for an assessments list:

```tsx
import SyncingPill from "@/features/sync/components/SyncingPill";

// ... inside the component, near the section header:
<View className="flex-row items-center gap-2">
  <Text className="text-base font-semibold">Assessments</Text>
  <SyncingPill priority={2} />
</View>
```

Repeat the same pattern for materials and classroom screens.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: no new errors in the new file or the edited screens.

- [ ] **Step 6: Verify on device**

a. Uninstall and reinstall the app (forces fresh sync).
b. Sign in. As soon as the courses tab renders (priority 0 done), open a course and navigate to Assessments / Materials.
c. Confirm the "Syncing…" pill appears while priority 2 is still arriving and disappears once it completes.
d. Wait for sync to complete, then navigate again. Pill should not appear (`hasSynced` stays true for the session).

- [ ] **Step 7: Checkpoint**

Report to the user:
- Diff of the new file + each modified screen.
- A short device-test confirmation (screenshot/video if available).

---

## Self-Review

Re-reading against the user-provided current sync rules:

- ✅ **Every existing stream is accounted for** in the new tier structure. The rename is `user_data` → `user_identity` + `user_notifications`; everything else keeps its name.
- ✅ **No stream contents changed** — only `priority:` values were re-assigned. SQL queries are byte-for-byte identical to the input.
- ✅ **`with:` block is preserved** unchanged — `current_semester`, `student_enrollments`, `teacher_subjects` referenced by streams still exist.
- ✅ **`config: edition: 3`** preserved.
- ✅ **`auto_subscribe: true`** preserved on every stream — no client subscribe-code changes required.
- ✅ **Client gate primitive verified:** `SyncStatus.statusForPriority(0).hasSynced` returns a defined value (per SDK source, falls back to `this.hasSynced` if no entries are present), so the new condition is never undefined-checking a missing API.
- ✅ **Returning-user / offline path preserved** — the `wasSyncedAtMountRef` branch is unchanged, so users with cached data still bypass the splash regardless of connectivity.

**Placeholder scan:** every step has either a code block or an exact command. No "TBD"/"TODO" markers found. Task C uses a placeholder for screen paths (Step 1) but explicitly requires confirmation before edits — that's a deliberate hand-off, not a missing detail.

**Type consistency:** `ENTRY_PRIORITY` is the only new constant; it's used in one place. `SyncingPill`'s `priority: number` matches `statusForPriority(priority: number)`. No mismatches.

**Spec coverage check:**

- "Make cold start fast" → Tasks A + B.
- "Don't leave users staring at empty lists" → Task C.
- "Don't break the offline cached-entry path" → preserved in Task B step 6.
- "Keep heavy data (assessments, classroom rosters) syncing" → still subscribed, just at lower priority.

No gaps found.
