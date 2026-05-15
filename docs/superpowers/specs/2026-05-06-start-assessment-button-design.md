# Start Assessment Button — Design

Date: 2026-05-06
Branch: `feat/take-assessment-gaps`
Screen: `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx`

## Goal

When the student taps **Start Assessment**:

1. Ensure a `studentAssessment` (`activity_studentactivity`) row exists for this `(activity, term, subject, student)` tuple. Create it if absent; reuse if present.
2. Create a new `attempt` (`activity_retakerecord`) row in `ongoing` status, with the question order materialised.
3. Navigate to `AttemptScreen` (`/(main)/attempt/[attemptId]`) using the new attempt's `localId`.
4. Block the start when the student has already exhausted `data.maxRetake` completed attempts.

## Schema changes (`powersync/schema.ts`)

| Table | Field | Before | After |
|---|---|---|---|
| `studentAssessment` (`activity_studentactivity`) | `id` | `integer().primaryKey({ autoIncrement: true })` | `text().primaryKey()` — set equal to `local_id` |
| `studentAssessment` | `activityId` | `integer("activity_id").notNull()` | **dropped** (redundant with `activityLocalId`) |
| `attemptsTable` (`activity_retakerecord`) | `studentActivityId` | `integer` | `text` — stores `studentAssessment.localId` |
| `attemptsTable` | `activityId` | `integer` | `text` — stores `assessmentTable.localId` |
| `assessmentQuestionTable` (`activity_activityquestion`) | `activityId` | `integer` | `text` — stores `assessmentTable.localId` |

Existing relations declare `assessmentQuestionTable.activityId` references `assessmentTable.localId` (text), so this change brings the column type in line with the relation.

## New service helpers (`features/assessment/assessment.service.ts`)

```ts
getOrCreateStudentActivity({ activityLocalId, termId, subjectId, studentId })
  -> StudentAssessmentRow
// Looks up by (activityLocalId, termId, subjectId, studentId).
// On miss: inserts with id = local_id (cuid), retakeCount = 0, totalScore = 0, isEditable = 0.

buildQuestionOrder(activityLocalId: string, shuffle: boolean)
  -> number[]
// Reads assessmentQuestionTable rows where activityId = activityLocalId.
// Returns ids ordered asc, or Fisher–Yates shuffled when shuffle === true.

countAttempts({ studentActivityId, studentId, activityId })
  -> number
// Total count (used for retake_number = count + 1).

countCompletedAttempts({ studentActivityId, studentId, activityId })
  -> number
// Used for the maxRetake guard.

createAttempt({
  studentActivityId, studentId, activityId,
  retakeNumber, duration /* seconds */, questionOrder
})
  -> AttemptRow
// Inserts attemptsTable row with id = local_id (cuid),
// status = "ongoing", startedAt = now,
// willEndAt = startedAt + duration,
// lastIndex = 0, totalElapsedSeconds = 0, lastHeartbeatAt = now, score = 0.
```

The existing `startAssessmentAttempt` helper is removed in favour of these.

## Button handler

Pseudocode in `AssessmentDetailsScreen.tsx`:

```ts
const handleStart = async () => {
  // Guard: max retakes
  const completed = await countCompletedAttempts({
    studentActivityId: sa.localId,
    studentId, activityId: data.localId,
  });
  if (completed >= data.maxRetake) {
    toast.show({ label: "Max retakes reached", variant: "danger" });
    return;
  }

  const sa = await getOrCreateStudentActivity({
    activityLocalId: data.localId,
    termId: data.termId,
    subjectId: data.subjectId,
    studentId: authUser.id,
  });

  const questionOrder = await buildQuestionOrder(data.localId, data.shuffleQuestions);

  const retakeNumber =
    (await countAttempts({
      studentActivityId: sa.localId,
      studentId: sa.studentId,
      activityId: sa.activityLocalId,
    })) + 1;

  const attempt = await createAttempt({
    studentActivityId: sa.localId,
    studentId: sa.studentId,
    activityId: sa.activityLocalId,
    retakeNumber,
    duration: data.timeDuration * 60, // seconds
    questionOrder,
  });

  router.replace({
    pathname: "/(main)/attempt/[attemptId]",
    params: { attemptId: attempt.localId },
  });
};
```

The handler runs on `Button onPress` in `AssessmentDetailsScreen.tsx`. The button shows a loading state while in flight.

The retake guard runs *before* `getOrCreateStudentActivity`, so use the looked-up `studentActivity.localId` (or `null` when not yet created — count will simply be 0 in that case, which is correct for first attempts).

> Note: when `studentActivity` doesn't exist yet, `countCompletedAttempts` returns 0, which is correct (no prior attempts possible). The guard is therefore safe to run before or after `getOrCreate`.

## Callers to sweep (potential breakage from schema changes)

- `features/assessment/assessment.service.ts` — `getAssessmentDetails` filters on `studentAssessment.activityId` (integer). Update to filter by `activityLocalId` (or by other columns) since that integer column is being dropped.
- `features/assessment/assessment.service.ts` — `getQuestions`, `getOrderedQuestions` use `assessmentQuestionTable.activityId`; signatures shift from `number` to `string`.
- `features/assessment/assessment.hooks.ts` — `useGetQuestions(activityId: number)`, `useGetOrderedQuestions(activityId: number, …)`, `useChoicesForActivity(activityId: number)` — change to `string`.
- `screens/main/courses/course/assessment/AttemptScreen.tsx` — uses `attempt.activityId` (now string) for routing back; logic still works (string passed via params).
- `features/assessment/components/QuestionList.tsx`, `useAttemptSession.ts` — verify any places that pass `activityId` between layers.

## Cleanup in `AssessmentDetailsScreen.tsx`

- Delete the large commented-out `handleStartAssessment` block.
- Remove unused imports once the new logic lands (`getAttemptRecords`, `getQuestions`, `startAssessmentAttempt`, `useEffect`, `useNavigation`, `useAttemptRecords`, `useOngoingAttempt` if not used).

## Out of scope

- Resume-ongoing-attempt UX (separate decision).
- Migrations from old data with the changed integer columns; assumed safe given local-only PowerSync state in development.

## Verification

Manual: launch the app, open an assessment, tap **Start Assessment**:
- First tap creates studentAssessment + attempt; routes to AttemptScreen.
- Second tap (after submitting) reuses studentAssessment, creates attempt #2.
- N+1 tap (where N = `data.maxRetake`) shows the toast and stays on the screen.
