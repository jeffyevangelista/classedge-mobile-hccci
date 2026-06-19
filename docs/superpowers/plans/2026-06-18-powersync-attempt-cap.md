# PowerSync 5-attempt cap — audit plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify that the `STUCK_ATTEMPT_CAP = 5` in `features/sync/crudMeta.ts:3` is not silently burned by authentication retries; add discriminator + telemetry only if the audit reveals an actual gap.

**Architecture:** Read-and-verify first, code-change only if needed. The audit consists of (1) a focused code read confirming `fetchOpWithAuthRetry` and `crudMeta.markAttempted` semantics, (2) a scripted offline → expired-token → online reproduction, and (3) telemetry that durably exposes the distinction for future regressions.

**Tech Stack:** No new tools. Existing `powersync/Connector.ts`, `features/sync/crudMeta.ts`, `features/sync/syncEvents.ts`.

## Global Constraints

- **Spec reference:** `docs/superpowers/specs/2026-06-18-powersync-attempt-cap-design.md`.
- **Do not change `STUCK_ATTEMPT_CAP` value.**
- **Do not change the permanent-statuses list.**
- **If the audit passes, the only deliverable is telemetry + a memory note.**
- **Do not auto-stage or commit.** Leave staging and committing to the human reviewer.

---

### Task 1: Code-read audit

**Files:**
- Read: `powersync/Connector.ts:125-200` (`fetchOpWithAuthRetry`, `uploadData`)
- Read: `features/sync/crudMeta.ts` (full)
- Read: `features/sync/permanentStatuses.ts` (full)

**Interfaces:**
- Produces: audit notes added to the spec.

- [ ] **Step 1: Trace the auth-retry path**

Read `fetchOpWithAuthRetry`. Confirm that on 401:
- `silentRefresh({ force: true })` is awaited.
- On success, the op is reissued with the new token *before* any call site that increments the attempt counter.
- On failure, the function rejects upward to whichever caller is the source of the attempt-increment.

Record the line numbers in a scratch buffer.

- [ ] **Step 2: Trace the increment path**

Read `crudMeta.ts`. Identify the function that increments `attempts` (likely `markAttempted` or similar). Confirm that this function is only called once per *failed upload of an op*, not once per network request.

- [ ] **Step 3: Resolve the question**

Combine Steps 1 + 2: does the 401-then-retry path increment the counter zero, one, or two times?

Expected (from prior analysis): zero increments on the success path; one on the final failure path. Document the answer.

- [ ] **Step 4: Update the spec with findings**

Append a "Audit findings (YYYY-MM-DD)" section to `docs/superpowers/specs/2026-06-18-powersync-attempt-cap-design.md` recording: increment count on each path + line refs.

- [ ] **Step 5: Commit (human reviewer)**

Suggested message: `docs(spec): audit findings for PowerSync attempt cap`.

---

### Task 2: Reproduction test

**Files:**
- Run on a real device or simulator.

**Interfaces:**
- None.

- [ ] **Step 1: Set up offline → expired-token state**

1. Sign in on a fresh build.
2. Use airplane mode to disconnect.
3. Make a local CRUD edit (e.g., update a profile field that uses PowerSync local writes).
4. Wait until the **access token** has expired (15 min by SimpleJWT config) but the **refresh token** has not (30 days).
5. Confirm `ps_crud` queue has the pending op.

- [ ] **Step 2: Return online + observe**

1. Turn airplane mode off.
2. Watch the `useSyncData` hook's `uploading` state.
3. Read `ps_crud_meta_local` (via debugger / SQL) to inspect `attempts` on the op.

Expected: the op uploads successfully, and `attempts` stays at 0 (refreshed token was used on the first try) **or** rises by exactly 1 then the op completes (refresh raced and the second attempt succeeded). Either is acceptable; > 1 indicates the auth-retry is burning attempts.

- [ ] **Step 3: Record outcome**

Add the result to the audit-findings section in the spec.

---

### Task 3: Telemetry

**Files:**
- Modify: `powersync/Connector.ts` (or wherever the 401 retry path lives)
- Modify: `features/sync/syncEvents.ts`

**Interfaces:**
- Produces: new sync event kind `crud_auth_retry { opId, status: "ok"|"fail" }`.

- [ ] **Step 1: Emit on auth-retry success**

In `fetchOpWithAuthRetry`, after a successful retry post-`silentRefresh`, emit:

```ts
await appendSyncEvent({
  kind: "crud",
  status: "ok",
  message: "Auth-retry succeeded without burning attempt",
});
```

- [ ] **Step 2: Emit on auth-retry failure**

If the retry also fails:

```ts
await appendSyncEvent({
  kind: "crud",
  status: "fail",
  message: "Auth-retry failed; attempt will be counted",
});
```

- [ ] **Step 3: Run tests**

Run:
```bash
pnpm tsc --noEmit && pnpm test
```

- [ ] **Step 4: Commit (human reviewer)**

Suggested message: `feat(sync): telemetry for CRUD auth-retry path`.

---

### Task 4: Memory note + close-out

- [ ] **Step 1: Update auto-memory**

Append a project memory: "Audited 2026-06-18 — PowerSync auth-retry does NOT burn `STUCK_ATTEMPT_CAP` attempts (or: confirm whatever the audit finds). 5-attempt cap considered safe."

- [ ] **Step 2: Decide on follow-up**

If the audit *failed* (auth retries burn attempts), open a follow-up plan to add an explicit "auth retry" flag in `crudMeta` so failed auth attempts do not increment the cap. Otherwise: close the spec as "verified, no code change needed."

---

## Self-Review checklist

- Spec "audit-only first": Task 1 + Task 2 are read + reproduce. ✅
- Spec "if audit fails, follow-up plan, not absorbed here": Task 4 step 2. ✅
- Spec "add telemetry regardless": Task 3. ✅
- Spec "no change to STUCK_ATTEMPT_CAP value": none of the tasks touch the constant. ✅
