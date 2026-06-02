# PowerSync Role Claim & Role-Gated Streams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `role` claim to the PowerSync JWT and gate role-specific sync streams on that claim — turning today's implicit "empty rows for wrong role" self-gating into explicit server-side authorization.

**Architecture:** Three sequential changes. (A) The Django backend that mints PowerSync JWTs adds a `role` claim ("student" | "teacher" | "admin" or similar — pinned at Step A1) to the token payload. (B) The PowerSync `sync-rules.yaml` adds a `user_role` parameter using `request.jwt()` and inlines role checks on every stream where the role matters. (C) (Optional, deferred) Client-side conditional `subscribe()` so role-irrelevant streams don't even get a subscription. Phases A and B together deliver the security/clarity win; Phase C is a future optimization once the backend contract is stable.

**Tech Stack:** Django REST Framework (the token minter — exact location to be confirmed at Step A1), PyJWT or `djangorestframework-simplejwt` for signing, PowerSync sync rules edition 3 (your existing `config: edition: 3`), `@powersync/react-native@1.34.0` on the client.

**Project conventions:**
- The auth backend repo is **separate from this client-mobile repo**. Path discovery happens in Step A1.
- The sync rules YAML lives on your self-hosted PowerSync server. Path discovery happens in Step B1.
- Per the user's standing instruction, this plan does **not** auto-stage or auto-commit anywhere.
- This plan describes a coordinated rollout: backend token change → sync rules update → user token rotation. Out-of-order deployment causes brief auth failures (clients with old tokens hit new rules expecting `role`).

**Decision points to sign off on before execution:**

| Decision | Recommendation | Alternatives |
|---|---|---|
| **Role values** | `"Student" \| "Teacher" \| "Academic Director" \| "Program Head"` (PascalCase/Title Case, single string, exact match — preserved verbatim from the Django source of truth) | Array (`"roles": ["Teacher"]`) if a user can hold multiple roles; if so, queries become `'Teacher' IN (request.jwt() ->> 'roles')` |
| **Claim name** | `role` (top-level) | `https://classedge.app/role` (namespaced — avoids collision with standard claims; less convenient) |
| **Role source of truth** | Django `accounts_customuser.role` or a per-profile field — confirm in Step A2 | Could derive from group membership; pin one path now |
| **Phase C (client subscribe)** | Defer to a later plan | Implement now if you want the bandwidth/metadata savings immediately |
| **Rollout order** | Backend deploys claim (additive — old YAML ignores it), THEN sync rules deploy role checks, THEN force token rotation | Deploy rules first → old tokens 403 until users re-auth; bad UX |

**Out of scope (deferred):**
- Multi-role users (the plan assumes one role per user). If you need parent/student dual-role, that's an extension of Phase B's query syntax.
- Admin sync streams (the plan only inlines role checks on existing student/teacher streams).
- Phase C client-side conditional subscribe (separate plan).
- Token format changes beyond adding one claim (audience, issuer, expiry, signing key rotation).

---

## File Structure

**Files modified (across repos):**
- **Backend (auth/Django repo — path TBD at A1):** the PowerSync token-mint endpoint adds one claim to the JWT payload.
- **PowerSync server (sync-rules YAML — path TBD at B1):** the `with:` block adds `user_role`; existing role-specific streams add a `WHERE request.jwt() ->> 'role' = '...'` clause OR the equivalent through `user_role`.
- **client-mobile (this repo):** zero changes for Phases A+B. (Phase C, deferred, would touch `providers/PowerSyncProvider.tsx` and the `Connector`.)

**No new files. No schema migrations.** The role claim is computed at token-mint time from existing user data — no DB column added.

---

## Phase A: Backend — Add `role` Claim to PowerSync JWT

**Why first:** Adding the claim is *additive* — existing sync rules ignore the new claim, so deploying the backend change first cannot break the YAML. The opposite order (rules first, backend later) would 403 any user whose token lacks the claim.

### Task A1: Locate the PowerSync token-mint code

**Why:** The plan can't proceed without the exact file/function. The auth repo is separate from `client-mobile`.

- [ ] **Step 1: Ask the user for the auth repo location**

The PowerSync token is fetched by `Connector.fetchCredentials` in this client (`powersync/Connector.ts:111-118`), which reads `powersyncToken` from the Zustand store. That token comes from the auth backend — most likely a Django endpoint like `POST /api/powersync/token/`. Ask the user:
- The path to the auth repo (e.g. `~/Desktop/classedge-hccci/server-backend`).
- The Django view/serializer that mints the PowerSync JWT (likely uses `jwt.encode(payload, key, algorithm='HS256')` or a PowerSync SDK helper).

- [ ] **Step 2: Identify the current JWT payload**

Inside the token-mint view, read the payload dict passed to `jwt.encode`. Today it probably looks like:

```python
payload = {
    "sub": str(user.id),
    "iat": now_ts,
    "exp": now_ts + TOKEN_TTL_SECONDS,
    "aud": POWERSYNC_AUDIENCE,
    # ... possibly more
}
```

Capture the exact dict, the signing key source, and the algorithm. These all stay unchanged.

- [ ] **Step 3: Checkpoint with the user**

Confirm:
- Exact backend file path of the token mint
- Current payload shape
- The user's chosen role value scheme (likely `"student" | "teacher" | "admin"` — pin this now before A2)

### Task A2: Resolve the user's role at token-mint time

**Why:** The token mint must know how to look up the role for an authenticated user. The plan assumes a single role per user.

- [ ] **Step 1: Locate the role source on the user record**

In Django, the role typically lives in one of:
- `accounts_customuser.role` (a `CharField` with choices)
- `accounts_profile.role` (per-profile)
- Group membership (`user.groups.first().name`)
- A `is_teacher` / `is_student` boolean pair

Read `accounts/models.py` to determine which. If the project uses multiple of these inconsistently, pin one as canonical for the JWT (the others can be migrated to derive from it later).

- [ ] **Step 2: Write a helper to derive the role**

In the same module as the token-mint view (or a `accounts/utils.py` if one exists), add:

```python
# Replace ROLE_FIELD_PATH with the actual attribute path resolved in Step 1.
ALLOWED_ROLES = {"Student", "Teacher", "Academic Director", "Program Head"}

def get_powersync_role(user) -> str:
    """Return the single role string embedded in the PowerSync JWT.
    Must match the values referenced in sync-rules.yaml (Phase B) exactly
    (case-sensitive, preserve spaces in 'Academic Director' / 'Program Head')."""
    role = getattr(user, ROLE_FIELD_PATH, None)
    if role is None:
        raise ValueError(f"User {user.pk} has no role assigned; refuse to mint token.")
    role = str(role)
    if role not in ALLOWED_ROLES:
        raise ValueError(f"User {user.pk} has unknown role {role!r}; refuse to mint token.")
    return role
```

(If the field is on `accounts_profile`, use `user.profile.role` instead of `getattr(user, ...)`.)

**No case normalisation.** The values are stored, transmitted, and matched verbatim — `"Academic Director"` (with the space) all the way through. The `ALLOWED_ROLES` set is the single source of truth — sync-rules.yaml must reference exactly these strings.

- [ ] **Step 3: Add a test for the helper**

If the backend repo has a test suite (pytest or Django's `TestCase`), add unit tests covering:
- A user with a role returns the lowercase string.
- A user without a role raises `ValueError` (we want loud failure, not silent empty token).

If there's no test suite, skip and note this in the report. Don't introduce one as part of this task.

- [ ] **Step 4: Run the backend test suite**

Whatever the project's test command is (`pytest`, `python manage.py test`, `make test`) — run it from the auth repo. Expected: green or no-new-failures.

- [ ] **Step 5: Checkpoint**

Report the helper code + test results. Pause before A3.

### Task A3: Inject `role` into the JWT payload

- [ ] **Step 1: Edit the token-mint view**

Locate the line that builds the payload (Task A1 Step 2). Add:

```python
payload = {
    # ... existing claims unchanged ...
    "role": get_powersync_role(user),
}
```

That single line is the entire payload change. Do not touch `sub`, `iat`, `exp`, `aud`, or the signing call — they are unchanged.

- [ ] **Step 2: Add a test for the minted token**

If tests exist, add one that asserts the decoded JWT contains a `"role"` key matching the user's role. Pseudocode:

```python
def test_powersync_token_includes_role(self):
    user = UserFactory(role="student")
    response = self.client.post("/api/powersync/token/", auth=user)
    token = response.json()["token"]
    decoded = jwt.decode(token, key=settings.POWERSYNC_JWT_KEY, algorithms=["HS256"], audience=settings.POWERSYNC_AUDIENCE)
    self.assertEqual(decoded["role"], "student")
```

- [ ] **Step 3: Run the backend test suite again**

Expected: pass.

- [ ] **Step 4: Deploy to staging (or wherever your backend is hosted)**

Per the rollout-order contract: backend change ships *before* sync-rules change. Old YAML ignores the new claim, so this deploy is risk-free for existing users.

- [ ] **Step 5: Verify in production by inspecting a freshly-minted token**

Open the React Native client, sign in, and capture a `powersyncToken` from the Zustand store (you can log it in `Connector.fetchCredentials` temporarily, or check the network request payload). Paste into `jwt.io` and confirm `"role"` is present in the payload.

- [ ] **Step 6: Checkpoint**

Confirm the rolled-out backend now mints tokens with `role`. Pause before Phase B.

---

## Phase B: Sync Rules — Gate Streams by Role

**Why second:** Now that all freshly minted tokens carry `role`, the YAML can safely reference it. Users with stale tokens (minted before A3) will simply have their existing self-gating apply — no regression — until their token refreshes (typically within minutes via `silentRefresh`).

### Task B1: Locate sync-rules.yaml on the PowerSync server

- [ ] **Step 1: Ask the user for the SSH host + path**

The sync rules are on a self-hosted PowerSync server. Ask:
- SSH connection target (e.g. `user@powersync.classedge.app`)
- Path on that host (commonly `/etc/powersync/sync-rules.yaml` or `/opt/powersync/config/sync-rules.yaml`)
- Reload mechanism (file watcher? systemctl reload? PowerSync CLI?)

Make a local working copy via `scp <host>:<path> ./sync-rules.yaml.local` for editing. Edit locally, then `scp` back when ready.

### Task B2: Add `user_role` parameter + role-gated streams

**Why:** Adding a single `user_role` parameter makes role checks declarative and reusable. Inline `request.jwt() ->> 'role'` in every stream would also work but spreads the contract across many queries.

**Note on syntax:** PowerSync sync rules edition 3 accesses JWT custom claims via `request.jwt()` returning the parsed JWT body. The `->>` operator extracts a text value. Verify the exact accessor against the PowerSync version you're running by searching its docs for `request.jwt` or `auth.user_parameters` — different minor versions have used both. The plan uses `request.jwt() ->> 'role'`; substitute the equivalent if your version differs.

- [ ] **Step 1: Extend the `with:` block**

Open `sync-rules.yaml.local`. Locate the `with:` block at the top. Add `user_role` as the first parameter:

```yaml
with:
  user_role: SELECT request.jwt() ->> 'role' AS role
  current_semester: SELECT id FROM course_semester WHERE end_semester = FALSE
  student_enrollments: |
    SELECT subject_id FROM course_subjectenrollment
    WHERE student_id = CAST(auth.user_id() AS INTEGER)
      AND is_active_semester = TRUE
  teacher_subjects: |
    SELECT id FROM subject_subject
    WHERE assign_teacher_id = CAST(auth.user_id() AS INTEGER)
```

- [ ] **Step 2: Add role gates to student streams**

For each student-specific stream (`student_enrolled_courses`, `courses_and_schedule`, `course_materials_and_assessments`), add a `WHERE` clause that requires the role. For streams with multiple queries, add it to each query. Example:

```yaml
student_enrolled_courses:
  auto_subscribe: true
  priority: 1
  query: |
    SELECT * FROM course_subjectenrollment
    WHERE student_id = CAST(auth.user_id() AS INTEGER)
      AND is_active_semester = TRUE
      AND 'Student' IN user_role
```

For multi-query streams like `course_materials_and_assessments`, append `AND 'Student' IN user_role` to every query's `WHERE` clause. The phrase `'Student' IN user_role` works because `user_role` is a parameter view returning a single-row, single-column result; matching against `'Student'` returns the row if the JWT carries that role and nothing otherwise.

(If your edition's parameter syntax requires a different shape — e.g., `user_role.role = 'Student'` — adapt during Step 4 verification.)

- [ ] **Step 3: Add role gates to teacher streams**

Apply the same pattern to `assigned_courses_for_teacher` and `current_term_courses`, gating on `'Teacher' IN user_role`.

- [ ] **Step 4: Leave shared streams unchanged**

`user_identity`, `user_notifications`, `current_term_data`, `announcements_and_events` are role-agnostic — every authenticated user (Student / Teacher / Academic Director / Program Head) should receive them. Do NOT add role gates to these.

**Academic Director and Program Head:** today's sync rules expose no streams specifically for these two roles. Under this plan they continue to receive only the role-agnostic streams — same as today. If a future plan adds oversight access (Academic Director sees teachers' classroom data, Program Head sees enrolment rollups, etc.), that becomes a new role-gated stream tier — out of scope here.

- [ ] **Step 5: Lint the YAML**

If the PowerSync CLI is installed locally, run its sync-rules validation (`powersync diagnose -p sync-rules.yaml.local` or equivalent). If not, run any YAML linter for syntax + a manual diff against the current production rules.

- [ ] **Step 6: Deploy to a non-production PowerSync instance first**

Push the edited rules to staging. If no staging exists, get explicit user approval before pushing to prod (which will trigger a full re-sync for every connected client).

- [ ] **Step 7: Smoke-test with three test accounts**

Use student, teacher, and admin test accounts (or whichever roles you defined in A1). For each:
- Sign in to the client.
- Confirm the user receives ONLY their role's data — students should NOT see any teacher classroom rows in their local DB, teachers should NOT see student-specific assessment instances.
- Inspect the local DB via Drizzle Studio: `SELECT COUNT(*) FROM activity_studentactivity` should be the user's own count for a student, zero for a teacher (where applicable).

- [ ] **Step 8: Roll to production**

During a low-traffic window. Existing clients with fresh tokens (post-A3) start receiving role-gated data immediately. Clients with pre-A3 stale tokens behave per today's self-gating until their token refreshes (silentRefresh handles this on the next cycle, typically within minutes).

- [ ] **Step 9: Checkpoint**

Report:
- Diff of `sync-rules.yaml` (rules-only, no infrastructure config).
- Smoke-test results per role.
- Any production sync errors after rollout (PowerSync service logs).

---

## Phase C (Deferred): Client-side Conditional Subscribe

Out of scope for this plan. Brief outline so a future plan has a starting point:

- Set `auto_subscribe: false` on role-specific streams in YAML.
- In `providers/PowerSyncProvider.tsx`, after `setupPowerSync` returns, decode the JWT (`jwt-decode` is already a project dep, `package.json:76`), read `role`, and call `powersync.syncStream('student_enrolled_courses').subscribe()` etc. for the matching streams only.
- Wins: zero stream-metadata overhead for irrelevant streams; tighter cleanup on role change.
- Costs: stream-name list lives in two places (YAML + client); easy to drift.

---

## Security & Rollback Notes

- **Defence-in-depth:** the role check is layered on top of the existing `auth.user_id()` self-gating. Even if the role claim is missing or wrong, the user-id filter still prevents one user from seeing another user's data. The role check stops a teacher's *own* student-data subscription from producing rows it shouldn't — that's the marginal security win.
- **Rollback for Phase A:** drop the `"role"` key from the payload, redeploy. Existing tokens still validate against the new YAML because parameter queries returning empty rows just mean empty streams — no auth failure.
- **Rollback for Phase B:** revert `sync-rules.yaml` to pre-B state via your reload mechanism. Clients re-sync and see the previous data again.
- **Key rotation NOT required:** the JWT signing key is unchanged; only the payload grew by one field.

---

## Self-Review

**Spec coverage:**

- ✅ "Include roles in the token" → Phase A adds a `role` claim.
- ✅ "Sync streams based on roles and id" → Phase B gates each role-specific stream on `'student' IN user_role` / `'teacher' IN user_role`. The existing `auth.user_id()`-based self-gating is preserved as the id-side enforcement.
- ✅ Coordinated deploy order documented (backend → rules → token rotation).
- ✅ Rollback paths documented for both phases.
- ✅ Out-of-scope clearly stated (multi-role users, admin streams, Phase C).

**Placeholder scan:** the plan has TWO deliberate user-input gates — auth-repo location (A1) and PowerSync SSH/path (B1). These are surfaced as explicit "ask the user" steps, not silent TODOs. Every code step includes either a complete snippet or an exact command.

**Type/name consistency:** `role` is the claim name everywhere (payload, YAML parameter, sync-rule comparisons). `user_role` is the parameter name in the `with:` block. The role *values* (`"student"`, `"teacher"`, `"admin"`) are pinned at A1 Step 3 and used identically in Python (`.lower()`) and YAML (string literal comparisons).

**Risk profile:** Phase A is additive and risk-free. Phase B is the substantive change; rolled out per the documented order, the worst case is brief empty streams for users with stale tokens, healed by silentRefresh.

No gaps found.
