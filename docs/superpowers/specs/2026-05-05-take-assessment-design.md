# Take Assessment — Gap-Closing Design

**Date:** 2026-05-05
**Branch:** `feat/layered-chrome` (work will be carved onto its own branch off `main`)
**Scope:** Close gaps in the existing student "take assessment" flow. No schema changes. No redesign.

## 1. Context

The Take Assessment feature is largely implemented. Schema (`activity_activity`, `activity_studentactivity`, `activity_retakerecord`, `activity_retakerecorddetail`, `activity_activityquestion`, `activity_questionchoice`), services, hooks, screens, the timer/heartbeat session, and stepper navigation already exist.

This spec closes the visible gaps surfaced in brainstorming and aligns the codebase with the user's intent.

### Already correct (no change)

- Max-retake gate before starting an attempt.
- Shuffle vs. ascending question order, stored as JSON-stringified array of question IDs in `attempts.questionOrder`.
- `lastIndex` persistence on Next/Previous (lives in `activity_retakerecord`, not `activity_activity` — the latter was a wording slip).
- Incremental answer saving on every change (`activity_retakerecorddetail`).
- Timer driven by `duration` + `totalElapsedSeconds`; heartbeat every 10s into `lastHeartbeatAt` (timestamp, not remaining duration — current model is more robust against clock drift and tampering).
- AppState background/foreground handling that keeps the timer ticking through the gap.
- Auto-submit on time-up that routes back to the assessment details screen.
- Stepper-style Previous/Next navigation.

### Gaps closed by this spec

1. `MultipleChoiceQuestion` renders hardcoded `Option A/B/C/D` instead of real choices from `activity_questionchoice`.
2. No manual **Submit** button — only Next/Previous.
3. Plain back button on the attempt screen with no confirmation, despite the timer-keeps-running model.
4. No detection of an in-flight ongoing attempt — re-tapping Start can double-create attempts.
5. `AssessmentAttempts` list card timer drifts from `useAttemptSession`'s elapsed (it estimates from wall-clock `startedAt` instead of using `totalElapsedSeconds` + `lastHeartbeatAt`).
6. `submitAttempt` always writes `score: 0`. This stays a no-grade for now (per decision), but the API is renamed for clarity.

## 2. Decisions

| # | Decision |
|---|---|
| Q1 | **Scope:** close gaps in current implementation; no rewrite. |
| Q2 | **Manual submit:** Submit button replaces Next on the **last** question, with a confirm dialog. Previous remains. |
| Q3 | **Scoring:** no auto-grade. `finalizeAttempt` writes `status: "completed"` only; teacher grades later. |
| Q4 | **MC choices:** single batched query (`getChoicesForActivity`) returns all choices for the activity; renderer filters by `questionId`. `studentAnswer` stores the **choice ID as a string**. |
| Q5 | **Attempts list card:** live remaining time computed as `duration - (totalElapsedSeconds + (now - lastHeartbeatAt))` — same model as `useAttemptSession`. |
| Q6 | **Back button:** confirmation dialog ("Your timer keeps running while you're away. Leave anyway?") on header back **and** Android hardware back. iOS swipe-back disabled on the attempt screen. |
| Q7 | **Stale ongoing:** AssessmentDetailsScreen detects an `ongoing` attempt and shows **Resume Attempt** instead of Start. Tapping a stale ongoing card routes into the attempt; `useAttemptSession`'s mount effect handles the time-up auto-submit. |

## 3. File plan

```
features/assessment/
├── assessment.service.ts             EDIT: + getChoicesForActivity, getOngoingAttempt, finalizeAttempt
├── assessment.hooks.ts               EDIT: + useChoicesForActivity, useOngoingAttempt
├── components/
│   ├── QuestionList.tsx              EDIT: stepper shell + Submit button + confirm dialog
│   ├── AssessmentAttempts.tsx        EDIT: model-aligned live timer
│   ├── AssessmentResult.tsx          NO CHANGE
│   └── questions/                    NEW
│       ├── index.ts                  re-exports + QuestionRenderer switch
│       ├── types.ts                  Question / Choice / props types
│       ├── MultipleChoiceQuestion.tsx   rewritten with real choices
│       ├── EssayQuestion.tsx
│       ├── TrueFalseQuestion.tsx
│       ├── FillInTheBlankQuestion.tsx
│       ├── MatchingQuestion.tsx
│       ├── NumericQuestion.tsx
│       └── ImageBasedQuestion.tsx

screens/main/courses/course/assessment/
├── AssessmentDetailsScreen.tsx       EDIT: Resume vs Start branching; completed-only retake count
└── AttemptScreen.tsx                 EDIT: back-confirm header, submit handler wiring, gestureEnabled: false

hooks/
├── useAttemptSession.ts              NO CHANGE (already correct)
└── useAssessmentTimer.ts             NO CHANGE
```

No new screens. No schema changes. The `questions/` extraction exists because we are heavily editing the MC renderer and the 730-line `QuestionList.tsx` is hard to navigate.

## 4. Service & hook additions

### `assessment.service.ts`

```ts
// Batched choices for an activity. Renderer filters per-question.
export const getChoicesForActivity = (activityId: number) =>
  db.query.assessmentQuestionsTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    orderBy: (t, { asc }) => [asc(t.id)],
  });

// In-flight attempt for this studentAssessment, if any.
export const getOngoingAttempt = (studentActivityId: number, studentId: number) =>
  db.query.attemptsTable.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.studentActivityId, studentActivityId),
        eq(t.studentId, studentId),
        eq(t.status, "ongoing"),
      ),
  });

// Manual submit. Status only; no grading.
export const finalizeAttempt = (attemptLocalId: string) =>
  db.update(attemptsTable)
    .set({
      status: "completed",
      lastHeartbeatAt: new Date().toISOString(),
    })
    .where(eq(attemptsTable.localId, attemptLocalId));
```

`useAttemptSession.handleAutoSubmit` is updated to call `finalizeAttempt` so manual + auto take the same write path. The existing `submitAttempt` is replaced by `finalizeAttempt` (it was the only caller and was hardcoding `score: 0`).

### `assessment.hooks.ts`

```ts
export const useChoicesForActivity = (activityId: number) =>
  useQuery({
    queryKey: ["activity-choices", activityId],
    queryFn: () => getChoicesForActivity(activityId),
    enabled: !!activityId,
    staleTime: 1000 * 60 * 5,
  });

export const useOngoingAttempt = (studentActivityId?: number, studentId?: number) =>
  useQuery({
    queryKey: ["ongoing-attempt", studentActivityId, studentId],
    queryFn: () => getOngoingAttempt(studentActivityId!, studentId!),
    enabled: !!studentActivityId && !!studentId,
    staleTime: 0,
    refetchOnMount: true,
  });
```

## 5. UI changes

### 5.1 `MultipleChoiceQuestion`

- New prop: `choices: Choice[]` (already filtered to this question's `questionId`).
- Renders one `TouchableOpacity` per choice; label is `choice.choiceText`.
- Selection state compared as `currentAnswer === String(choice.id)`.
- `onAnswer(question.id, String(choice.id))` on tap.
- Zero choices → small "No choices configured" placeholder; stepper navigation still works.

### 5.2 `QuestionList`

- New prop: `onSubmit: () => void`.
- On the **last** index, the disabled "Next" is replaced with a primary **Submit** button.
- Tap opens a confirm dialog (HeroUI native dialog matching existing patterns) with title "Submit assessment?", body "Once submitted, you can't change your answers.", actions Cancel / Submit.
- Confirm calls `onSubmit`, which the parent wires to `finalizeAttempt` + `router.replace` to the assessment details route.
- A single batched fetch via `useChoicesForActivity(activityId)` is performed once at the list level. Choices are filtered per-question and passed to the MC renderer.
- `isTimeUp` continues to disable the form. If timeout fires while the dialog is open, the auto-submit path wins; `useAttemptSession.isSubmittingRef` prevents double finalize.

### 5.3 `AttemptScreen`

- `headerLeft` replaced with a custom button that opens a confirm dialog: title "Leave this attempt?", body "Your timer keeps running while you're away.", actions Stay / Leave.
- Android hardware back is intercepted with `useFocusEffect` + `BackHandler.addEventListener` and shows the same dialog.
- iOS swipe-back disabled via `gestureEnabled: false` for this route.
- Wires `onSubmit` for the QuestionList: calls `finalizeAttempt(attempt.localId)`, then `router.replace` to the assessment details.

### 5.4 `AssessmentDetailsScreen`

- Adds `useOngoingAttempt(studentAssessment.id, authUser.id)`.
- If an ongoing attempt exists: bottom button label becomes **"Resume Attempt"** and routes via `router.replace` to `/(main)/attempt/[attemptId]` with `attemptId: ongoing.localId`.
- If no ongoing: existing flow (Start Assessment).
- Max-retake check now counts only `status === "completed"` so a stale ongoing row never burns a retake.

### 5.5 `AssessmentAttempts`

- `AttemptCard` initializes its `elapsedRef` from the model-aligned formula:
  ```ts
  const baseElapsed = item.totalElapsedSeconds;
  const gap = Math.max(0, Math.floor((Date.now() - new Date(item.lastHeartbeatAt).getTime()) / 1000));
  const initial = item.status === "ongoing" ? baseElapsed + gap : baseElapsed;
  ```
- `useAssessmentTimer` continues ticking once per second.
- For `completed` cards, the timer is hidden; the trailing label is the status.

## 6. Edge cases

| Case | Resolution |
|---|---|
| Manual submit racing time-up | `isSubmittingRef` guard in `useAttemptSession`; first write wins. |
| Tapping a card whose timer is already past `duration` | AttemptScreen mounts → init effect detects `elapsedRef >= duration` → `handleAutoSubmit` → routes back. |
| MC question with zero rows in `activity_questionchoice` | Placeholder "No choices configured"; navigation still works. |
| Offline finalize | PowerSync writes locally; UI routes off local write; sync flushes when online. |
| Existing `ongoing` for same studentAssessment | Prevented at the source — Resume replaces Start. |
| Pre-existing `studentAnswer` rows from the hardcoded `"0/1/2/3"` MC | Will appear unselected. Acceptable: prior data was never valid. |
| Android hardware back | Intercepted; same confirm dialog. |
| `maxRetake === 0` | Start button never enabled (existing logic; verified against new completed-only count). |

### Error handling

- New service calls throw on DB error; UI surfaces via the existing `useToast` `variant: "danger"` pattern.
- Manual submit failure: dialog remains open, error toast shown, retry available.
- Auto-submit failure: already logged by `useAttemptSession`; tick will retry on next interval.

## 7. Testing

The codebase has no test framework wired for this area. Verification is manual:

1. **Start flow** — fresh attempt; `questionOrder` is shuffled or ascending matching `shuffleQuestions`.
2. **Resume flow** — start, leave, return to AssessmentDetails; button reads "Resume Attempt"; landing index matches stored `lastIndex`.
3. **Stepper** — Next/Previous persists `lastIndex`; typed answers persist across navigation; MC choices come from real data.
4. **Manual submit** — Submit on last question → confirm → status `completed`, routed back.
5. **Auto-submit** — 1-min `timeDuration` test activity; timer expires; status `completed`, routed back.
6. **Background tick** — start, background app >30s, return; elapsed reflects gap; no duplicate submits.
7. **Back-confirm** — header back and hardware back both show dialog; "Stay" keeps timer; "Leave" exits with timer continuing via heartbeat.
8. **Attempts list timer** — countdown on the card matches the AttemptScreen's to within 1s.
9. **Max retake** — complete `maxRetake` attempts; Start button disappears; stale ongoing rows don't count.

## 8. Out of scope

- Auto-grading objective question types.
- A teacher-side grading queue UI.
- Test framework setup.
- Restructuring `QuestionList` beyond the targeted renderer split.
- Changing `useAttemptSession` semantics or schema fields.
