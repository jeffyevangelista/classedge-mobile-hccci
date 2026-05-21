# InputGradeScreen image-only save

**Date:** 2026-05-18
**Status:** Approved (pending implementation)
**Files touched:** `features/classroom/components/StudentScoringList.tsx`

## Problem

In `InputGradeScreen`, when a teacher attaches a photo to a student without also entering or changing the numeric score, the photo is silently dropped on Save.

Root cause is in `StudentScoringList.tsx` `dirtyStudentIds` (lines 125–155): the memo `continue`s on empty or invalid score *before* it consults `imageDirty`, so image-only changes never enter the dirty set and `handleSubmitAll` skips them.

## Goals

- Header Save button persists image-only changes when a row already exists for the student.
- Invalid score continues to block the entire row.
- New rows (no prior DB row) still require a score — no fake `0` inserts.
- No service-layer changes; `upsertStudentScore` already updates the `file` column on the UPDATE branch.

## Non-goals

- Immediate-on-pick save (attempt-screen style) — explicitly rejected in brainstorming (option A).
- Fixing the pre-existing "user clears image" bug in `upsertStudentScore` (the `?? existingRow.file` fallback preserves cleared images). Tracked separately.
- Uploading the local `file://` URI to server storage — same scope as today; the URI is persisted as-is and the attachment watcher in `features/attachments/attachments.config.ts` ignores `file://` values.

## Design

### `dirtyStudentIds` memo

Replace the early-continue-on-empty/invalid logic with a three-branch structure per student:

```
imageDirty = imagesByStudent[id]?.dirty === true
hasExistingRow = scoresMap[id] !== undefined
local = localScores[id]

# Branch 1: score field empty/untouched — image-only path
if local is undefined or local === "":
  if imageDirty and hasExistingRow:
    dirty.add(id)
  continue

# Branch 2: score field invalid — block entire row (B1)
numericScore = parseInt(local, 10)
if isNaN(numericScore) or numericScore < 0 or numericScore > activityDetail.maxScore:
  continue

# Branch 3: score field valid — existing behavior
saved = scoresMap[id]
scoreChanged = saved === undefined or saved !== numericScore
if scoreChanged or imageDirty:
  dirty.add(id)
```

Dependency array stays as today: `[validStudents, localScores, scoresMap, activityDetail.maxScore, imagesByStudent]`.

### `handleSubmitAll` entry building

When constructing each entry, derive `totalScore` from local input if present, otherwise from `scoresMap`:

```ts
const local = localScores[studentId];
const hasLocal = local !== undefined && local !== "";
const totalScore = hasLocal ? parseInt(local, 10) : scoresMap[studentId];
```

`scoresMap[studentId]` is guaranteed defined when `hasLocal` is false because Branch 1 only marks dirty when `hasExistingRow` is true.

`file` is unchanged: `imagesByStudent[studentId]?.uri || null`.

The resulting entry hits the UPDATE branch of `upsertStudentScore` (existing row), which writes both `total_score` and `file`.

## Behavior matrix

| Score field | Image dirty | Existing row | Save action |
|---|---|---|---|
| empty | no | — | not dirty (no change) |
| empty | yes | yes | dirty → UPDATE with existing DB score + new file |
| empty | yes | no | not dirty (B-b: no insert without score) |
| valid, unchanged | no | yes | not dirty |
| valid, unchanged | yes | yes | dirty → UPDATE with same score + new file |
| valid, changed | any | any | dirty → upsert as today |
| invalid (NaN/<0/>max) | any | any | not dirty (B1: blocks row) |

## Verification

Manual tests on `InputGradeScreen`:

1. Student with existing score → attach photo, leave score field unchanged → Save activates, photo persists in `activity_studentactivity.file`.
2. Student with no existing row → attach photo, leave score empty → Save does not activate for this student.
3. Student with existing row → type over-max score AND attach photo → Save does not activate for this student.
4. Existing score-edit flow (with or without photo) continues to work.

## Open questions

None.
