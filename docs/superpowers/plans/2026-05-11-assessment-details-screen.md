# AssessmentDetailsScreen UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat text-only AssessmentDetailsScreen with a hero-card layout: a themed hero with three key stats, icon-prefixed info rows, polished attempt rows with explicit status, and a state-aware CTA bar (start / resume / max-reached / past-due / late-warning).

**Architecture:** Compose the screen from four focused sub-components in a screen-local `details/` folder (`AssessmentHeroCard`, `AssessmentInfoRows`, `AssessmentCtaBar`) plus an in-place refactor of `features/assessment/components/AssessmentAttempts.tsx`. The screen orchestrator owns hooks, `starting` state, and CTA-state derivation. A new `getQuestionCount` service helper + `useQuestionCount` hook lazily counts assessment questions for the hero stat.

**Tech Stack:** React Native (Expo), TypeScript, HeroUI Native (`Surface`, `Button`), Uniwind (Tailwind for RN), `phosphor-react-native` (via `@/components/Icon`), Drizzle ORM with PowerSync, `@powersync/tanstack-react-query` for queries.

**Project verification commands:**
- Typecheck: `pnpm typecheck` (runs `tsc --noEmit`)
- Lint: `pnpm lint` (runs `biome check .`) — note: in some local environments `biome` is not installed; that's an environment issue, not a plan failure. Use typecheck as the primary signal.
- No unit-test runner is configured in this project. Verification = `typecheck` + manual device check.
- **Do NOT stage or commit** at any point. The user manages staging and commits themselves. Ignore any "Commit" step you may see in plan boilerplate.

**Theme tokens used** (verified in `global.css`):
- `bg-accent`, `text-accent-foreground` — hero card
- `border-border`, `bg-default`, `bg-surface-secondary`, `bg-overlay`
- `text-muted`, `text-danger`
- AVOID: `text-muted-foreground`, `border-default-200`, `bg-default-100`, `text-destructive` (these don't resolve in this project).

---

## File Structure

Create:
- `screens/main/courses/course/assessment/details/AssessmentHeroCard.tsx` — eyebrow, title, three stats.
- `screens/main/courses/course/assessment/details/AssessmentInfoRows.tsx` — icon-prefixed key/value rows.
- `screens/main/courses/course/assessment/details/AssessmentCtaBar.tsx` — renders one of the CTA states.
- `features/assessment/formatters.ts` — pure helpers (`formatDuration`, `formatDueDate`, `formatShortDate`, `formatPassingScore`, `capitalize`). Lives in `features/` because both screen-local components and `features/assessment/components/AssessmentAttempts.tsx` consume it; placing it under `screens/` would create a screens→features cross-tree dependency.

Modify:
- `features/assessment/assessment.service.ts` — add `getQuestionCount(activityLocalId)`.
- `features/assessment/assessment.hooks.ts` — add `useQuestionCount(activityLocalId)`.
- `features/assessment/components/AssessmentAttempts.tsx` — adjust `AttemptCard` visual, status mapping, accent bar, submit-date column, sort order; updated skeleton.
- `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx` — assemble the new pieces; replace skeleton; derive `ctaState`.

No other files are touched.

---

## Task 1: Add `getQuestionCount` service helper and `useQuestionCount` hook

**Files:**
- Modify: `features/assessment/assessment.service.ts`
- Modify: `features/assessment/assessment.hooks.ts`

- [ ] **Step 1: Add the service helper**

Append the following function to `features/assessment/assessment.service.ts` (after the existing `getQuestions` helper near line 65):

```ts
export const getQuestionCount = async (
  activityId: string,
): Promise<number> => {
  const rows = await db.query.assessmentQuestionTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    columns: { id: true },
  });
  return rows.length;
};
```

Note: Drizzle with PowerSync doesn't expose a raw COUNT, so we fetch ids only and return `rows.length`. The id-only projection keeps the result row small.

- [ ] **Step 2: Add the hook**

Append the following to `features/assessment/assessment.hooks.ts` (alongside the other `useGet…` hooks). Update the existing import block at the top of the file to include `getQuestionCount`:

```ts
// in the existing top-of-file import block:
import {
  getAssessmentAttempt,
  getAssessmentDetails,
  getAttemptRecords,
  getQuestions,
  getOrderedQuestions,
  getAnswersForAttempt,
  getChoicesForActivity,
  getOngoingAttempt,
  getQuestionTypes,
  getQuestionCount,
} from "./assessment.service";
```

And append:

```ts
export const useQuestionCount = (activityId: string | undefined) => {
  return useQuery({
    queryKey: ["question-count", activityId],
    queryFn: () => getQuestionCount(activityId!),
    enabled: !!activityId,
    staleTime: 1000 * 60 * 5,
  });
};
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: exits without NEW errors. Pre-existing errors in unrelated files (`AssessmentResult.tsx`, `ScoreDisplayList.tsx`, `StudentScoringList.tsx`, `OneSignalProvider.tsx`) are out of scope.

- [ ] **Step 4: Do NOT commit.** Leave changes on disk.

---

## Task 2: Add `formatters.ts` pure helpers

**Files:**
- Create: `features/assessment/formatters.ts`

- [ ] **Step 1: Create the file**

```ts
// features/assessment/formatters.ts

export const formatDuration = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const formatDueDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const formatShortDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const formatPassingScore = (
  passingScore: number,
  passingScoreType: string,
  maxScore: number,
): string => {
  if (passingScoreType === "percent") return `${passingScore}%`;
  return `${passingScore} / ${maxScore}`;
};

export const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors related to this file.

- [ ] **Step 3: Do NOT commit.**

---

## Task 3: Add `AssessmentHeroCard.tsx`

**Files:**
- Create: `screens/main/courses/course/assessment/details/AssessmentHeroCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
// screens/main/courses/course/assessment/details/AssessmentHeroCard.tsx
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { formatDueDate, formatDuration } from "@/features/assessment/formatters";

interface Props {
  activityName: string;
  endTime: string;
  questionCount: number | undefined;
  timeDurationMinutes: number;
  attemptsUsed: number | undefined;
  maxRetake: number;
}

const Stat = ({ value, label }: { value: string; label: string }) => (
  <View className="flex-1">
    <AppText weight="bold" className="text-xl text-accent-foreground">
      {value}
    </AppText>
    <AppText className="text-[10px] tracking-widest uppercase text-accent-foreground/80 mt-1">
      {label}
    </AppText>
  </View>
);

export const AssessmentHeroCard = ({
  activityName,
  endTime,
  questionCount,
  timeDurationMinutes,
  attemptsUsed,
  maxRetake,
}: Props) => {
  const questionsStat = questionCount === undefined ? "—" : String(questionCount);
  const timeStat = formatDuration(timeDurationMinutes);
  const attemptsLeftStat =
    attemptsUsed === undefined
      ? "—"
      : `${Math.max(0, maxRetake - attemptsUsed)} / ${maxRetake}`;

  return (
    <View className="rounded-xl bg-accent p-4">
      <AppText className="text-[10px] tracking-widest uppercase text-accent-foreground/80">
        Quiz · Due {formatDueDate(endTime)}
      </AppText>
      <AppText
        weight="bold"
        className="text-lg text-accent-foreground mt-1"
        numberOfLines={2}
      >
        {activityName}
      </AppText>
      <View className="flex-row gap-3 mt-4">
        <Stat value={questionsStat} label="Questions" />
        <Stat value={timeStat} label="Time" />
        <Stat value={attemptsLeftStat} label="Attempts left" />
      </View>
    </View>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors related to this file.

- [ ] **Step 3: Do NOT commit.**

---

## Task 4: Add `AssessmentInfoRows.tsx`

**Files:**
- Create: `screens/main/courses/course/assessment/details/AssessmentInfoRows.tsx`

- [ ] **Step 1: Create the file**

```tsx
// screens/main/courses/course/assessment/details/AssessmentInfoRows.tsx
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import {
  capitalize,
  formatPassingScore,
} from "@/features/assessment/formatters";

interface Props {
  passingScore: number;
  passingScoreType: string;
  maxScore: number;
  retakeMethod: string;
  isGraded: boolean;
  showScore: boolean;
  bestScore: number | null;
  fileInstructionUrl: string | null;
  onOpenFileInstruction?: () => void;
}

interface Row {
  key: string;
  icon: IconName;
  label: string;
  value: string;
  onPress?: () => void;
}

const RowItem = ({
  row,
  isLast,
}: {
  row: Row;
  isLast: boolean;
}) => {
  const content = (
    <View
      className={`flex-row items-center justify-between py-3 ${
        isLast ? "" : "border-b border-border"
      }`}
    >
      <View className="flex-row items-center gap-3">
        <Icon name={row.icon} size={18} />
        <AppText className="text-sm text-muted">{row.label}</AppText>
      </View>
      <AppText weight="semibold" className="text-sm">
        {row.value}
      </AppText>
    </View>
  );

  if (row.onPress) {
    return (
      <Pressable
        onPress={row.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${row.label}: ${row.value}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
};

export const AssessmentInfoRows = ({
  passingScore,
  passingScoreType,
  maxScore,
  retakeMethod,
  isGraded,
  showScore,
  bestScore,
  fileInstructionUrl,
  onOpenFileInstruction,
}: Props) => {
  const rows: Row[] = [];

  rows.push({
    key: "passing",
    icon: "Target",
    label: "Passing score",
    value: formatPassingScore(passingScore, passingScoreType, maxScore),
  });

  if (bestScore !== null && showScore) {
    rows.push({
      key: "best",
      icon: "Trophy",
      label: "Best score",
      value: `${bestScore} / ${maxScore}`,
    });
  }

  rows.push({
    key: "retake-method",
    icon: "ArrowsClockwise",
    label: "Retake method",
    value: capitalize(retakeMethod),
  });

  rows.push({
    key: "graded",
    icon: "PencilLine",
    label: "Graded",
    value: isGraded ? "Graded" : "Practice",
  });

  rows.push({
    key: "score-visibility",
    icon: "Eye",
    label: "Score visibility",
    value: showScore ? "Shown after submission" : "Hidden",
  });

  if (fileInstructionUrl && onOpenFileInstruction) {
    rows.push({
      key: "file",
      icon: "Paperclip",
      label: "File instructions",
      value: "Download",
      onPress: onOpenFileInstruction,
    });
  }

  return (
    <View className="rounded-xl bg-default border border-border px-4">
      {rows.map((r, idx) => (
        <RowItem key={r.key} row={r} isLast={idx === rows.length - 1} />
      ))}
    </View>
  );
};
```

Verification note: if any of the phosphor icon names (`Target`, `Trophy`, `ArrowsClockwise`, `PencilLine`, `Eye`, `Paperclip`) are not present in `phosphor-react-native` v3 exports, swap to the closest available equivalent (e.g., `Crosshair` for `Target`, `Repeat` for `ArrowsClockwise`, `NotePencil` for `PencilLine`). TypeScript will reject any unknown name because `IconName` is typed as `keyof typeof PhosphorIcons` in `components/Icon.tsx:4`.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors related to this file. If icon name typos surface, fix them per the verification note above.

- [ ] **Step 3: Do NOT commit.**

---

## Task 5: Add `AssessmentCtaBar.tsx`

**Files:**
- Create: `screens/main/courses/course/assessment/details/AssessmentCtaBar.tsx`

- [ ] **Step 1: Create the file**

```tsx
// screens/main/courses/course/assessment/details/AssessmentCtaBar.tsx
import { View } from "react-native";
import { Button } from "heroui-native";
import { AppText } from "@/components/AppText";
import { formatDuration } from "@/features/assessment/formatters";

export type CtaState =
  | { kind: "start"; late?: boolean }
  | { kind: "resume" }
  | { kind: "max-reached"; maxRetake: number }
  | { kind: "past-due-blocked" };

interface Props {
  state: CtaState;
  starting: boolean;
  timeDurationMinutes: number;
  onStart: () => void;
  onResume: () => void;
  bottomInset: number;
}

export const AssessmentCtaBar = ({
  state,
  starting,
  timeDurationMinutes,
  onStart,
  onResume,
  bottomInset,
}: Props) => {
  const containerStyle = {
    paddingBottom: Math.max(bottomInset, 16),
  };

  if (state.kind === "max-reached") {
    return (
      <View className="p-4 bg-surface-secondary" style={containerStyle}>
        <AppText className="text-sm text-muted text-center">
          You've used all {state.maxRetake} attempts.
        </AppText>
      </View>
    );
  }

  if (state.kind === "past-due-blocked") {
    return (
      <View className="p-4 bg-surface-secondary" style={containerStyle}>
        <AppText className="text-sm text-muted text-center">
          This assessment is past due.
        </AppText>
      </View>
    );
  }

  if (state.kind === "resume") {
    return (
      <View className="p-4 bg-surface-secondary" style={containerStyle}>
        <Button variant="primary" onPress={onResume} isDisabled={starting}>
          <Button.Label>
            {starting ? "Resuming…" : "Resume attempt"}
          </Button.Label>
        </Button>
      </View>
    );
  }

  // state.kind === "start"
  const isLate = state.late === true;
  return (
    <View className="p-4 bg-surface-secondary" style={containerStyle}>
      {isLate ? (
        <AppText className="text-xs text-danger text-center mb-2">
          ⚠ Past due — submissions count as late
        </AppText>
      ) : null}
      <Button variant="primary" onPress={onStart} isDisabled={starting}>
        <Button.Label>
          {starting
            ? "Starting…"
            : `Start Assessment · ${formatDuration(timeDurationMinutes)}`}
        </Button.Label>
      </Button>
    </View>
  );
};
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors related to this file.

- [ ] **Step 3: Do NOT commit.**

---

## Task 6: Update `AssessmentAttempts.tsx` for new visuals and sort order

**Files:**
- Modify: `features/assessment/components/AssessmentAttempts.tsx` (replace entire file)

The redesign updates `AttemptCard` to:
- Sort attempts by `retakeNumber` descending (latest first).
- Show a left accent bar only on the ongoing attempt.
- Display status text (`In progress` / `Completed` / `Late submission` / capitalized raw status).
- Show a live `MM:SS left` countdown for ongoing, and `formatShortDate(lastHeartbeatAt)` for completed/late.
- Remove any per-attempt score display.
- Keep current tap-to-resume behavior for ongoing; completed rows are non-interactive (no results screen exists yet).

- [ ] **Step 1: Replace the file**

Replace the entire contents of `features/assessment/components/AssessmentAttempts.tsx` with:

```tsx
import { Pressable, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { AppText } from "@/components/AppText";
import { useAttemptRecords } from "../assessment.hooks";
import { Skeleton, Surface } from "heroui-native";
import { ErrorComponent } from "@/components/ErrorComponent";
import { formatShortDate } from "@/features/assessment/formatters";
import type { InferSelectModel } from "drizzle-orm";
import { attemptsTable } from "@/powersync/schema";

type AttemptRow = InferSelectModel<typeof attemptsTable>;

type AssessmentAttemptsProps = {
  studentActivityId: string;
  studentId: number;
};

const AssessmentAttempts = ({
  studentActivityId,
  studentId,
}: AssessmentAttemptsProps) => {
  const { data, isLoading, isError, error } = useAttemptRecords(
    studentActivityId,
    studentId,
  );

  const sorted = useMemo(
    () =>
      data
        ? [...data].sort((a, b) => b.retakeNumber - a.retakeNumber)
        : [],
    [data],
  );

  if (isLoading) return <AssessmentAttemptsSkeleton />;
  if (isError)
    return (
      <ErrorComponent message={error?.message ?? "Failed to load attempts"} />
    );

  if (sorted.length === 0) {
    return (
      <AppText className="text-sm text-muted">No attempts yet</AppText>
    );
  }

  return (
    <View className="gap-1.5">
      {sorted.map((item) => (
        <AttemptCard key={item.localId} item={item} />
      ))}
    </View>
  );
};

const computeRemaining = (willEndAt: string) => {
  const ms = new Date(willEndAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
};

const formatRemaining = (totalSeconds: number) =>
  `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;

const statusText = (status: string): string => {
  switch (status) {
    case "ongoing":
      return "In progress";
    case "submitted":
      return "Completed";
    case "late":
      return "Late submission";
    default:
      return status.length > 0
        ? status.charAt(0).toUpperCase() + status.slice(1)
        : status;
  }
};

const AttemptCard = ({ item }: { item: AttemptRow }) => {
  const router = useRouter();
  const isOngoing = item.status === "ongoing";

  const [remainingTime, setRemainingTime] = useState(() =>
    isOngoing ? computeRemaining(item.willEndAt) : 0,
  );

  useEffect(() => {
    if (!isOngoing) return;
    setRemainingTime(computeRemaining(item.willEndAt));
    const interval = setInterval(() => {
      setRemainingTime(computeRemaining(item.willEndAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOngoing, item.willEndAt]);

  const rightSide = isOngoing ? (
    <AppText
      weight="semibold"
      className={`text-sm ${remainingTime < 60 ? "text-danger" : "text-accent"}`}
    >
      {formatRemaining(remainingTime)} left
    </AppText>
  ) : (
    <AppText className="text-sm text-muted">
      {formatShortDate(item.lastHeartbeatAt)}
    </AppText>
  );

  const card = (
    <Surface
      variant={isOngoing ? "default" : "tertiary"}
      className={`rounded-xl shadow-none flex-row items-center justify-between px-3 py-3 ${
        isOngoing ? "border-l-4 border-l-accent" : ""
      }`}
    >
      <AppText weight="semibold" className="text-sm">
        Attempt {item.retakeNumber} · {statusText(item.status)}
      </AppText>
      {rightSide}
    </Surface>
  );

  if (isOngoing) {
    return (
      <Pressable
        onPress={() => router.push(`/attempt/${item.localId}`)}
        accessibilityRole="button"
        accessibilityLabel={`Resume attempt ${item.retakeNumber}`}
      >
        {card}
      </Pressable>
    );
  }
  return card;
};

const AssessmentAttemptsSkeleton = () => {
  return (
    <View className="gap-1.5">
      {Array(3)
        .fill(0)
        .map((_, index) => (
          <Surface
            key={index}
            variant="tertiary"
            className="rounded-xl shadow-none flex-row items-center justify-between px-3 py-3"
          >
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </Surface>
        ))}
    </View>
  );
};

export default AssessmentAttempts;
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors related to this file or its consumers.

- [ ] **Step 3: Do NOT commit.**

---

## Task 7: Refactor `AssessmentDetailsScreen.tsx` to use the new pieces

**Files:**
- Modify: `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx` (replace entire file)

This task wires the hero card, info rows, attempts list, and CTA bar together; derives the CTA state; updates the skeleton; and adds a `handleResume` callback. The existing `handleStart` body remains intact (no behavior change to the service calls).

- [ ] **Step 1: Replace the file**

Replace the entire contents of `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCourseAssessment } from "@/features/courses/courses.hooks";
import { AppText } from "@/components/AppText";
import useStore from "@/lib/store";
import Screen from "@/components/screen";
import { Skeleton, useToast } from "heroui-native";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  buildQuestionOrder,
  countAttempts,
  createAttempt,
  findStudentActivity,
} from "@/features/assessment/assessment.service";
import {
  useAssessmentDetails,
  useAttemptRecords,
  useQuestionCount,
} from "@/features/assessment/assessment.hooks";
import AssessmentAttempts from "@/features/assessment/components/AssessmentAttempts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AssessmentHeroCard } from "./details/AssessmentHeroCard";
import { AssessmentInfoRows } from "./details/AssessmentInfoRows";
import {
  AssessmentCtaBar,
  type CtaState,
} from "./details/AssessmentCtaBar";

const AssessmentDetailsScreen = () => {
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const { assessmentId } = useLocalSearchParams();
  const { authUser } = useStore();
  const { data, isLoading, isError, error } = useCourseAssessment(
    assessmentId as string,
  );
  const { data: studentAssessment } = useAssessmentDetails({
    userId: authUser?.id ?? 0,
    assessmentId: data?.id ?? "",
  });
  const { data: attempts } = useAttemptRecords(
    studentAssessment?.id ?? "",
    authUser?.id ?? 0,
  );
  const { data: questionCount } = useQuestionCount(data?.id);
  const [starting, setStarting] = useState(false);

  const ongoingAttempt = useMemo(
    () => attempts?.find((a) => a.status === "ongoing") ?? null,
    [attempts],
  );

  const ctaState: CtaState = useMemo(() => {
    if (!data) return { kind: "start" };
    if (ongoingAttempt) {
      return { kind: "resume" };
    }
    const used = attempts?.length ?? 0;
    if (used >= data.maxRetake) {
      return { kind: "max-reached", maxRetake: data.maxRetake };
    }
    const pastEnd = Date.now() > new Date(data.endTime).getTime();
    if (pastEnd && !data.allowLate) {
      return { kind: "past-due-blocked" };
    }
    if (pastEnd && data.allowLate) {
      return { kind: "start", late: true };
    }
    return { kind: "start" };
  }, [data, attempts, ongoingAttempt]);

  if (isLoading) return <AssessmentDetailsSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;
  if (!data)
    return (
      <NoDataFallback
        title="Assessment not found"
        description="The assessment you're looking for doesn't exist"
      />
    );

  const handleStart = async () => {
    if (starting) return;
    if (!authUser?.id) {
      toast.show({
        label: "Not signed in",
        description: "Please sign in to start an assessment.",
        variant: "danger",
      });
      return;
    }

    setStarting(true);
    try {
      const sa = await findStudentActivity({
        activityId: data.id,
        termId: data.termId,
        subjectId: data.subjectId,
        studentId: authUser.id,
      });
      if (!sa) {
        toast.show({
          label: "Assessment not ready",
          description:
            "This assessment isn't available yet. Please pull to refresh and try again.",
          variant: "danger",
        });
        return;
      }

      const total = await countAttempts({
        studentActivityId: sa.id,
        studentId: authUser.id,
        activityId: sa.activityId,
      });
      if (total >= data.maxRetake) {
        toast.show({
          label: "Max retakes reached",
          description: `You've used ${total} of ${data.maxRetake} attempts.`,
          variant: "danger",
        });
        return;
      }

      const questionOrder = await buildQuestionOrder(
        sa.activityId,
        data.shuffleQuestions,
      );
      if (questionOrder.length === 0) {
        toast.show({
          label: "Questions not ready",
          description: "Pull to refresh and try again in a moment.",
          variant: "danger",
        });
        return;
      }

      const retakeNumber = total + 1;

      const attempt = await createAttempt({
        studentActivityId: sa.id,
        studentId: authUser.id,
        activityId: sa.activityId,
        retakeNumber,
        duration: data.timeDuration * 60,
        questionOrder,
      });

      router.push({
        pathname: "/(main)/attempt/[attemptId]",
        params: { attemptId: attempt.localId },
      });
    } catch (err) {
      console.error("[AssessmentDetailsScreen] Failed to start attempt:", err);
      toast.show({
        label: "Failed to start",
        description: "Please try again.",
        variant: "danger",
      });
    } finally {
      setStarting(false);
    }
  };

  const handleResume = () => {
    if (!ongoingAttempt) return;
    router.push({
      pathname: "/(main)/attempt/[attemptId]",
      params: { attemptId: ongoingAttempt.localId },
    });
  };

  const bestScore =
    studentAssessment && data.showScore && (attempts?.some((a) => a.status === "submitted") ?? false)
      ? studentAssessment.totalScore
      : null;

  return (
    <Screen className="max-w-3xl mx-auto w-full pb-2.5 ">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-4 p-4">
          <AssessmentHeroCard
            activityName={data.activityName}
            endTime={data.endTime}
            questionCount={questionCount}
            timeDurationMinutes={data.timeDuration}
            attemptsUsed={attempts?.length}
            maxRetake={data.maxRetake}
          />

          <AssessmentInfoRows
            passingScore={data.passingScore}
            passingScoreType={data.passingScoreType}
            maxScore={data.maxScore}
            retakeMethod={data.retakeMethod}
            isGraded={data.isGraded}
            showScore={data.showScore}
            bestScore={bestScore}
            fileInstructionUrl={data.activityFileInstruction || null}
            onOpenFileInstruction={undefined}
          />

          {studentAssessment && authUser?.id ? (
            <View>
              <AppText
                weight="semibold"
                className="text-base mb-2"
              >
                Previous attempts
              </AppText>
              <AssessmentAttempts
                studentActivityId={studentAssessment.id}
                studentId={authUser.id}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <AssessmentCtaBar
        state={ctaState}
        starting={starting}
        timeDurationMinutes={data.timeDuration}
        onStart={handleStart}
        onResume={handleResume}
        bottomInset={insets.bottom}
      />
    </Screen>
  );
};

const AssessmentDetailsSkeleton = () => (
  <Screen className="max-w-3xl mx-auto w-full pb-2.5">
    <View className="gap-4 p-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <View className="gap-2">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <View key={i} className="flex-row justify-between py-2">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </View>
          ))}
      </View>
      <View className="gap-2">
        <Skeleton className="h-4 w-32 rounded-full" />
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
      </View>
    </View>
  </Screen>
);

export default AssessmentDetailsScreen;
```

Note on `onOpenFileInstruction`: passed as `undefined` for now. When the file-instruction download flow lands, wire this to the existing attachment-open path; the info-row already renders the Download label and is tappable via a Pressable wrapper.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no NEW errors. Confirm that the `attempts` field types (`status`, `retakeNumber`, `willEndAt`, `lastHeartbeatAt`, `localId`) align with what `AssessmentAttempts.tsx` expects; if a type narrowing complains, cast at the call site rather than changing the schema.

- [ ] **Step 3: Manual smoke test on a device or simulator**

For each scenario below, verify the indicated outcome:

1. **Fresh assessment, no attempts.**
   - Hero shows `Questions / Time / 3 / 3`.
   - Info rows show: Passing score, Retake method, Graded, Score visibility (no Best score row).
   - Attempts section shows "No attempts yet".
   - CTA bar: `Start Assessment · <duration>`.

2. **One ongoing attempt.**
   - Top attempt row has accent left bar and `MM:SS left`.
   - CTA bar flips to `Resume attempt`.
   - Tapping `Resume attempt` routes to `/(main)/attempt/<localId>`.

3. **Two completed, one slot left, `showScore` true, `studentAssessment.totalScore` populated.**
   - Hero shows `1 / 3` in the third stat.
   - "Best score" row appears in info rows with `<totalScore> / <maxScore>`.
   - Attempts list shows two rows: `Attempt 2 · Completed` (most recent first) and `Attempt 1 · Completed`, each with submit date on the right.
   - CTA bar: `Start Assessment · <duration>`.

4. **Max retakes reached.**
   - CTA bar replaced with caption: `You've used all <maxRetake> attempts.`
   - No button.

5. **Past due, `!allowLate`.**
   - CTA bar replaced with caption: `This assessment is past due.`
   - No button.

6. **Past due, `allowLate` true.**
   - Small caption above the button: `⚠ Past due — submissions count as late`.
   - Button still shows `Start Assessment · <duration>`.

7. **`activityFileInstruction` set (any non-empty string).**
   - File instructions row appears with the Paperclip icon and "Download" label.
   - Row is tappable (no handler yet — confirm the press feedback works; the action will be wired later).

8. **Light/dark theme toggle.**
   - Hero accent + foreground readable in both themes; no raw hex bleeding through.

9. **Loading.**
   - Skeleton matches the new layout: hero block + 4 info rows + section header + 3 attempt rows.

10. **`pnpm typecheck` runs clean.**

- [ ] **Step 4: Do NOT commit.**

---

## Final Verification

- [ ] **Full project typecheck:** `pnpm typecheck` exits with no NEW errors compared to the pre-existing baseline in unrelated files.
- [ ] **Spot-check the screen on a device** by walking through the smoke scenarios in Task 7 Step 3.
- [ ] **Confirm the public route is unchanged:** opening an assessment from the course timeline still lands on this screen, and tapping Start still navigates to `/(main)/attempt/[attemptId]`.
