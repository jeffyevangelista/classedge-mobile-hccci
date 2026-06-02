# PowerSync Sync Rules — Phase B + Stream Priorities (SSH Operator Brief)

**Audience:** Whoever has SSH access to the self-hosted PowerSync server (you).

**Asker:** Mobile team. Phase A (backend JWT `role` claim) is deployed and verified. This brief replaces your current `sync-rules.yaml` with one that **(1) re-tiers streams into priorities 0/1/2 to speed up cold start, and (2) gates role-specific streams on the new `role` JWT claim**.

Both changes ship in **one deploy** because they're touching the same file and a single PowerSync rule-reload triggers a full client re-sync — better to take that hit once than twice.

---

## What changes vs. your current production YAML

1. **`with:` block:** new parameter `user_role` added at the top.
2. **`streams:` block — priority retiering:**
   - `user_data` is split into `user_identity` (priority 0) + `user_notifications` (priority 1).
   - `current_term_data` moves to priority 0.
   - Most other streams stay at priority 1 (announcements/events, student enrollment, student courses+schedule, teacher courses).
   - `course_materials_and_assessments` and `current_term_courses` stay at priority 2.
3. **`streams:` block — role gates:**
   - Every student-specific query (in `student_enrolled_courses`, `courses_and_schedule`, `course_materials_and_assessments`) gets `AND 'Student' IN user_role` on its WHERE clause.
   - Every teacher-specific query (in `assigned_courses_for_teacher`, `current_term_courses`) gets `AND 'Teacher' IN user_role`.
   - Role-agnostic streams (`user_identity`, `user_notifications`, `current_term_data`, `announcements_and_events`) are not gated by role — Academic Director and Program Head users continue to receive them, as agreed.

**No queries removed. No columns dropped.** Every query in the new file traces back to a query in the old file with at most one added `AND ... IN user_role` clause and possibly a different `priority:` value.

---

## The full new `sync-rules.yaml`

Save the block below as the entire contents of your sync rules file (overwrite the existing one).

```yaml
config:
  edition: 3

with:
  # NEW (Phase B): role gate parameter. Returns one row containing the role
  # string from the JWT payload; `'Student' IN user_role` etc. evaluates TRUE
  # only when the JWT carries that role.
  user_role: SELECT auth.parameter('role') AS role

  current_semester: SELECT id FROM course_semester WHERE end_semester = FALSE
  student_enrollments: |
    SELECT subject_id FROM course_subjectenrollment
    WHERE student_id = CAST(auth.user_id() AS INTEGER)
      AND is_active_semester = TRUE
  teacher_subjects: |
    SELECT id FROM subject_subject
    WHERE assign_teacher_id = CAST(auth.user_id() AS INTEGER)

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
        AND 'Student' IN user_role

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
          AND 'Student' IN user_role
      - |
        SELECT id, schedule_start_time, schedule_end_time,
               days_of_week, subject_id, is_active_semester
        FROM subject_schedule
        WHERE is_active_semester = TRUE
          AND subject_id IN student_enrollments
          AND 'Student' IN user_role
      - |
        SELECT * FROM accounts_profile
        WHERE user_id IN (
          SELECT assign_teacher_id FROM subject_subject
          WHERE id IN student_enrollments
        )
          AND 'Student' IN user_role

  assigned_courses_for_teacher:
    auto_subscribe: true
    priority: 1
    query: |
      SELECT id, subject_name, subject_description, subject_code,
             subject_photo, room_number, is_hali, is_coil, is_cte,
             duration, assign_teacher_id, subject_type
      FROM subject_subject
      WHERE id IN teacher_subjects
        AND 'Teacher' IN user_role

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
          AND 'Student' IN user_role
      # Assessments
      - |
        SELECT local_id AS id, * FROM activity_activity
        WHERE subject_id IN student_enrollments
          AND 'Student' IN user_role
      # Student's own assessment instances
      - |
        SELECT local_id AS id, * FROM activity_studentactivity
        WHERE subject_id IN student_enrollments
          AND student_id = CAST(auth.user_id() AS INTEGER)
          AND 'Student' IN user_role
      # Question bank
      - |
        SELECT * FROM activity_activityquestion
        WHERE subject_id IN student_enrollments
          AND 'Student' IN user_role
      - |
        SELECT * FROM activity_questionchoice
        WHERE subject_id IN student_enrollments
          AND 'Student' IN user_role
      - |
        SELECT * FROM activity_quiztype
        WHERE 'Student' IN user_role
      # Student's own attempts
      - |
        SELECT local_id AS id, * FROM activity_retakerecord
        WHERE student_id = CAST(auth.user_id() AS INTEGER)
          AND 'Student' IN user_role
      # Student's own attempt answer details
      - |
        SELECT local_id AS id, * FROM activity_retakerecorddetail
        WHERE student_id = CAST(auth.user_id() AS INTEGER)
          AND 'Student' IN user_role
      # NOTE: `activity_studentquestion` MUST exist in client AppSchema
      # (powersync/schema.ts). PowerSync silently drops rows for tables
      # the client doesn't declare.
      - |
        SELECT * FROM activity_studentquestion
        WHERE student_id = CAST(auth.user_id() AS INTEGER)
          AND 'Student' IN user_role

  current_term_courses:
    auto_subscribe: true
    priority: 2
    queries:
      - |
        SELECT * FROM course_subjectenrollment
        WHERE subject_id IN teacher_subjects
          AND is_active_semester = TRUE
          AND 'Teacher' IN user_role
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
          AND 'Teacher' IN user_role
      - |
        SELECT * FROM activity_activitytype
        WHERE name <> 'Attendance'
          AND 'Teacher' IN user_role
      - |
        SELECT id, first_name, last_name, student_photo, user_id
        FROM accounts_profile
        WHERE user_id IN (
          SELECT student_id FROM course_subjectenrollment
          WHERE subject_id IN teacher_subjects
            AND is_active_semester = TRUE
        )
          AND 'Teacher' IN user_role
      - |
        SELECT local_id AS id, * FROM activity_studentactivity
        WHERE subject_id IN teacher_subjects
          AND 'Teacher' IN user_role
```

---

## JWT claim access in Sync Streams — `auth.parameter('<name>')`

PowerSync Sync Streams accesses individual top-level JWT claims via the single-argument `auth.parameter('<claim_name>')` function. This file uses `auth.parameter('role')` everywhere a role check is needed — that resolves the `role` claim the backend mints at the top level of the JWT payload.

For context on the dead-ends that didn't work:
- `request.jwt() ->> 'role'` — legacy Sync Rules accessor; throws `Invalid schema in function name` against Sync Streams.
- `auth.user_parameters() ->> 'role'` — returns a nested `parameters` object, not top-level claims; would require the backend to nest the role under a `parameters: {}` field.

`auth.parameter('role')` is the right accessor for the existing JWT shape — no backend change needed.

If you ever need to refactor away from the `user_role` parameter form, the equivalent explicit-marker form is:

```yaml
user_is_student: SELECT 1 AS ok WHERE auth.parameter('role') = 'Student'
user_is_teacher: SELECT 1 AS ok WHERE auth.parameter('role') = 'Teacher'
```

Then queries use `... AND 1 IN user_is_student`. Both forms gate identically; the `user_role` form is just terser.

---

## Deploy steps

Run from your laptop. Replace `<host>` with your SSH target and `<path>` with the actual sync-rules path on the server.

```bash
# 1. Pull the current production rules for backup (label with date).
scp <host>:<path>/sync-rules.yaml ./sync-rules.yaml.backup-$(date +%Y%m%d-%H%M)

# 2. Save the YAML from this brief to a local file.
#    (Either copy-paste from the block above into ./sync-rules.yaml, or
#    save the markdown excerpt with whatever editor flow you prefer.)

# 3. Copy the new rules up.
scp ./sync-rules.yaml <host>:<path>/sync-rules.yaml

# 4. SSH in and reload PowerSync. The exact command depends on how the
#    service is installed:
ssh <host>
# Option A — systemd unit:
sudo systemctl reload powersync || sudo systemctl restart powersync
# Option B — file watcher (no command needed; restart only if logs show stale rules):
sudo journalctl -u powersync -n 50 --no-pager
# Option C — Docker:
docker restart <powersync-container-name>
```

After the reload, watch the PowerSync service logs for ~30 seconds for any sync-rule parse errors. If you see `failed to parse rules` or `Invalid schema in function name`, **roll back immediately**:

```bash
scp ./sync-rules.yaml.backup-<timestamp> <host>:<path>/sync-rules.yaml
# Then reload via whichever Option A/B/C applies.
```

If the reload succeeds cleanly, proceed to smoke-tests.

---

## Smoke-test checklist (run BEFORE telling the mobile team Phase B is live)

You need at least one test account per role. If staging doesn't have them, ask the server dev to seed.

For **each** role, do the following:

### Student account

1. Wipe the mobile app's local DB (delete & reinstall, or call `resetPowerSync` if exposed).
2. Sign in.
3. After the sync-splash releases, open Drizzle Studio (or the dev tool used in this client).
4. Run these queries and record the counts:

   ```sql
   SELECT COUNT(*) FROM course_subjectenrollment;            -- should be > 0 (the user's own enrollments)
   SELECT COUNT(*) FROM subject_subject;                      -- should be > 0 (the user's enrolled courses)
   SELECT COUNT(*) FROM activity_activity;                    -- should be > 0 (assessments for their courses)
   SELECT COUNT(*) FROM activity_studentactivity              -- should be > 0 (their own assessment instances)
     WHERE student_id = <this user's id>;
   SELECT COUNT(*) FROM activity_activity                     -- TEACHER stream data — should be 0
     WHERE classroom_mode = TRUE;
   ```

5. Open the app's courses tab and confirm courses + assessments render normally.

### Teacher account

1. Wipe local DB, sign in.
2. Drizzle Studio:

   ```sql
   SELECT COUNT(*) FROM subject_subject                       -- should be > 0 (the teacher's assigned courses)
     WHERE assign_teacher_id = <this user's id>;
   SELECT COUNT(*) FROM activity_activity                     -- should be > 0 (their classroom activities)
     WHERE classroom_mode = TRUE;
   SELECT COUNT(*) FROM course_subjectenrollment;             -- should be > 0 (students in their courses)
   SELECT COUNT(*) FROM activity_studentactivity              -- STUDENT-only data — should be 0
     WHERE student_id = <this teacher's id>;
   ```

3. Open the classroom tab if exposed; confirm activity list renders.

### Academic Director / Program Head accounts

1. Wipe local DB, sign in.
2. Drizzle Studio:

   ```sql
   SELECT COUNT(*) FROM accounts_customuser;          -- should be 1 (their own row)
   SELECT COUNT(*) FROM accounts_profile;             -- should be 1 (their own profile) + a few from announcement/event creators
   SELECT COUNT(*) FROM calendars_event;              -- should be > 0
   SELECT COUNT(*) FROM calendars_announcement;       -- should be > 0
   SELECT COUNT(*) FROM course_semester;              -- should be > 0
   SELECT COUNT(*) FROM course_term;                  -- should be > 0
   SELECT COUNT(*) FROM logs_notification             -- should be their own notifications
     WHERE user_id_id = <their id>;
   SELECT COUNT(*) FROM course_subjectenrollment;     -- should be 0 (not a student or teacher)
   SELECT COUNT(*) FROM subject_subject;              -- should be 0
   SELECT COUNT(*) FROM activity_activity;            -- should be 0
   ```

3. App should still open and show the calendar / announcements / profile screens. Course tab will be empty — that's correct.

If all three sets of checks pass on staging, deploy the same YAML to production using the same steps. After prod deploy, repeat the smoke tests against prod with throwaway test accounts.

---

## Rollback

Either:

1. Keep the `sync-rules.yaml.backup-<timestamp>` from step 1 of the deploy. `scp` it back, reload. Clients will sync to the old shape on next connection.
2. Or revert via your version-control of choice if the YAML is in a git repo on the server.

---

## What to report back to the mobile team

- Reload command output (success or error).
- Smoke-test query results for each role.
- Confirmation that `auth.parameter('role')` parsed cleanly (verified).
- Anything weird in PowerSync service logs.
