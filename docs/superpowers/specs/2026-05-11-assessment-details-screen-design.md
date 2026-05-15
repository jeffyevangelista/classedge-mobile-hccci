# AssessmentDetailsScreen UI/UX Redesign

**Date:** 2026-05-11
**Scope:** `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx`
**Status:** Design approved

## Problem

The current Start Assessment screen is text-heavy and flat:

- Title block (due date, activity name) sits at the top with no hierarchy.
- Three details (`Time Duration`, `Passing Score`, `Max Retakes`) render as plain key/value rows.
- Attempts list shows "Attempt N" only — no status detail, no submit info, no way to tell the ongoing attempt from a completed one at a glance.
- A single pinned-bottom "Start Assessment" button silently vanishes when max retakes are exhausted or the assessment is past due, with no explanation.
- Useful schema fields (`activityInstruction`, `retakeMethod`, `isGraded`, `showScore`, `activityFileInstruction`, `maxScore`, `passingScoreType`) are not surfaced.
- Students don't see how many questions the assessment has, how many attempts remain, what their best score is, or — if an attempt is already in progress — that they can resume it.

The goal is a holistic refresh that gives the screen identity, surfaces the numbers students care about, and handles every CTA state with an honest message.

## Goals

- Strong visual identity via a hero card that surfaces the three most-actionable numbers.
- Icon-prefixed info rows for the secondary details that don't belong in the hero.
- Past attempts that read at a glance (status, submit date), with a distinct ongoing-attempt treatment.
- Bottom CTA that always tells the student exactly what's going on — start, resume, late warning, max reached, or past due.
- Keep the existing public API: route remains `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx`, params unchanged, service calls (`findStudentActivity`, `countAttempts`, `buildQuestionOrder`, `createAttempt`) unchanged.

## Non-Goals

- Redesigning `AttemptScreen` (in-progress quiz view).
- Redesigning how assessments appear on the course timeline.
- Server-side schema or API changes.
- A new results screen.

## Layout

The screen is a single `ScrollView` with a pinned CTA bar at the bottom (safe-area aware). Top-to-bottom:

1. **Hero card** (full-width card, accent-themed)
2. **Info rows** (card with icon-prefixed key/value rows)
3. **Previous attempts** (section heading + list of attempt rows)
4. **Bottom CTA bar** (pinned, safe-area padded)

Loading state replaces the body with a tailored skeleton (hero + info + attempts).

```
┌──────────────────────────────────────────┐
│  HERO CARD                               │
│  Quiz · Due Nov 20                       │
│  Chapter 4 Quiz: Photosynthesis          │
│   20         30m        1 / 3            │
│   Questions  Time       Attempts left    │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  🎯  Passing score          15 / 20       │
│  🏆  Best score             17 / 20       │
│  🔁  Retake method          Highest       │
│  📝  Graded                 Yes           │
│  👁  Score visibility       After submit  │
│  📎  File instructions      Download →    │
└──────────────────────────────────────────┘

PREVIOUS ATTEMPTS
┌──────────────────────────────────────────┐
│  ▎ Attempt 2 · In progress     12:34 left │  ← ongoing
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│    Attempt 1 · Completed       Nov 18    │
└──────────────────────────────────────────┘

─── pinned bottom ───
[ Start Assessment · 30 min ]
or
[ Resume attempt ]
or
"You've used all 3 attempts."
or
⚠ Past due — submissions count as late
[ Start Assessment ]
```

## Hero Card

A `Surface` (or styled `View`) with a subtle accent-colored background — uses the project's `--accent` token rather than a custom gradient, so light/dark themes stay consistent. Foreground text uses `--accent-foreground`.

Contents, top to bottom:

- **Eyebrow line:** `Quiz · Due <Mon DD>` (small uppercase or label-styled). "Quiz" is hardcoded for now — the only assessment type this screen surfaces.
- **Title:** `data.activityName`. Large, bold. Single line preferred; ellipsize at 2 lines.
- **Stats row** — three equal-width stat cells:
  1. **Questions** — `questionOrder.length` (or `assessmentQuestionTable` count for this activity). If still loading, show `—`.
  2. **Time** — `data.timeDuration` minutes, abbreviated (`30m`, `1h 30m`).
  3. **Attempts left** — `data.maxRetake - attempts.length` over `data.maxRetake`, shown as `1 / 3`.

Each stat has:
- Big number/label (e.g., `20`, `30m`, `1 / 3`)
- Caption underneath (`Questions`, `Time`, `Attempts left`) in uppercase, smaller, slightly faded.

When `attempts` is still loading, the third stat shows `—`. When `maxRetake` is 0 or attempts data is unavailable, fall back to `—` rather than `-1 / 0`.

## Info Rows

A second `Surface` card below the hero. Each row is a left icon + label on the left, value on the right, with a 1px divider between rows (last row no divider). Rows are conditional on the underlying field being meaningful.

Always shown:

| Icon | Label | Value |
|---|---|---|
| 🎯 (`Target`) | Passing score | `<passingScore> / <maxScore>` when `passingScoreType === "raw"`; `<passingScore>%` when `"percent"` |
| 🔁 (`ArrowsClockwise`) | Retake method | `data.retakeMethod` capitalized (e.g., "Highest", "Latest") |
| 📝 (`PencilLine`) | Graded | "Graded" if `data.isGraded`, otherwise "Practice" |
| 👁 (`Eye`) | Score visibility | "Shown after submission" if `data.showScore`, otherwise "Hidden" |

Conditionally shown:

| Condition | Icon | Label | Value |
|---|---|---|---|
| `studentAssessment` exists, at least one completed attempt, AND `data.showScore` | 🏆 (`Trophy`) | Best score | `<studentAssessment.totalScore> / <maxScore>` |
| `data.activityFileInstruction` is set (a file id/uri) | 📎 (`Paperclip`) | File instructions | Tappable "Download" → opens the attachment |

**Source of the "best score":** `studentAssessment.totalScore`. Per-attempt scores from `attemptsTable.score` are intentionally not used on this screen because they aren't the authoritative grade.

Icons are phosphor-react-native names via `@/components/Icon` (`Target`, `ArrowsClockwise`, `PencilLine`, `Eye`, `Trophy`, `Paperclip`). Substitute the closest available phosphor name if any of these aren't exported.

## Previous Attempts

Section heading `Previous attempts`, then a list of attempt rows. Pulled from `useAttemptRecords(studentAssessment.id, authUser.id)` — same hook as today.

### Layout per row

A `Surface` row, 56px tall, with:
- Optional 3px left accent bar (only for the ongoing attempt).
- Left: `Attempt <retakeNumber> · <status text>`
- Right:
  - Ongoing: live countdown `<MM:SS> left` in accent color (preserves existing `computeRemaining` logic from `AssessmentAttempts.tsx:46-52`).
  - Completed: `<submit date>` formatted `Mon DD` (uses the local timezone equivalent of the row's submission moment — see Data Source below).
  - Late: `<submit date>` plus a small "Late" chip.

Status text mapping:

| `item.status` | Status text |
|---|---|
| `ongoing` | `In progress` |
| `completed` | `Completed` |
| `late` | `Late submission` |
| anything else | the raw value, capitalized |

### Sort order

Most recent first (descending `retakeNumber`). Today the list isn't sorted — explicit sort makes the ongoing attempt (if any) and the latest result appear at the top.

### Tap behavior

- Ongoing → routes to `/(main)/attempt/[attemptId]` with the attempt's `localId`. Same as today.
- Completed → routes to the results screen if it exists; otherwise non-interactive (no-op, no visual press feedback). This screen redesign does not build a results screen.

### Empty state

When `data` is `undefined`/empty: render a single line `"No attempts yet"` in muted text in place of the list (same as today). The section heading still renders so the structure stays consistent.

### Data Source for `submit date`

`attemptsTable` does not currently store a `submittedAt` field. Use `lastHeartbeatAt` as the proxy for completed/late rows — it's already maintained by the attempt flow. If a `submittedAt` column is added later, swap to that without changing the visual treatment.

## Bottom CTA Bar

A pinned bar at the bottom of the screen, padded for safe area (`Math.max(insets.bottom, 16)` for the bottom inset — keep current behavior). Background `bg-surface-secondary` to match the rest of the project. Width respects the existing `max-w-3xl mx-auto` container.

The CTA bar renders different content based on a derived `ctaState`:

| State | Trigger | Bar contents |
|---|---|---|
| `resume` | `attempts.some(a => a.status === "ongoing")` | `<Button variant="primary">Resume attempt</Button>` — taps route to the ongoing attempt |
| `start` | None of the below, AND no ongoing | `<Button variant="primary">Start Assessment · <duration>m</Button>` — taps run `handleStart` |
| `late-warning` | `Date.now() > endTime` AND `data.allowLate` | small caption `⚠ Past due — submissions count as late` above the Start button |
| `max-reached` | `attempts.length >= data.maxRetake` | no button; caption `You've used all <maxRetake> attempts.` |
| `past-due-blocked` | `Date.now() > endTime` AND `!data.allowLate` | no button; caption `This assessment is past due.` |
| `starting` | `starting === true` | button text becomes `Starting…`, button is `isDisabled` |
| `not-signed-in` | `!authUser?.id` | button is `isDisabled`; no caption |

Priority order when multiple are true:
1. `max-reached`
2. `past-due-blocked`
3. `resume`
4. `late-warning` + `start`
5. `start`

A `starting` overlay applies on top of `start`, `resume`, and `late-warning` to flip the button label/disable.

The `Start Assessment · 30m` label puts the time commitment in the CTA so students aren't surprised when the timer starts.

## State and Hooks

Existing hooks stay:
- `useCourseAssessment(assessmentId)` — assessment metadata.
- `useAssessmentDetails({ userId, assessmentId })` — `studentAssessment` row (provides `totalScore`).
- `useAttemptRecords(studentAssessment.id, authUser.id)` — attempt list with statuses and timestamps.

New local helpers (inside `AssessmentDetailsScreen.tsx`):
- `formatDuration(minutes: number): string` → `"30m"`, `"1h 30m"`.
- `formatDueDate(iso: string): string` → `"Nov 20"` (short form for the eyebrow line). Reuses `toLocaleDateString` with `month: "short", day: "numeric"`. Keep the existing full-form helper if we want it elsewhere, or remove if unused.
- `formatPassingScore(data)` → `"15 / 20"` or `"75%"` based on `passingScoreType`.
- `deriveCtaState(...)` → one of the states above.

`questionOrder.length` for the hero is fetched lazily via the existing `buildQuestionOrder` only at `handleStart` time. For the **hero display**, add:

- `getQuestionCount(activityLocalId: string): Promise<number>` in `features/assessment/assessment.service.ts` — `SELECT COUNT(*) FROM assessmentQuestionTable WHERE activityId = ?`.
- `useQuestionCount(activityLocalId: string | undefined)` in `features/assessment/assessment.hooks.ts` — returns `number | undefined`, disables when no id.

When the count is undefined or loading, the hero stat shows `—`.

## Component Decomposition

To keep `AssessmentDetailsScreen.tsx` readable, extract the new visual pieces into a screen-local folder:

```
screens/main/courses/course/assessment/
  AssessmentDetailsScreen.tsx          (orchestrator + handleStart + ctaState)
  details/
    AssessmentHeroCard.tsx             (eyebrow, title, 3 stats)
    AssessmentInfoRows.tsx             (icon rows; receives data + studentAssessment)
    AssessmentCtaBar.tsx               (renders one of the CTA states)
```

The existing `features/assessment/components/AssessmentAttempts.tsx` remains the source of the attempt list and is **modified in place** (no rename, no new wrapper). The redesign:
- Adjusts the `AttemptCard` visual to match the new spec (left accent bar for ongoing, status text mapping, submit-date right side, sort order).
- Removes any per-attempt score display.
- Stays a single file — no further decomposition.

The screen imports `AssessmentAttempts` as it does today.

The screen orchestrator owns:
- Hooks
- `starting` state
- `handleStart`, `handleResume`
- `ctaState` derivation
- Rendering the four sections + CTA bar

## Visual Conventions

- All colors via theme tokens: `bg-accent`, `text-accent-foreground`, `border-border`, `bg-default`, `text-muted`, `text-danger`. No raw hex.
- Cards use HeroUI `Surface` (or styled `View` with `border-border` + `rounded-xl`). Match the radii used elsewhere in the project (`rounded-xl` for cards, `rounded-lg` for rows).
- Icons via `@/components/Icon` with phosphor names; size 18px for info-row icons, 16px for status chips.
- Typography via `AppText` with `weight` variants. Hero title uses `weight="bold"`; section headings use `weight="semibold"`.

## Error and Loading States

- **Loading** (`isLoading`): existing `AssessmentDetailsSkeleton` is updated to reflect the new layout — hero skeleton (rounded card with three short stat blocks), info-rows skeleton (4 rows), attempts skeleton (3 rows). CTA bar shows a single full-width skeleton button.
- **Error** (`isError`): existing `<ErrorFallback>` component unchanged.
- **No assessment** (`!data`): existing `<NoDataFallback>` unchanged.
- **`handleStart` failure**: existing toast behavior preserved.

## Out of Scope

- A real results screen for tapped completed attempts (current behavior: navigate to results route if it exists; otherwise no-op).
- Adding a server-side `submittedAt` column. We use `lastHeartbeatAt` as the proxy.
- Late submission rules (just surface the warning; the existing `allowLate` logic stays).
- Course-timeline entry point redesign.

## Verification

Manual on a device or simulator:
- Fresh assessment, no attempts → hero shows `Questions / Time / 3 / 3`. Info rows show passing score + retake method + graded + score visibility. No "Best score" row. Attempts section shows "No attempts yet". CTA: `Start Assessment · 30m`.
- Mid-flight (1 ongoing) → ongoing row appears at the top with accent bar + countdown. CTA flips to `Resume attempt`.
- 2 completed, 1 left → hero shows `1 / 3`. Best score row appears. CTA: `Start Assessment · 30m`.
- Max retakes reached → CTA replaced with "You've used all 3 attempts."
- Past due + `!allowLate` → CTA replaced with "This assessment is past due."
- Past due + `allowLate` → late warning chip above CTA, button still shows `Start Assessment · 30m`.
- `activityFileInstruction` set → File instructions row appears with a Download action.
- Light/dark theme → hero accent + foreground still readable; no raw color leakage.
