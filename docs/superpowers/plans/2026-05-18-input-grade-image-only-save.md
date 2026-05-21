# InputGrade image-only save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the header Save button on `InputGradeScreen` to persist image-only changes for students that already have a DB row, without inserting fake rows or bypassing invalid-score validation.

**Architecture:** Two memos in `features/classroom/components/StudentScoringList.tsx` are restructured. `dirtyStudentIds` now branches on score state (empty / invalid / valid) so empty-but-image-dirty students with an existing row are included, while invalid scores still block. `handleSubmitAll` derives `totalScore` from `localScores` when present, falling back to `scoresMap` (the saved DB score) otherwise. No service-layer or schema changes.

**Tech Stack:** React Native, TypeScript, expo-router, PowerSync, heroui-native, FlashList. Project tooling: `biome check .` (lint) and `tsc --noEmit` (typecheck). No automated test runner in repo — verification is typecheck + lint + manual on-device.

**Spec:** `docs/superpowers/specs/2026-05-18-input-grade-image-only-save-design.md`

**Commit policy:** Per project preference, do NOT run `git add` or `git commit` from this plan. Stage and commit are the user's responsibility. Each task ends with "User commits when ready."

---

## File Structure

Only one file is modified:

- **Modify:** `features/classroom/components/StudentScoringList.tsx`
  - `dirtyStudentIds` useMemo (currently lines 125–155)
  - `handleSubmitAll` useCallback `entries` builder (currently lines 163–172)

No new files. No new exports. No service or schema changes.

---

## Task 1: Restructure `dirtyStudentIds` to allow image-only dirty

**Files:**
- Modify: `features/classroom/components/StudentScoringList.tsx` (lines 125–155)

**Context:** Current logic short-circuits on empty or invalid score *before* consulting `imageDirty`, so a dirty image without a numeric score never enters the dirty set. New logic uses three explicit branches matching the spec's behavior matrix.

- [ ] **Step 1: Open the file and locate the memo**

Read `features/classroom/components/StudentScoringList.tsx` and confirm `dirtyStudentIds` lives at lines 125–155 (line numbers may have shifted — search for `const dirtyStudentIds = useMemo` to locate).

- [ ] **Step 2: Replace the memo body**

Replace the existing `dirtyStudentIds` useMemo with this version. Keep the dependency array exactly as shown.

```ts
  const dirtyStudentIds = useMemo(() => {
    if (!validStudents.length) return new Set<number>();
    const dirty = new Set<number>();
    for (const s of validStudents) {
      const local = localScores[s.studentId];
      const imageDirty = imagesByStudent[s.studentId]?.dirty === true;
      const hasExistingRow = scoresMap[s.studentId] !== undefined;

      // Branch 1: score field empty/untouched — image-only path.
      // Only mark dirty when an existing row is available to UPDATE; we never
      // insert a fresh row with no score (no fake 0).
      if (local === undefined || local === "") {
        if (imageDirty && hasExistingRow) {
          dirty.add(s.studentId);
        }
        continue;
      }

      // Branch 2: score field has content but is invalid — block the entire
      // row, even if the image is dirty. The user must fix the bad score.
      const numericScore = parseInt(local, 10);
      if (
        isNaN(numericScore) ||
        numericScore < 0 ||
        numericScore > activityDetail.maxScore
      ) {
        continue;
      }

      // Branch 3: score is valid — original behavior.
      const saved = scoresMap[s.studentId];
      const scoreChanged = saved === undefined || saved !== numericScore;

      if (scoreChanged || imageDirty) {
        dirty.add(s.studentId);
      }
    }
    return dirty;
  }, [
    validStudents,
    localScores,
    scoresMap,
    activityDetail.maxScore,
    imagesByStudent,
  ]);
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0 with no errors mentioning `StudentScoringList.tsx`.

- [ ] **Step 4: Run lint**

Run: `npx biome check features/classroom/components/StudentScoringList.tsx`
Expected: no errors. Warnings about pre-existing issues in unrelated lines are acceptable; new code should not introduce new findings.

- [ ] **Step 5: User commits when ready**

Do NOT stage or commit. Stop and hand off to the user with a one-line summary:
> "Task 1 done — `dirtyStudentIds` restructured. Ready for you to review and commit."

---

## Task 2: Update `handleSubmitAll` to derive `totalScore` from saved fallback

**Files:**
- Modify: `features/classroom/components/StudentScoringList.tsx` (lines 159–191, specifically the `entries` map at 163–172)

**Context:** Today the entries builder does `totalScore: parseInt(localScores[studentId], 10)`. After Task 1, dirty students may have an empty `localScores` value (image-only path). For those, we must read the saved score from `scoresMap` — guaranteed defined because Branch 1 only adds to the dirty set when `hasExistingRow` is true.

- [ ] **Step 1: Locate the entries builder**

In `features/classroom/components/StudentScoringList.tsx`, locate the `handleSubmitAll` useCallback and within it the `entries = dirtyIds.map(...)` expression.

- [ ] **Step 2: Replace the entries builder**

Replace the existing `entries = dirtyIds.map(...)` block with this version. The surrounding `setIsSubmitting`, `try/catch/finally`, `Promise.all`, and post-save image-flag reset all stay unchanged.

```ts
      const entries = dirtyIds.map((studentId) => {
        const local = localScores[studentId];
        const hasLocal = local !== undefined && local !== "";
        const totalScore = hasLocal
          ? parseInt(local, 10)
          : scoresMap[studentId];
        return {
          studentId,
          activityId: activityDetail.id,
          termId: activityDetail.termId,
          activityLocalId: activityDetail.localId,
          subjectId: activityDetail.subjectId,
          totalScore,
          file: imagesByStudent[studentId]?.uri || null,
        };
      });
```

- [ ] **Step 3: Update the `handleSubmitAll` dependency array**

The callback now reads `scoresMap`. Find the dependency array at the end of `useCallback(...)` for `handleSubmitAll` (currently `[dirtyStudentIds, localScores, imagesByStudent, activityDetail]`) and add `scoresMap`:

```ts
  }, [dirtyStudentIds, localScores, imagesByStudent, activityDetail, scoresMap]);
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: exit code 0 with no errors mentioning `StudentScoringList.tsx`.

- [ ] **Step 5: Run lint**

Run: `npx biome check features/classroom/components/StudentScoringList.tsx`
Expected: no errors. In particular, biome's `useExhaustiveDependencies` rule should not flag `scoresMap` as missing or extraneous.

- [ ] **Step 6: User commits when ready**

Do NOT stage or commit. Hand off to user:
> "Task 2 done — `handleSubmitAll` derives totalScore from `scoresMap` fallback. Ready for you to review and commit."

---

## Task 3: Manual verification on device/simulator

**Files:** None modified.

**Context:** No automated tests exist for this component. Verify each row of the behavior matrix from the spec by exercising the UI. Each case requires a classroom + activity with at least one student. Use existing seed data or a development classroom.

- [ ] **Step 1: Start the app**

Run the existing dev command for this project (e.g. `npx expo start` or `bun start` — match the team's normal workflow). Open the app on a simulator or physical device and navigate to a classroom → activity → InputGrade screen.

- [ ] **Step 2: Verify Case A — existing row, image-only change saves**

Setup: Pick a student that already has a saved score (the row shows the existing score and "Saved" indicator).

Actions:
1. Tap the image attachment for that student and pick any photo.
2. Do NOT change the numeric score field.
3. Observe the header — the "Save" label should become enabled (opacity 1).
4. Tap Save.

Expected:
- Save spinner shows briefly, then returns to "Save" disabled state.
- Re-open the screen. The photo persists for that student. The numeric score is unchanged.

- [ ] **Step 3: Verify Case B — no existing row, image-only change is ignored**

Setup: Pick a student with no saved score (no "Saved" indicator, score field empty).

Actions:
1. Attach a photo for that student.
2. Leave the score field empty.

Expected:
- The header "Save" label stays disabled (opacity 0.4).
- No save fires.

- [ ] **Step 4: Verify Case C — invalid score blocks save even with dirty image**

Setup: Pick any student. Find the activity's `maxScore` (visible in the "Apply score to all" row as `/N`).

Actions:
1. Attach a photo for the student.
2. Type a score that is greater than `maxScore` (or a negative number).

Expected:
- The header "Save" label stays disabled for this student's change.
- If other students have valid dirty changes, those still save; only this row is blocked.

- [ ] **Step 5: Verify Case D — existing score-edit flow unchanged**

Actions:
1. Edit a valid score for a student (no image change).
2. Tap Save.

Expected: behavior is identical to before the change — score updates persist.

- [ ] **Step 6: Report results**

Report to the user which cases passed and which (if any) failed, with exact reproduction steps for any failures.

---

## Self-Review (completed during plan authoring)

**Spec coverage:**
- Goal "header Save persists image-only changes when row exists" → Task 1 Branch 1 + Task 2 fallback ✓
- Goal "invalid score blocks entire row" → Task 1 Branch 2 ✓
- Goal "new rows still require a score" → Task 1 Branch 1 gates on `hasExistingRow` ✓
- Goal "no service-layer changes" → only `StudentScoringList.tsx` touched ✓
- Behavior matrix rows 1–7 → Task 3 cases A–D cover all distinct outcomes (rows with the same outcome share a case) ✓

**Placeholder scan:** No TBD, no "implement later", no vague error-handling steps. All code blocks contain the complete replacement, including dependency arrays.

**Type consistency:** `scoresMap` is `Record<number, number>` (defined at line 44 in the source). `parseInt(local, 10)` returns `number`. `scoresMap[studentId]` returns `number` (definitely defined per Branch 1 gate). `totalScore` is `number` either way — matches `upsertStudentScore`'s `totalScore: number` requirement. No mismatches.
