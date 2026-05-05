# Take Assessment — Gap-Closing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the visible gaps in the existing student "take assessment" flow without changing schema or rewriting the timer/heartbeat session.

**Architecture:** In-place edits to `features/assessment/` and the related screens, plus a targeted extraction of the per-type question renderers into `features/assessment/components/questions/` because the MC renderer is being rewritten and the existing 730-line `QuestionList.tsx` is hard to navigate. New service helpers (`getChoicesForActivity`, `getOngoingAttempt`, `finalizeAttempt`) and matching hooks. UI changes wire a manual Submit on the last question, a back-confirm on the attempt screen, and Resume-vs-Start branching for stale ongoing attempts. The `useAttemptSession` model is preserved as the single source of truth for elapsed time; `AssessmentAttempts` is realigned to read from the same model.

**Tech Stack:** React Native + Expo Router, PowerSync + Drizzle (sqlite), HeroUI Native (Dialog, Button, useToast), `@powersync/tanstack-react-query`.

**Testing note (read this before starting):** This codebase has no test framework wired for the assessment area — there are no `*.test.ts` files in `features/assessment/`. Each task ends with a **manual verification** step followed by a commit. Do **not** add a test framework as part of this work; that is out of scope per the spec. If you discover a regression during a manual step, fix it before committing.

**Spec:** `docs/superpowers/specs/2026-05-05-take-assessment-design.md`

---

## File map

```
features/assessment/
├── assessment.service.ts             EDIT (Task 1)
├── assessment.hooks.ts               EDIT (Task 2)
├── components/
│   ├── QuestionList.tsx              EDIT (Task 5)
│   ├── AssessmentAttempts.tsx        EDIT (Task 8)
│   ├── AssessmentResult.tsx          NO CHANGE
│   └── questions/                    NEW (Task 4)
│       ├── index.tsx
│       ├── types.ts
│       ├── MultipleChoiceQuestion.tsx
│       ├── EssayQuestion.tsx
│       ├── TrueFalseQuestion.tsx
│       ├── FillInTheBlankQuestion.tsx
│       ├── MatchingQuestion.tsx
│       ├── NumericQuestion.tsx
│       └── ImageBasedQuestion.tsx

screens/main/courses/course/assessment/
├── AssessmentDetailsScreen.tsx       EDIT (Task 7)
└── AttemptScreen.tsx                 EDIT (Task 6)

hooks/
├── useAttemptSession.ts              EDIT (Task 3 — single-line callsite swap)
└── useAssessmentTimer.ts             NO CHANGE
```

---

## Task 1: Service helpers — `getChoicesForActivity`, `getOngoingAttempt`, `finalizeAttempt`

**Files:**
- Modify: `features/assessment/assessment.service.ts`

- [ ] **Step 1: Add the three new service functions at the bottom of the file**

Append to `features/assessment/assessment.service.ts` (after `submitAttempt`):

```ts
export const getChoicesForActivity = (activityId: number) => {
  return db.query.assessmentQuestionsTable.findMany({
    where: (t, { eq }) => eq(t.activityId, activityId),
    orderBy: (t, { asc }) => [asc(t.id)],
  });
};

export const getOngoingAttempt = (
  studentActivityId: number,
  studentId: number,
) => {
  return db.query.attemptsTable.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.studentActivityId, studentActivityId),
        eq(t.studentId, studentId),
        eq(t.status, "ongoing"),
      ),
  });
};

export const finalizeAttempt = (attemptLocalId: string) => {
  return db
    .update(attemptsTable)
    .set({
      status: "completed",
      lastHeartbeatAt: new Date().toISOString(),
    })
    .where(eq(attemptsTable.localId, attemptLocalId));
};
```

- [ ] **Step 2: Replace `submitAttempt` with `finalizeAttempt`**

`submitAttempt` is the old API that hardcoded `score: 0`. The spec says manual + auto submit take the same path with no scoring (decision Q3.C). Delete `submitAttempt` from `features/assessment/assessment.service.ts`:

```ts
// DELETE this block from features/assessment/assessment.service.ts
export const submitAttempt = async (attemptLocalId: string, score: number) => {
  return db
    .update(attemptsTable)
    .set({
      status: "completed",
      score,
      lastHeartbeatAt: new Date().toISOString(),
    })
    .where(eq(attemptsTable.localId, attemptLocalId));
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: passes (one expected error from `useAttemptSession.ts` referencing the deleted `submitAttempt` — this is fixed in Task 3). If you see any other errors, fix them before continuing.

- [ ] **Step 4: Commit**

```bash
git add features/assessment/assessment.service.ts
git commit -m "feat(assessment): add getChoicesForActivity, getOngoingAttempt, finalizeAttempt service helpers"
```

---

## Task 2: Hooks — `useChoicesForActivity`, `useOngoingAttempt`

**Files:**
- Modify: `features/assessment/assessment.hooks.ts`

- [ ] **Step 1: Update the import block at the top of `assessment.hooks.ts`**

Replace the existing import in `features/assessment/assessment.hooks.ts:1-9` with:

```ts
import { useQuery } from "@powersync/tanstack-react-query";
import {
  getAssessmentAttempt,
  getAssessmentDetails,
  getAttemptRecords,
  getQuestions,
  getOrderedQuestions,
  getAnswersForAttempt,
  getChoicesForActivity,
  getOngoingAttempt,
} from "./assessment.service";
```

- [ ] **Step 2: Append the two new hooks at the bottom of `assessment.hooks.ts`**

```ts
export const useChoicesForActivity = (activityId: number) => {
  return useQuery({
    queryKey: ["activity-choices", activityId],
    queryFn: () => getChoicesForActivity(activityId),
    enabled: !!activityId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useOngoingAttempt = (
  studentActivityId?: number,
  studentId?: number,
) => {
  return useQuery({
    queryKey: ["ongoing-attempt", studentActivityId, studentId],
    queryFn: () => getOngoingAttempt(studentActivityId!, studentId!),
    enabled: !!studentActivityId && !!studentId,
    staleTime: 0,
    refetchOnMount: true,
  });
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: passes (the `useAttemptSession` error from Task 1 is still present; everything else clean).

- [ ] **Step 4: Commit**

```bash
git add features/assessment/assessment.hooks.ts
git commit -m "feat(assessment): add useChoicesForActivity and useOngoingAttempt hooks"
```

---

## Task 3: Wire `useAttemptSession` to `finalizeAttempt`

**Files:**
- Modify: `hooks/useAttemptSession.ts:6` (import) and `hooks/useAttemptSession.ts:71` (call)

- [ ] **Step 1: Swap the import**

In `hooks/useAttemptSession.ts:3-8`, change:

```ts
import {
  updateHeartbeat,
  updateLastIndex,
  submitAttempt,
} from "@/features/assessment/assessment.service";
```

to:

```ts
import {
  updateHeartbeat,
  updateLastIndex,
  finalizeAttempt,
} from "@/features/assessment/assessment.service";
```

- [ ] **Step 2: Update the call inside `handleAutoSubmit`**

In `hooks/useAttemptSession.ts:65-77`, change the body of `handleAutoSubmit`:

```ts
const handleAutoSubmit = useCallback(async () => {
  if (!attempt || isSubmittingRef.current) return;
  isSubmittingRef.current = true;

  try {
    await updateHeartbeat(attempt.localId, elapsedRef.current);
    await finalizeAttempt(attempt.localId);
    onAutoSubmit();
  } catch (err) {
    console.error("[AttemptSession] Auto-submit failed:", err);
    isSubmittingRef.current = false;
  }
}, [attempt?.localId, onAutoSubmit]);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: passes cleanly now (no more `submitAttempt` references).

- [ ] **Step 4: Commit**

```bash
git add hooks/useAttemptSession.ts
git commit -m "refactor(assessment): switch auto-submit to finalizeAttempt"
```

---

## Task 4: Extract per-type question renderers

This task moves the existing renderers from `QuestionList.tsx` into their own files **mostly verbatim** (`EssayQuestion`, `TrueFalseQuestion`, `FillInTheBlankQuestion`, `MatchingQuestion`, `NumericQuestion`, `ImageBasedQuestion`) and **rewrites** `MultipleChoiceQuestion` to use real choices from `activity_questionchoice`.

The renderers all share `styles` from `QuestionList.tsx`. To avoid duplicating the StyleSheet, this task moves the relevant styles into the new `questions/` folder and references them from there. After Task 5, `QuestionList.tsx` keeps only its own stepper/nav styles.

**Files:**
- Create: `features/assessment/components/questions/types.ts`
- Create: `features/assessment/components/questions/styles.ts`
- Create: `features/assessment/components/questions/MultipleChoiceQuestion.tsx`
- Create: `features/assessment/components/questions/EssayQuestion.tsx`
- Create: `features/assessment/components/questions/TrueFalseQuestion.tsx`
- Create: `features/assessment/components/questions/FillInTheBlankQuestion.tsx`
- Create: `features/assessment/components/questions/MatchingQuestion.tsx`
- Create: `features/assessment/components/questions/NumericQuestion.tsx`
- Create: `features/assessment/components/questions/ImageBasedQuestion.tsx`
- Create: `features/assessment/components/questions/index.tsx`

- [ ] **Step 1: Create shared types**

Create `features/assessment/components/questions/types.ts`:

```ts
export interface Question {
  id: number;
  activityId: number;
  questionText: string;
  questionInstruction: string;
  quizTypeId: number;
  score: number;
  correctAnswer: string;
  subjectId: number;
}

export interface Choice {
  id: number;
  activityId: number;
  questionId: number;
  choiceText: string;
  isLeftSide: string;
}

export interface QuestionComponentProps {
  question: Question;
  currentAnswer: string;
  onAnswer: (questionId: number, answer: string) => void;
  disabled: boolean;
}

export interface MultipleChoiceProps extends QuestionComponentProps {
  choices: Choice[];
}
```

- [ ] **Step 2: Create the shared StyleSheet**

Create `features/assessment/components/questions/styles.ts`:

```ts
import { StyleSheet } from "react-native";

export const questionStyles = StyleSheet.create({
  questionContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  scoreText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
    fontStyle: "italic",
  },
  optionButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  selectedOptionText: {
    color: "#fff",
  },
  trueFalseContainer: {
    flexDirection: "row",
    gap: 12,
  },
  trueFalseButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    alignItems: "center",
  },
  essayInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    minHeight: 100,
    textAlignVertical: "top",
  },
  fillBlankInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
  },
  questionImage: {
    width: "100%",
    height: 200,
    marginBottom: 12,
    borderRadius: 6,
  },
  emptyChoices: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
    marginTop: 8,
  },
});
```

- [ ] **Step 3: Create `MultipleChoiceQuestion` (rewritten with real choices)**

Create `features/assessment/components/questions/MultipleChoiceQuestion.tsx`:

```tsx
import { View, TouchableOpacity } from "react-native";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { MultipleChoiceProps } from "./types";

const MultipleChoiceQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
  choices,
}: MultipleChoiceProps) => {
  const questionChoices = choices.filter((c) => c.questionId === question.id);

  if (questionChoices.length === 0) {
    return (
      <View style={styles.questionContainer}>
        <AppText style={styles.questionText}>{question.questionText}</AppText>
        <AppText style={styles.scoreText}>Score: {question.score}</AppText>
        <AppText style={styles.emptyChoices}>No choices configured</AppText>
      </View>
    );
  }

  const handleSelect = (choiceId: number) => {
    if (disabled) return;
    onAnswer(question.id, String(choiceId));
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      {questionChoices.map((choice) => {
        const selected = currentAnswer === String(choice.id);
        return (
          <TouchableOpacity
            key={choice.id}
            style={[styles.optionButton, selected && styles.selectedOption]}
            onPress={() => handleSelect(choice.id)}
            disabled={disabled}
          >
            <AppText style={selected ? styles.selectedOptionText : undefined}>
              {choice.choiceText}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default MultipleChoiceQuestion;
```

- [ ] **Step 4: Create `EssayQuestion`**

Create `features/assessment/components/questions/EssayQuestion.tsx`:

```tsx
import { View, TextInput } from "react-native";
import { useState, useEffect } from "react";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const EssayQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <TextInput
        style={styles.essayInput}
        multiline
        numberOfLines={6}
        placeholder="Type your answer here..."
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

export default EssayQuestion;
```

- [ ] **Step 5: Create `TrueFalseQuestion`**

Create `features/assessment/components/questions/TrueFalseQuestion.tsx`:

```tsx
import { View, TouchableOpacity } from "react-native";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const TrueFalseQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const handleSelect = (value: string) => {
    if (disabled) return;
    onAnswer(question.id, value);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <View style={styles.trueFalseContainer}>
        <TouchableOpacity
          style={[
            styles.trueFalseButton,
            currentAnswer === "True" && styles.selectedOption,
          ]}
          onPress={() => handleSelect("True")}
          disabled={disabled}
        >
          <AppText
            style={
              currentAnswer === "True" ? styles.selectedOptionText : undefined
            }
          >
            True
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.trueFalseButton,
            currentAnswer === "False" && styles.selectedOption,
          ]}
          onPress={() => handleSelect("False")}
          disabled={disabled}
        >
          <AppText
            style={
              currentAnswer === "False" ? styles.selectedOptionText : undefined
            }
          >
            False
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TrueFalseQuestion;
```

- [ ] **Step 6: Create `FillInTheBlankQuestion`**

Create `features/assessment/components/questions/FillInTheBlankQuestion.tsx`:

```tsx
import { View, TextInput } from "react-native";
import { useState, useEffect } from "react";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const FillInTheBlankQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <TextInput
        style={styles.fillBlankInput}
        placeholder="Fill in the blank..."
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

export default FillInTheBlankQuestion;
```

- [ ] **Step 7: Create `MatchingQuestion`**

Create `features/assessment/components/questions/MatchingQuestion.tsx`:

```tsx
import { View, TextInput } from "react-native";
import { useState, useEffect } from "react";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const MatchingQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <AppText style={styles.instructionText}>
        Format: "1 -&gt; 2" (match items)
      </AppText>
      <TextInput
        style={styles.fillBlankInput}
        placeholder="e.g., 1 -> 2"
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

export default MatchingQuestion;
```

- [ ] **Step 8: Create `NumericQuestion`**

Create `features/assessment/components/questions/NumericQuestion.tsx`:

```tsx
import { View, TextInput } from "react-native";
import { useState, useEffect } from "react";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const NumericQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <TextInput
        style={styles.fillBlankInput}
        placeholder="Enter numeric answer..."
        keyboardType="numeric"
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

export default NumericQuestion;
```

- [ ] **Step 9: Create `ImageBasedQuestion`**

Create `features/assessment/components/questions/ImageBasedQuestion.tsx`:

```tsx
import { View, TextInput, Image } from "react-native";
import { useState, useEffect } from "react";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const ImageBasedQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      {question.questionInstruction && (
        <Image
          source={{ uri: question.questionInstruction }}
          style={styles.questionImage}
          resizeMode="contain"
        />
      )}
      <TextInput
        style={styles.essayInput}
        multiline
        numberOfLines={4}
        placeholder="Type your answer based on the image..."
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

export default ImageBasedQuestion;
```

- [ ] **Step 10: Create the renderer index/switch**

Create `features/assessment/components/questions/index.tsx`:

```tsx
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion";
import EssayQuestion from "./EssayQuestion";
import TrueFalseQuestion from "./TrueFalseQuestion";
import FillInTheBlankQuestion from "./FillInTheBlankQuestion";
import MatchingQuestion from "./MatchingQuestion";
import NumericQuestion from "./NumericQuestion";
import ImageBasedQuestion from "./ImageBasedQuestion";
import { questionStyles as styles } from "./styles";
import type { Choice, QuestionComponentProps } from "./types";

export type { Choice, Question, QuestionComponentProps } from "./types";

interface QuestionRendererProps extends QuestionComponentProps {
  choices: Choice[];
}

export const QuestionRenderer = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
  choices,
}: QuestionRendererProps) => {
  switch (question.quizTypeId) {
    case 1:
      return (
        <MultipleChoiceQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
          choices={choices}
        />
      );
    case 2:
      return (
        <EssayQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 3:
      return (
        <TrueFalseQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 4:
      return (
        <FillInTheBlankQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 5:
      return (
        <MatchingQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 6:
      return (
        <NumericQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 7:
      return (
        <ImageBasedQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    default:
      return (
        <View style={styles.questionContainer}>
          <AppText>Unknown question type</AppText>
        </View>
      );
  }
};
```

- [ ] **Step 11: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: passes (the old `QuestionList.tsx` still compiles too because we haven't touched it yet — Task 5 cleans that up).

- [ ] **Step 12: Commit**

```bash
git add features/assessment/components/questions
git commit -m "refactor(assessment): extract question renderers; rewrite MC with real choices"
```

---

## Task 5: Slim down `QuestionList.tsx` — batched choices, manual Submit, confirm dialog

**Files:**
- Modify (full rewrite): `features/assessment/components/QuestionList.tsx`

The new file uses the extracted `QuestionRenderer` from Task 4, fetches choices once via `useChoicesForActivity`, and adds a Submit button that shows a confirm dialog on the last question.

- [ ] **Step 1: Replace the entire contents of `features/assessment/components/QuestionList.tsx`**

```tsx
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import {
  useGetOrderedQuestions,
  useGetAnswersForAttempt,
  useChoicesForActivity,
} from "../assessment.hooks";
import { saveAnswer } from "../assessment.service";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import EmptyState from "@/components/EmptyState";
import { Skeleton, Button, Dialog } from "heroui-native";
import { QuestionRenderer } from "./questions";

type QuestionListProps = {
  activityId: number;
  attemptId: string;
  retakeRecordId: string;
  studentId: number;
  questionOrder: number[];
  initialIndex: number;
  onIndexChange: (index: number) => void;
  isTimeUp: boolean;
  onSubmit: () => void;
};

const QuestionList = ({
  activityId,
  attemptId,
  retakeRecordId,
  studentId,
  questionOrder,
  initialIndex,
  onIndexChange,
  isTimeUp,
  onSubmit,
}: QuestionListProps) => {
  const {
    data: questions,
    isLoading,
    isError,
    error,
  } = useGetOrderedQuestions(activityId, questionOrder);

  const { data: existingAnswers } = useGetAnswersForAttempt(attemptId);
  const { data: choices = [] } = useChoicesForActivity(activityId);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(initialIndex);
  const [submitOpen, setSubmitOpen] = useState(false);

  // Populate answers from existing records on load / re-entry
  useEffect(() => {
    if (!existingAnswers) return;
    const restored: Record<number, string> = {};
    for (const a of existingAnswers) {
      restored[a.activityQuestionId] = a.studentAnswer;
    }
    setAnswers(restored);
  }, [existingAnswers]);

  const handleAnswer = useCallback(
    (questionId: number, answer: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      saveAnswer(retakeRecordId, questionId, studentId, answer).catch((err) =>
        console.error("[QuestionList] Failed to save answer:", err),
      );
    },
    [retakeRecordId, studentId],
  );

  const handleNextPage = () => {
    if (questions && currentPage < questions.length - 1) {
      const next = currentPage + 1;
      setCurrentPage(next);
      onIndexChange(next);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      onIndexChange(prev);
    }
  };

  const handleSubmitConfirm = () => {
    setSubmitOpen(false);
    onSubmit();
  };

  if (isLoading) return <QuestionListSkeleton />;

  if (isError)
    return (
      <ErrorFallback message={error?.message ?? "Failed to load questions"} />
    );

  if (!questions || questions.length === 0) {
    return (
      <EmptyState
        icon="ClipboardTextIcon"
        title="No questions available"
        description="This assessment has no questions yet"
      />
    );
  }

  const currentQuestion = questions[currentPage];
  const totalQuestions = questions.length;
  const isLastQuestion = currentPage === totalQuestions - 1;

  return (
    <View style={styles.paginationContainer}>
      {isTimeUp && (
        <View style={styles.timeUpBanner}>
          <AppText style={styles.timeUpText}>Time is up! Submitting...</AppText>
        </View>
      )}
      <ScrollView
        style={styles.questionScrollView}
        pointerEvents={isTimeUp ? "none" : "auto"}
      >
        <View style={styles.currentQuestionContainer}>
          <AppText style={styles.questionNumber}>
            Question {currentPage + 1} of {totalQuestions}
          </AppText>
          <QuestionRenderer
            question={currentQuestion}
            currentAnswer={answers[currentQuestion.id] ?? ""}
            onAnswer={handleAnswer}
            disabled={isTimeUp}
            choices={choices}
          />
        </View>
      </ScrollView>

      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[
            styles.navButton,
            (currentPage === 0 || isTimeUp) && styles.navButtonDisabled,
          ]}
          onPress={handlePreviousPage}
          disabled={currentPage === 0 || isTimeUp}
        >
          <AppText
            style={[
              styles.navButtonText,
              (currentPage === 0 || isTimeUp) && styles.navButtonTextDisabled,
            ]}
          >
            Previous
          </AppText>
        </TouchableOpacity>

        {isLastQuestion ? (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.submitButton,
              isTimeUp && styles.navButtonDisabled,
            ]}
            onPress={() => setSubmitOpen(true)}
            disabled={isTimeUp}
          >
            <AppText
              style={[
                styles.navButtonText,
                isTimeUp && styles.navButtonTextDisabled,
              ]}
            >
              Submit
            </AppText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, isTimeUp && styles.navButtonDisabled]}
            onPress={handleNextPage}
            disabled={isTimeUp}
          >
            <AppText
              style={[
                styles.navButtonText,
                isTimeUp && styles.navButtonTextDisabled,
              ]}
            >
              Next
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      <Dialog isOpen={submitOpen} onOpenChange={setSubmitOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <View className="mb-5 gap-1.5">
              <Dialog.Title>Submit assessment?</Dialog.Title>
              <Dialog.Description>
                Once submitted, you can't change your answers.
              </Dialog.Description>
            </View>
            <View className="flex-row justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setSubmitOpen(false)}
              >
                <Button.Label>Cancel</Button.Label>
              </Button>
              <Button size="sm" onPress={handleSubmitConfirm}>
                <Button.Label>Submit</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
};

const styles = StyleSheet.create({
  paginationContainer: {
    flex: 1,
  },
  questionScrollView: {
    flex: 1,
  },
  currentQuestionContainer: {
    padding: 16,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  navigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 12,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: "#34C759",
  },
  navButtonDisabled: {
    backgroundColor: "#e0e0e0",
  },
  navButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  navButtonTextDisabled: {
    color: "#999",
  },
  timeUpBanner: {
    backgroundColor: "#FF3B30",
    padding: 12,
    alignItems: "center",
  },
  timeUpText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});

const QuestionListSkeleton = () => {
  return (
    <View style={styles.paginationContainer}>
      <View style={styles.currentQuestionContainer}>
        <Skeleton className="h-6 w-40 rounded mb-3" />
        <View
          style={{
            backgroundColor: "#fff",
            padding: 16,
            borderRadius: 8,
          }}
        >
          <Skeleton className="h-5 w-full rounded mb-2" />
          <Skeleton className="h-3 w-20 rounded mb-3" />
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-md mb-2" />
            ))}
        </View>
      </View>
      <View style={styles.navigationContainer}>
        <Skeleton className="h-12 w-24 rounded-lg" />
        <Skeleton className="h-12 w-24 rounded-lg" />
      </View>
    </View>
  );
};

export default QuestionList;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: passes. Note: `AttemptScreen` will produce one type error because `QuestionList` now requires `onSubmit`. That's fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add features/assessment/components/QuestionList.tsx
git commit -m "feat(assessment): wire batched choices and manual Submit to QuestionList"
```

---

## Task 6: `AttemptScreen` — wire `onSubmit`, header back-confirm, hardware back, disable iOS swipe

**Files:**
- Modify: `screens/main/courses/course/assessment/AttemptScreen.tsx`

This task replaces the file in full. The header is overridden with a custom back button that opens a confirm dialog. The Android hardware back is intercepted with `useFocusEffect` + `BackHandler`. iOS swipe-back is disabled via `gestureEnabled: false`. The Submit handler runs `finalizeAttempt` then `router.replace`.

- [ ] **Step 1: Replace the entire contents of `screens/main/courses/course/assessment/AttemptScreen.tsx`**

```tsx
import { View, BackHandler, Pressable, Platform } from "react-native";
import { useEffect, useCallback, useState } from "react";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { useGetAssessmentAttempt } from "@/features/assessment/assessment.hooks";
import { useAssessmentTimer } from "@/hooks/useAssessmentTimer";
import { useAttemptSession } from "@/hooks/useAttemptSession";
import { finalizeAttempt } from "@/features/assessment/assessment.service";
import QuestionList from "@/features/assessment/components/QuestionList";
import useStore from "@/lib/store";
import { Skeleton, Dialog, Button, useToast } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

const AttemptScreen = () => {
  const { attemptId } = useLocalSearchParams();
  const { authUser } = useStore();
  const { toast } = useToast();
  const {
    data: attempt,
    isLoading,
    isError,
  } = useGetAssessmentAttempt(attemptId as string);
  const navigation = useNavigation();

  const [exitOpen, setExitOpen] = useState(false);

  const routeBack = useCallback(() => {
    router.replace({
      pathname: "/(main)/assessment/[assessmentId]",
      params: { assessmentId: String(attempt?.activityId) },
    });
  }, [attempt?.activityId]);

  const { saveLastIndex, elapsedRef } = useAttemptSession({
    attempt: attempt ?? null,
    onAutoSubmit: routeBack,
  });

  const { formattedTime, remainingTime } = useAssessmentTimer(
    attempt?.duration || 0,
    elapsedRef,
  );

  const handleSubmit = useCallback(async () => {
    if (!attempt) return;
    try {
      await finalizeAttempt(attempt.localId);
      routeBack();
    } catch (err) {
      console.error("[AttemptScreen] Submit failed:", err);
      toast.show({
        label: "Submit failed",
        description: "Please try again.",
        variant: "danger",
      });
    }
  }, [attempt, routeBack, toast]);

  // Disable iOS swipe-back; render custom headerLeft and live timer.
  useEffect(() => {
    if (!attempt || isLoading) return;

    navigation.setOptions({
      gestureEnabled: false,
      headerTitle: formattedTime,
      headerTitleAlign: "center",
      headerTitleStyle: {
        color: remainingTime < 60 ? "red" : "black",
        fontWeight: "700",
      },
      headerLeft: ({ tintColor }: { tintColor?: string }) => (
        <Pressable
          className="w-9 h-9 rounded-full flex justify-center items-center"
          onPress={() => setExitOpen(true)}
        >
          <Icon
            name="ArrowLeftIcon"
            color={tintColor as string}
            style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
          />
        </Pressable>
      ),
    });
  }, [formattedTime, remainingTime, navigation, attempt, isLoading]);

  // Intercept Android hardware back
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        setExitOpen(true);
        return true; // we handle it
      });
      return () => sub.remove();
    }, []),
  );

  if (isLoading) return <AttemptScreenSkeleton />;
  if (isError || !attempt)
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Skeleton className="h-5 w-48 rounded-full" />
      </View>
    );

  const questionOrder: number[] = attempt.questionOrder
    ? JSON.parse(attempt.questionOrder)
    : [];

  return (
    <View style={{ flex: 1 }}>
      <QuestionList
        activityId={attempt.activityId}
        attemptId={attempt.localId}
        retakeRecordId={attempt.id}
        studentId={authUser?.id!}
        questionOrder={questionOrder}
        initialIndex={attempt.lastIndex}
        onIndexChange={saveLastIndex}
        isTimeUp={
          attempt.duration > 0 && elapsedRef.current >= attempt.duration
        }
        onSubmit={handleSubmit}
      />

      <Dialog isOpen={exitOpen} onOpenChange={setExitOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <View className="mb-5 gap-1.5">
              <Dialog.Title>Leave this attempt?</Dialog.Title>
              <Dialog.Description>
                Your timer keeps running while you're away.
              </Dialog.Description>
            </View>
            <View className="flex-row justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setExitOpen(false)}
              >
                <Button.Label>Stay</Button.Label>
              </Button>
              <Button
                size="sm"
                onPress={() => {
                  setExitOpen(false);
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    routeBack();
                  }
                }}
              >
                <Button.Label>Leave</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
};

const AttemptScreenSkeleton = () => (
  <View style={{ flex: 1, padding: 16 }} className="gap-6">
    <View className="gap-3">
      <Skeleton className="h-4 w-20 rounded-full" />
      <Skeleton className="h-6 w-full rounded-full" />
      <Skeleton className="h-3 w-full rounded-full" />
      <Skeleton className="h-3 w-3/4 rounded-full" />
    </View>
    <View className="gap-3">
      {Array(4)
        .fill(0)
        .map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
    </View>
    <Skeleton className="h-12 w-full rounded-full mt-auto" />
  </View>
);

export default AttemptScreen;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add screens/main/courses/course/assessment/AttemptScreen.tsx
git commit -m "feat(assessment): manual submit + back-confirm on attempt screen"
```

---

## Task 7: `AssessmentDetailsScreen` — Resume vs Start, completed-only retake count

**Files:**
- Modify: `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx`

- [ ] **Step 1: Update imports**

In `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx:6-9`, replace the `assessment.hooks` import with:

```ts
import {
  useAssessmentDetails,
  useAttemptRecords,
  useOngoingAttempt,
} from "@/features/assessment/assessment.hooks";
```

- [ ] **Step 2: Add the `useOngoingAttempt` query and update the retake count**

In `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx`, immediately after the existing `useAttemptRecords` call (around line 40-43), add:

```ts
const { data: ongoingAttempt } = useOngoingAttempt(
  assessmentData?.id,
  authUser?.id,
);
```

And replace the existing `maxRetakesReached` line near the bottom of the component:

```ts
const completedAttempts = (assessmentAttempts ?? []).filter(
  (a) => a.status === "completed",
).length;
const maxRetakesReached = completedAttempts >= data.maxRetake;
```

- [ ] **Step 3: Update the existing `handleStartAssessment` to also use completed-only count**

In the same file, replace the existing maximum-retake guard inside `handleStartAssessment` (currently at `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx:75-77`):

```ts
const completedExisting = existingAttempts.filter(
  (a) => a.status === "completed",
).length;
if (completedExisting >= data.maxRetake) {
  throw new Error("Maximum number of retakes reached");
}
```

- [ ] **Step 4: Add a `handleResumeAttempt` and switch the bottom button**

Just before the `return (` in the component, add:

```ts
const handleResumeAttempt = () => {
  if (!ongoingAttempt) return;
  router.replace({
    pathname: "/(main)/attempt/[attemptId]",
    params: { attemptId: ongoingAttempt.localId },
  });
};
```

Then replace the existing bottom-button block (currently at `screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx:170-179`) with:

```tsx
{(!maxRetakesReached || ongoingAttempt) && (
  <View
    className="p-4 bg-surface-secondary"
    style={{ paddingBottom: Math.max(insets.bottom, 16) }}
  >
    {ongoingAttempt ? (
      <Button onPress={handleResumeAttempt}>
        <Button.Label>Resume Attempt</Button.Label>
      </Button>
    ) : (
      <Button isDisabled={disableButton} onPress={handleStartAssessment}>
        <Button.Label>Start Assessment</Button.Label>
      </Button>
    )}
  </View>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx
git commit -m "feat(assessment): resume ongoing attempt and gate retakes by completed count"
```

---

## Task 8: `AssessmentAttempts` — model-aligned live timer

**Files:**
- Modify: `features/assessment/components/AssessmentAttempts.tsx`

The current `AttemptCard` initializes `elapsedRef` from wall-clock `startedAt`, which drifts from `useAttemptSession`. Switch to the model-aligned formula (decision Q5.A).

- [ ] **Step 1: Replace the `AttemptCard` component**

In `features/assessment/components/AssessmentAttempts.tsx:46-81`, replace the existing `AttemptCard` with:

```tsx
const AttemptCard = ({ item }: { item: any }) => {
  const router = useRouter();
  const isOngoing = item.status === "ongoing";

  // Model-aligned elapsed: stored elapsed plus the gap since last heartbeat.
  // For completed attempts we freeze at the stored value.
  const elapsedRef = useRef(
    isOngoing
      ? (item.totalElapsedSeconds ?? 0) +
          Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(item.lastHeartbeatAt).getTime()) / 1000,
            ),
          )
      : (item.totalElapsedSeconds ?? 0),
  );

  const { formattedTime, remainingTime } = useAssessmentTimer(
    item?.duration || 0,
    elapsedRef,
  );

  return (
    <Pressable
      disabled={!isOngoing}
      onPress={() => router.push(`/attempt/${item.localId}`)}
      className="mb-1"
    >
      <Surface
        variant={!isOngoing ? "tertiary" : "default"}
        className="rounded-xl shadow-none flex-row justify-between items-center"
      >
        <AppText>Attempt {item.retakeNumber}</AppText>

        <AppText className={isOngoing && remainingTime < 60 ? "text-red-500" : ""}>
          {isOngoing ? formattedTime : item.status}
        </AppText>
      </Surface>
    </Pressable>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add features/assessment/components/AssessmentAttempts.tsx
git commit -m "fix(assessment): align attempts list timer with useAttemptSession model"
```

---

## Task 9: Manual end-to-end verification

This task is a single, untracked verification pass on a real device or simulator. It does **not** end with a commit. If any check fails, open a fresh task above to fix the regression and re-run the failing check.

Prerequisite: have a teacher account create at least one test activity with:
- `timeDuration` of 1 minute (to make auto-submit fast to verify),
- `shuffleQuestions = true` for one variant and `false` for another,
- a `maxRetake` of 2,
- at least one question of every supported `quizTypeId` (1–7), each with real choices for type 1.

- [ ] **Check 1 — Start flow with shuffle:** Open the app as a student, navigate to the test assessment, tap **Start Assessment**. Verify the new attempt's `questionOrder` is shuffled (open dev DB inspector or `console.log` it inside `AssessmentDetailsScreen`). Confirm questions render in the shuffled order.

- [ ] **Check 2 — Start flow without shuffle:** Repeat with the unshuffled variant. Confirm `questionOrder` is `[smallestId, ..., largestId]` ascending.

- [ ] **Check 3 — Real MC choices:** On a multiple-choice question, confirm the rendered options come from `activity_questionchoice` (not "Option A/B/C/D"). Tap an option; confirm `studentAnswer` is the choice ID as a string in the DB.

- [ ] **Check 4 — Stepper navigation persistence:** Tap Next a few times, then close the AttemptScreen via the back button (Stay/Leave dialog → Leave). Re-enter via Resume — confirm you land on the same `lastIndex`. Previously typed answers are still populated.

- [ ] **Check 5 — Manual submit:** Navigate to the last question. Confirm the right-side button is **Submit** (green). Tap it; confirm the dialog appears. Tap Cancel — dialog closes, no DB write. Tap Submit again, then Submit in dialog — attempt becomes `completed`, you land back on the assessment details screen.

- [ ] **Check 6 — Auto-submit:** Start a fresh attempt on the 1-min activity. Stay on the screen until the timer hits 0. Confirm the time-up banner shows briefly, the attempt becomes `completed`, and you route back. There should be no double-submit (status stays `completed`, score stays 0).

- [ ] **Check 7 — Background tick:** Start an attempt, background the app for 30+ seconds, return. Confirm `totalElapsedSeconds` reflects the gap (timer didn't pause).

- [ ] **Check 8 — Back-confirm (header):** Tap the header back arrow. Confirm the "Leave this attempt?" dialog appears. Tap Stay — dialog closes, you're still on the screen, timer still ticks. Tap back again, then Leave — you exit; the attempt remains `ongoing`; the heartbeat continues to write while the screen is mounted (it stops when you leave, but `useAttemptSession`'s next remount will accumulate the gap).

- [ ] **Check 9 — Back-confirm (Android hardware):** On Android, press the hardware back button mid-attempt. Confirm the same dialog opens. iOS only: confirm the swipe-back gesture does **not** dismiss the screen.

- [ ] **Check 10 — Resume:** With an ongoing attempt active, navigate back to the assessment details screen via the dialog Leave path. Confirm the bottom button now reads **Resume Attempt**. Tap it — you re-enter the same attempt at the saved `lastIndex`.

- [ ] **Check 11 — Stale ongoing routes in and finalizes:** Start an attempt with the 1-min activity; force-quit the app; wait 90 seconds; reopen and tap the ongoing attempt's card in the AssessmentAttempts list. Confirm you briefly enter the AttemptScreen, `useAttemptSession` detects time-up on mount, and the attempt is auto-submitted as `completed`.

- [ ] **Check 12 — Attempts list timer alignment:** With an ongoing attempt, open the assessment details. Note the card's countdown. Tap into the attempt; note the header countdown. They should match within 1 second.

- [ ] **Check 13 — Max retake:** Complete `maxRetake` attempts on the test activity. Confirm the bottom button no longer renders. Confirm a stale ongoing attempt is **not** counted toward the cap (start an attempt, leave it ongoing, complete 2 separate attempts — Resume should still appear, not "max reached").

---

## Self-Review

**Spec coverage:**

- §1 Context "already correct" → no tasks needed (preserved).
- §2 Q1 scope → respected; no rewrites.
- §2 Q2 manual submit → Task 5 (Submit button + dialog), Task 6 (handler).
- §2 Q3 no auto-grade → Task 1 (`finalizeAttempt` is status-only), Task 3 (auto-submit uses it).
- §2 Q4 MC choices → Task 1 (`getChoicesForActivity`), Task 2 (hook), Task 4 (rewritten `MultipleChoiceQuestion`), Task 5 (batched fetch wired in).
- §2 Q5 attempts list timer → Task 8.
- §2 Q6 back-confirm + iOS swipe disabled + Android hardware back → Task 6.
- §2 Q7 Resume vs Start + stale finalize via mount → Task 7 (Resume branch), behavior of mount-time finalize comes free from existing `useAttemptSession`.
- §3 file plan → Tasks 1, 2, 4, 5, 6, 7, 8.
- §4 service & hook additions → Tasks 1, 2, 3.
- §5 UI changes → Tasks 4, 5, 6, 7, 8.
- §6 edge cases → covered by code paths in Tasks 5, 6, 7; verified in Task 9 checks 6, 9, 11, 13.
- §7 testing → Task 9 mirrors the spec's manual checklist.
- §8 out of scope → respected; no scoring/teacher UI/test-framework work.

**Placeholder scan:** No "TBD/TODO/Similar to" placeholders. Every code step is complete.

**Type consistency:**
- `Choice.id` is `number`, `studentAnswer` for MC is `String(choice.id)` — matches across Tasks 4 and 5.
- `QuestionRenderer` signature accepts `choices` prop in Tasks 4 and 5.
- `QuestionList` adds `onSubmit` prop in Task 5; `AttemptScreen` passes it in Task 6.
- `useOngoingAttempt(studentActivityId, studentId)` signature in Task 2 matches the call in Task 7.
- `finalizeAttempt(localId)` signature in Task 1 matches calls in Tasks 3 and 6.
- `Button.Label` usage matches existing pattern (`screens/main/courses/course/assessment/AssessmentDetailsScreen.tsx:177`).

No issues found.
