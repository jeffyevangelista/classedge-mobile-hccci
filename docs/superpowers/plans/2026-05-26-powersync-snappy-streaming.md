# PowerSync Streaming Performance — Snappy Fresh Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make freshly replicated PowerSync data appear faster and feel snappier on the client, with no backend changes required.

**Architecture:** Three independent, safe-to-ship-individually changes — (1) swap the JS sync client for the Rust client to raise replication throughput, (2) add SQLite indexes on the hot columns that drive course/assessment list screens, and (3) eliminate the 60-second `setInterval` re-query in `useCoursePendingCounts` by making it a pure reactive `watch()` and classifying "due" vs "overdue" in JS.

**Tech Stack:** `@powersync/react-native` ^1.34.0, `@powersync/op-sqlite` ^0.9.6, `@powersync/common` 1.52.0, op-sqlite, Drizzle ORM, Expo SDK 54, React 19.

**Project conventions:**
- This repo has no Jest/Vitest setup — there is no `test` script in `package.json`. Verification uses TypeScript (`tsc --noEmit`), Biome (`pnpm lint`), manual device runs, and SQLite inspection via `expo-drizzle-studio-plugin`.
- Per the user's standing instruction, this plan does **not** auto-stage or auto-commit. The user will commit between tasks.
- Each task ends with a "Checkpoint" step describing what to show the user before moving on.

**Out of scope (deliberately deferred):**
- Backend sync-rules changes (priority groups, partial streams). The client work in Task 1 *enables* the client to benefit from server-side priorities later, but does not require them today.
- Refactoring `uploadData()` for batched CRUD — separate plan.
- Migrating React-Query-cached endpoints to PowerSync `watch()` — separate plan.

---

## File Structure

**Modified files:**
- `powersync/system.ts` — pass `clientImplementation: SyncClientImplementation.RUST` to `PowerSyncDatabase`; add `CREATE INDEX` statements inside `setupPowerSync()`.
- `features/courses/courses.hooks.ts` — rewrite `useCoursePendingCounts` so the SQL query is purely reactive (no time-parameter re-execution) and time-based classification happens in JS.

**No new files. No files deleted.**

---

## Task 1: Enable the Rust Sync Client

**Why:** PowerSync ships two sync client implementations. The default JavaScript client is being deprecated in favor of the Rust client, which has materially higher streaming throughput and lower CPU on the device — the single biggest "fresh data appears faster" lever available without backend changes. The Rust client is supported by `@powersync/op-sqlite` ^0.9.6 (this project already uses it) and is opt-in via a single constructor option.

**Files:**
- Modify: `powersync/system.ts:1-22`

**Risk:** Low. The Rust client is the recommended path on modern SDK versions and is API-compatible. If it behaves unexpectedly, revert is a one-line change.

- [ ] **Step 1: Read the current PowerSyncDatabase construction**

Open `powersync/system.ts`. The current code is:

```ts
import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { OPSqliteOpenFactory } from "@powersync/op-sqlite";
import { PowerSyncDatabase } from "@powersync/react-native";
import { open } from "@op-engineering/op-sqlite";
import { AppSchema } from "./AppSchema";
import { Connector } from "./Connector";
import * as drizzleSchema from "./schema";

const opSqlite = new OPSqliteOpenFactory({
  dbFilename: "powersync.db",
});

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: opSqlite,
});
```

- [ ] **Step 2: Add the `SyncClientImplementation` import**

Edit `powersync/system.ts` to add `SyncClientImplementation` to the existing `@powersync/react-native` import:

```ts
import {
  PowerSyncDatabase,
  SyncClientImplementation,
} from "@powersync/react-native";
```

- [ ] **Step 3: Pass `clientImplementation` to the database constructor**

Replace the `new PowerSyncDatabase({ ... })` block with:

```ts
export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: opSqlite,
  sync: {
    clientImplementation: SyncClientImplementation.RUST,
  },
});
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: no new errors. If `SyncClientImplementation` is not exported from `@powersync/react-native` in this version, fall back to importing it from `@powersync/common` instead (same symbol, re-exported) and re-run.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: pass.

- [ ] **Step 6: Smoke-test on device**

Start the app with `pnpm start:dev` and sign in on a device or simulator. Observe in the Metro console:
- No `"PowerSync initialization failed"` log.
- The existing `[Connector]` upload logs continue to appear when actions are taken.
- `SyncGate` lets the app render after sync completes (same UX as before — just faster).

If sync never completes or the app crashes with a native error mentioning the sync client, revert this task and report.

- [ ] **Step 7: Checkpoint**

Report to the user:
- Diff of `powersync/system.ts`.
- Cold-start time on first sign-in (rough — wall clock from "tap Sign In" to "courses tab visible").
- Any new warnings in the Metro console.

Pause for user review before starting Task 2.

---

## Task 2: Add SQLite Indexes for Hot Query Columns

**Why:** The Explore report found exactly one secondary index in the entire local database (`idx_attachments_state_priority` on `attachments_local`). Every assessment / classroom / course-list query is currently doing a full table scan on `activity_activity`, `activity_studentactivity`, and `activity_retakerecord`. These tables grow without bound as the student term progresses. Adding the indexes below turns the `useCoursePendingCounts` JOIN (the worst offender — runs every 60 seconds) from O(n × m) into O(log n + m).

**Why these specific indexes:**

| Index | Query that benefits | File:line |
|---|---|---|
| `activity_activity (subject_id, classroom_mode, start_time)` | `useCoursePendingCounts` outer scan; classroom assessment lists | `features/courses/courses.hooks.ts:99-123` |
| `activity_studentactivity (student_id, activity_id)` | JOIN in `useCoursePendingCounts`; per-student score lookups | `features/courses/courses.hooks.ts:111` |
| `activity_studentactivity (activity_local_id)` | Classroom scoring screens (`WHERE activity_local_id = ?` queries) | reported in Explore findings |
| `activity_retakerecord (student_activity_id, status)` | Subquery in `useCoursePendingCounts` | `features/courses/courses.hooks.ts:114-115` |
| `course_subjectenrollment (student_id, is_active_semester)` | `useStudentCourses` and tab header | `features/courses/courses.service.ts` (called from `courses.hooks.ts:21-26`) |
| `module_module (subject_id)` | Course material list | `materialsTable` schema |

**Files:**
- Modify: `powersync/system.ts:38-59`

**Risk:** Very low. `CREATE INDEX IF NOT EXISTS` is idempotent. Indexes increase write cost slightly and disk usage marginally — both negligible for the row counts here. PowerSync **does not** drop user-created indexes during sync; this pattern is exactly how the project already manages `idx_attachments_state_priority`.

- [ ] **Step 1: Read the current `setupPowerSync()` body**

In `powersync/system.ts:38-59` the existing body is:

```ts
export const setupPowerSync = async () => {
  await powersync.execute(`
    CREATE TABLE IF NOT EXISTS attachments_local (
      id TEXT PRIMARY KEY,
      resource TEXT NOT NULL,
      source_table TEXT NOT NULL,
      source_col TEXT NOT NULL,
      priority INTEGER NOT NULL,
      state TEXT NOT NULL,
      local_uri TEXT,
      size_bytes INTEGER,
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_attachments_state_priority ON attachments_local (state, priority);`,
  );
  const connector = new Connector();
  powersync.connect(connector);
};
```

- [ ] **Step 2: Insert the new index statements before `powersync.connect(connector)`**

Add the following block immediately after the existing `idx_attachments_state_priority` `execute` call and before `const connector = new Connector();`:

```ts
  // Hot-path indexes for course/assessment list and pending-counts queries.
  // CREATE INDEX IF NOT EXISTS is idempotent and cheap to re-run on every boot.
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_activity_subject_mode_start
     ON activity_activity (subject_id, classroom_mode, start_time);`,
  );
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_studentactivity_student_activity
     ON activity_studentactivity (student_id, activity_id);`,
  );
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_studentactivity_activity_local
     ON activity_studentactivity (activity_local_id);`,
  );
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_retakerecord_studentactivity_status
     ON activity_retakerecord (student_activity_id, status);`,
  );
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_enrollment_student_active
     ON course_subjectenrollment (student_id, is_active_semester);`,
  );
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_module_subject
     ON module_module (subject_id);`,
  );
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: no new errors (these are SQL strings — no TS surface).

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: pass.

- [ ] **Step 5: Verify indexes exist on device**

Start the app with `pnpm start:dev`, sign in, and open the Drizzle Studio plugin (`expo-drizzle-studio-plugin` is already in `package.json`). In the SQL console run:

```sql
SELECT name, tbl_name FROM sqlite_master
WHERE type = 'index' AND name LIKE 'idx_%'
ORDER BY name;
```

Expected output includes (at minimum) all seven `idx_*` indexes:
- `idx_activity_subject_mode_start`
- `idx_attachments_state_priority`
- `idx_enrollment_student_active`
- `idx_module_subject`
- `idx_retakerecord_studentactivity_status`
- `idx_studentactivity_activity_local`
- `idx_studentactivity_student_activity`

If any are missing, check the Metro console for a `powersync.execute` error and resolve before continuing.

- [ ] **Step 6: Confirm `useCoursePendingCounts` uses the new indexes**

In the Drizzle Studio SQL console, run an `EXPLAIN QUERY PLAN` of the count query with placeholder values:

```sql
EXPLAIN QUERY PLAN
SELECT
  a.subject_id AS subject_id,
  SUM(CASE WHEN a.end_time >= '2026-05-26T00:00:00Z' AND r.cnt IS NULL THEN 1 ELSE 0 END) AS due,
  SUM(CASE WHEN a.end_time <  '2026-05-26T00:00:00Z' AND r.cnt IS NULL THEN 1 ELSE 0 END) AS overdue
FROM activity_activity a
LEFT JOIN activity_studentactivity sa
  ON sa.activity_id = a.id AND sa.student_id = 1
LEFT JOIN (
  SELECT student_activity_id, COUNT(*) AS cnt
  FROM activity_retakerecord
  WHERE status = 'submitted'
  GROUP BY student_activity_id
) r ON r.student_activity_id = sa.id
WHERE a.classroom_mode = 0
  AND a.start_time <= '2026-05-26T00:00:00Z'
GROUP BY a.subject_id;
```

Expected: the plan should mention `USING INDEX idx_activity_subject_mode_start` for the outer scan and `USING INDEX idx_studentactivity_student_activity` (or `idx_retakerecord_studentactivity_status`) for the inner joins. If the plan still shows `SCAN TABLE activity_activity` with no index, the index is not eligible — re-check column order in the `CREATE INDEX` statements against the WHERE/JOIN columns.

- [ ] **Step 7: Checkpoint**

Report to the user:
- Diff of `powersync/system.ts`.
- The `sqlite_master` query output proving the indexes exist.
- The `EXPLAIN QUERY PLAN` output for the pending-counts query.

Pause for user review before starting Task 3.

---

## Task 3: Make `useCoursePendingCounts` Purely Reactive

**Why:** Today, `useCoursePendingCounts` runs a `setInterval` every 60 seconds that bumps a `nowMinute` state value, which changes the SQL parameters (`nowIso`), which causes `usePowerSyncQuery` to re-execute the entire JOIN against SQLite. The query is **already** a reactive `watch()` — it automatically re-fires when any row in `activity_activity`, `activity_studentactivity`, or `activity_retakerecord` changes. The only reason to re-parameterize on a timer is to flip an assessment from "due" to "overdue" when the wall clock crosses its `end_time`.

That flip can happen entirely in JavaScript at zero database cost. Once we remove the time parameters, the SQL becomes a stable, cached prepared statement that only runs when data actually changes — which is the snappy behavior we want.

**Files:**
- Modify: `features/courses/courses.hooks.ts:81-135`

**Risk:** Behaviour-preserving. The classification math is the same; we just move it from SQL `CASE` expressions to a JS `useMemo`. Net difference: the badge updates within ~60s of the wall clock crossing `end_time` (same as today), but with zero SQL re-execution.

- [ ] **Step 1: Read the current `useCoursePendingCounts`**

Lines 81-135 of `features/courses/courses.hooks.ts` are:

```ts
export type CoursePendingCount = { due: number; overdue: number };

export const useCoursePendingCounts = (studentId: number | undefined) => {
  const [nowMinute, setNowMinute] = useState(() =>
    Math.floor(Date.now() / 60_000),
  );
  useEffect(() => {
    const id = setInterval(
      () => setNowMinute(Math.floor(Date.now() / 60_000)),
      60_000,
    );
    return () => clearInterval(id);
  }, []);
  const nowIso = useMemo(
    () => new Date(nowMinute * 60_000).toISOString(),
    [nowMinute],
  );

  const result = usePowerSyncQuery<{
    subject_id: number;
    due: number;
    overdue: number;
  }>(
    `
    SELECT
      a.subject_id AS subject_id,
      SUM(CASE WHEN a.end_time >= ? AND r.cnt IS NULL THEN 1 ELSE 0 END) AS due,
      SUM(CASE WHEN a.end_time <  ? AND r.cnt IS NULL THEN 1 ELSE 0 END) AS overdue
    FROM activity_activity a
    LEFT JOIN activity_studentactivity sa
      ON sa.activity_id = a.id AND sa.student_id = ?
    LEFT JOIN (
      SELECT student_activity_id, COUNT(*) AS cnt
      FROM activity_retakerecord
      WHERE status = 'submitted'
      GROUP BY student_activity_id
    ) r ON r.student_activity_id = sa.id
    WHERE a.classroom_mode = 0
      AND a.start_time <= ?
    GROUP BY a.subject_id
    `,
    [nowIso, nowIso, studentId ?? 0, nowIso],
  );

  return useMemo(() => {
    const m = new Map<number, CoursePendingCount>();
    for (const row of result.data ?? []) {
      m.set(row.subject_id, {
        due: row.due ?? 0,
        overdue: row.overdue ?? 0,
      });
    }
    return m;
  }, [result.data]);
};
```

- [ ] **Step 2: Replace the implementation with a pure reactive query plus JS classification**

Use the Edit tool to replace the entire block above (from `export type CoursePendingCount` through the closing `};` on the last line of the function) with:

```ts
export type CoursePendingCount = { due: number; overdue: number };

// Re-render once a minute so the wall-clock comparison below re-evaluates,
// flipping assessments from "due" to "overdue" without a SQL re-query.
const useMinuteTick = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
};

export const useCoursePendingCounts = (studentId: number | undefined) => {
  useMinuteTick();

  // Pure reactive query: only re-fires when rows in the joined tables
  // change. Returns one row per (subject, assessment) so we can classify
  // due vs overdue in JS against the current wall clock.
  const result = usePowerSyncQuery<{
    subject_id: number;
    end_time: string;
    submitted_cnt: number | null;
  }>(
    `
    SELECT
      a.subject_id AS subject_id,
      a.end_time   AS end_time,
      r.cnt        AS submitted_cnt
    FROM activity_activity a
    LEFT JOIN activity_studentactivity sa
      ON sa.activity_id = a.id AND sa.student_id = ?
    LEFT JOIN (
      SELECT student_activity_id, COUNT(*) AS cnt
      FROM activity_retakerecord
      WHERE status = 'submitted'
      GROUP BY student_activity_id
    ) r ON r.student_activity_id = sa.id
    WHERE a.classroom_mode = 0
    `,
    [studentId ?? 0],
  );

  return useMemo(() => {
    const now = Date.now();
    const m = new Map<number, CoursePendingCount>();
    for (const row of result.data ?? []) {
      if (row.submitted_cnt != null) continue;
      const endMs = Date.parse(row.end_time);
      // start_time filter from the old query is intentionally dropped here:
      // assessments that haven't started yet are neither "due" nor "overdue"
      // for the student, and the same end_time comparison still excludes them
      // from the "overdue" bucket. If product needs to surface a "scheduled"
      // count later, add it as a third field on CoursePendingCount.
      if (Number.isNaN(endMs)) continue;
      const bucket = m.get(row.subject_id) ?? { due: 0, overdue: 0 };
      if (endMs >= now) bucket.due += 1;
      else bucket.overdue += 1;
      m.set(row.subject_id, bucket);
    }
    return m;
  }, [result.data]);
};
```

- [ ] **Step 3: Verify the old `nowIso`/`nowMinute` state is fully removed**

Run: `Grep` for `nowIso` and `nowMinute` in `features/courses/courses.hooks.ts`.
Expected: zero matches. If any remain, delete the dead code.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: pass. The `usePowerSyncQuery` generic now expects `{ subject_id; end_time; submitted_cnt }` — make sure no other file imports the row-shape type from this file (a `Grep` for `CoursePendingCount` shows it is only consumed via the returned `Map`, which is unchanged).

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: pass.

- [ ] **Step 6: Behavioural verification on device**

Start the app with `pnpm start:dev` and sign in as a student with at least one course that has pending and submitted assessments. On the courses tab:

a. Observe that the "due" and "overdue" badges on each course card match what was shown before this change. (If you have a backup build to compare against, side-by-side it.)

b. Open Drizzle Studio and watch the SQL log. Stay on the courses tab for 3 minutes without touching anything. Expected: **zero** re-executions of the pending-counts query during those 3 minutes. (Before this change, you would see one re-execution every 60 seconds.)

c. Pull-to-refresh or sync new assessment data. Expected: the badges update immediately — within one render cycle of the new row arriving — because the underlying `watch()` is still reactive to table changes.

d. (Optional) Set the device clock forward by 5 minutes to cross an assessment's `end_time`. Expected: the badge flips from "due" to "overdue" within 60 seconds (the JS tick interval), with no SQL hitting the database.

- [ ] **Step 7: Checkpoint**

Report to the user:
- Diff of `features/courses/courses.hooks.ts`.
- The Drizzle Studio observation from step 6b ("zero re-executions in 3 minutes").
- Any badge mismatches noticed in step 6a (should be none).

Pause for user review.

---

## Self-Review

Re-reading against the spec:

- ✅ **Rust client (item 1 of spec):** Task 1, single-line constructor change, with import + verify.
- ⚠️ **Bucket priorities (item 1 of spec, second half):** Deliberately deferred — bucket/stream priorities are defined in the **server-side** sync rules, and the client-side `SyncGate` already keys on per-stream `hasSynced` (which means the client is ready to consume priorities the moment the backend defines them). Adding a priority-aware gate is a follow-up plan once backend sync rules are split.
- ✅ **Hot column indexes (item 2 of spec):** Task 2, six new indexes covering the four tables touched by the worst query plus enrollment and materials.
- ✅ **Reactive `watch()` replacement (item 3 of spec):** Task 3, removes the parameter rotation while preserving the user-visible due/overdue flip behaviour.

**Placeholder scan:** every step has either a full code block or an exact command. No "TBD" / "add appropriate" / "similar to" references found.

**Type consistency:** `CoursePendingCount` type signature is unchanged across tasks. The new `usePowerSyncQuery` generic in Task 3 is local to that hook and not exported. `SyncClientImplementation` is imported in Task 1 only.

**Naming consistency:** index names follow the existing project convention (`idx_<table>_<cols>`). Function names (`useCoursePendingCounts`, `useMinuteTick`) match existing camelCase hook style.

No gaps found.
