import { Button, Dialog, Skeleton, useThemeColor } from "heroui-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AppText } from "@/components/AppText";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import { track } from "@/lib/activity-tracker";
import {
  useChoicesForActivity,
  useGetAnswersForAttempt,
  useGetOrderedQuestions,
} from "../assessment.hooks";
import { saveAnswer } from "../assessment.service";
import { QuestionRenderer } from "./questions";
import { questionStyles } from "./questions/styles";

type QuestionListProps = {
  activityId: string;
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
    isLoading: isQuestionsLoading,
    isError,
    error,
  } = useGetOrderedQuestions(activityId, questionOrder);

  const { data: existingAnswers } = useGetAnswersForAttempt(attemptId);
  const { data: choices = [], isLoading: isChoicesLoading } =
    useChoicesForActivity(activityId);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [uploads, setUploads] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(initialIndex);
  const [submitOpen, setSubmitOpen] = useState(false);
  const safeBottomInset = useScrollBottomInset();
  const surfaceColor = useThemeColor("surface");
  const borderColor = useThemeColor("border");
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");
  const dangerForegroundColor = useThemeColor("danger-foreground");
  // Use `border` rather than `default` for the track — in light mode
  // `default` is slate-100, identical to the screen background, so the
  // track disappears. `border` is slate-200 light / slate-800 dark, which
  // reads as a subtle visible track in both modes.
  const mutedTrackColor = useThemeColor("border");
  const foregroundColor = useThemeColor("foreground");
  const successColor = useThemeColor("success");

  // Populate answers from existing records on load / re-entry
  useEffect(() => {
    if (__DEV__) {
      console.log(
        "[QuestionList] existingAnswers effect — attemptId:",
        attemptId,
        "existingAnswers:",
        existingAnswers
          ? existingAnswers.map((a) => ({
              qid: a.activityQuestionId,
              answer: a.studentAnswer,
              upload: a.uploadedFile,
            }))
          : existingAnswers,
      );
    }
    if (!existingAnswers) return;
    const restoredAnswers: Record<number, string> = {};
    const restoredUploads: Record<number, string> = {};
    for (const a of existingAnswers) {
      restoredAnswers[a.activityQuestionId] = a.studentAnswer;
      if (a.uploadedFile)
        restoredUploads[a.activityQuestionId] = a.uploadedFile;
    }
    setAnswers(restoredAnswers);
    setUploads(restoredUploads);
  }, [existingAnswers, attemptId]);

  useEffect(() => {
    if (isTimeUp) setSubmitOpen(false);
  }, [isTimeUp]);

  const pendingSavesRef = useRef<
    Map<number, { answer: string; timer: ReturnType<typeof setTimeout> }>
  >(new Map());

  // Fires `start_activity` exactly once per attempt lifecycle, on the first
  // answer the student saves. Resets when this component unmounts.
  const startedTrackedRef = useRef(false);

  const flushPendingSaves = useCallback(async () => {
    const entries = Array.from(pendingSavesRef.current.entries());
    pendingSavesRef.current.forEach(({ timer }) => clearTimeout(timer));
    pendingSavesRef.current.clear();
    await Promise.all(
      entries.map(([questionId, { answer }]) =>
        saveAnswer(retakeRecordId, questionId, studentId, answer).catch((err) =>
          console.error("[QuestionList] Flush save failed:", err),
        ),
      ),
    );
  }, [retakeRecordId, studentId]);

  const handleAnswer = useCallback(
    (questionId: number, answer: string) => {
      if (!startedTrackedRef.current) {
        startedTrackedRef.current = true;
        track("start_activity", { activityId });
      }
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));

      const existing = pendingSavesRef.current.get(questionId);
      if (existing) clearTimeout(existing.timer);

      const timer = setTimeout(() => {
        saveAnswer(retakeRecordId, questionId, studentId, answer).catch((err) =>
          console.error("[QuestionList] Failed to save answer:", err),
        );
        pendingSavesRef.current.delete(questionId);
      }, 250);

      pendingSavesRef.current.set(questionId, { answer, timer });
    },
    [retakeRecordId, studentId, activityId],
  );

  const handleUpload = useCallback(
    (questionId: number, fileUri: string) => {
      setUploads((prev) => ({ ...prev, [questionId]: fileUri }));
      const currentAnswer = answers[questionId] ?? "";
      saveAnswer(
        retakeRecordId,
        questionId,
        studentId,
        currentAnswer,
        fileUri,
      ).catch((err) =>
        console.error("[QuestionList] Failed to save upload:", err),
      );
    },
    [retakeRecordId, studentId, answers],
  );

  useEffect(() => {
    return () => {
      pendingSavesRef.current.forEach(({ answer, timer }, questionId) => {
        clearTimeout(timer);
        saveAnswer(retakeRecordId, questionId, studentId, answer).catch((err) =>
          console.error("[QuestionList] Unmount flush failed:", err),
        );
      });
      pendingSavesRef.current.clear();
    };
  }, [retakeRecordId, studentId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        flushPendingSaves();
      }
    });
    return () => sub.remove();
  }, [flushPendingSaves]);

  const handleNextPage = () => {
    if (questions && currentPage < questions.length - 1) {
      flushPendingSaves();
      const next = currentPage + 1;
      setCurrentPage(next);
      onIndexChange(next);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      flushPendingSaves();
      const prev = currentPage - 1;
      setCurrentPage(prev);
      onIndexChange(prev);
    }
  };

  const handleSubmitConfirm = async () => {
    setSubmitOpen(false);
    await flushPendingSaves();
    track("submit_activity", { activityId });
    onSubmit();
  };

  if (isQuestionsLoading || isChoicesLoading) return <QuestionListSkeleton />;

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

  // A question is "answered" if there's a non-empty text answer OR an
  // uploaded file. Used to drive the submit dialog summary + jump chips.
  const isAnswered = (questionId: number): boolean => {
    const a = answers[questionId];
    const u = uploads[questionId];
    return (
      (typeof a === "string" && a.trim().length > 0) ||
      (typeof u === "string" && u.length > 0)
    );
  };
  const answeredCount = questions.filter((q) => isAnswered(q.id)).length;
  const allAnswered = answeredCount === totalQuestions;
  // 1-based position in the current question order, for display.
  const unansweredPositions = questions
    .map((q, idx) => (isAnswered(q.id) ? null : idx + 1))
    .filter((n): n is number => n != null);

  const handleJumpTo = (position1Based: number) => {
    setSubmitOpen(false);
    flushPendingSaves();
    const target = position1Based - 1;
    setCurrentPage(target);
    onIndexChange(target);
  };

  return (
    <View style={styles.paginationContainer}>
      {isTimeUp && (
        <View style={[styles.timeUpBanner, { backgroundColor: dangerColor }]}>
          <AppText
            style={[styles.timeUpText, { color: dangerForegroundColor }]}
          >
            Time is up! Submitting...
          </AppText>
        </View>
      )}
      {/* Progress strip — pinned above the scrolling question so the
          "where am I / how many done" read stays anchored as the student
          scrolls a long question body. */}
      <View
        className="px-4 pt-3 pb-2"
        accessibilityRole="progressbar"
        accessibilityLabel={`Question ${currentPage + 1} of ${totalQuestions}, ${answeredCount} answered`}
        accessibilityValue={{
          min: 0,
          max: totalQuestions,
          now: currentPage + 1,
        }}
      >
        <View className="flex-row items-baseline justify-between mb-1">
          <AppText
            weight="semibold"
            className="text-xs text-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            Question {currentPage + 1}{" "}
            <AppText weight="regular" className="text-muted">
              of {totalQuestions}
            </AppText>
          </AppText>
          <View className="flex-row items-center gap-1">
            <Icon name="CheckIcon" size={11} color={successColor} />
            <AppText
              weight="semibold"
              className="text-[11px] text-success"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {answeredCount} answered
            </AppText>
          </View>
        </View>
        {/* Split-fill bar: green tint = answered share, blue tick = current
            position. The tick is absolutely positioned so it can sit
            anywhere — including back inside the green if the student is
            reviewing an earlier answered question. */}
        <View
          className="h-1.5 rounded-full overflow-hidden relative"
          style={{ backgroundColor: mutedTrackColor }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${
                totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0
              }%`,
              backgroundColor: successColor,
              opacity: 0.45,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: `${
                totalQuestions > 0
                  ? ((currentPage + 1) / totalQuestions) * 100
                  : 0
              }%`,
              top: 0,
              bottom: 0,
              width: 4,
              marginLeft: -2,
              backgroundColor: accentColor,
              borderRadius: 2,
            }}
          />
        </View>
      </View>

      <ScrollView
        style={styles.questionScrollView}
        contentContainerStyle={{ padding: 16 }}
        pointerEvents={isTimeUp ? "none" : "auto"}
      >
        <QuestionRenderer
          question={currentQuestion}
          currentAnswer={answers[currentQuestion.id] ?? ""}
          onAnswer={handleAnswer}
          disabled={isTimeUp}
          choices={choices}
          currentUpload={uploads[currentQuestion.id]}
          onUpload={handleUpload}
        />
      </ScrollView>

      <View
        style={[
          styles.navigationContainer,
          {
            paddingBottom: safeBottomInset + 16,
            backgroundColor: surfaceColor,
            borderTopColor: borderColor,
          },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            width: "100%",
            maxWidth: 768,
            marginHorizontal: "auto",
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              variant="tertiary"
              onPress={handlePreviousPage}
              isDisabled={currentPage === 0 || isTimeUp}
            >
              <Icon name="CaretLeftIcon" size={16} color={foregroundColor} />
              <Button.Label>Previous</Button.Label>
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            {isLastQuestion ? (
              <Button
                variant="primary"
                onPress={() => setSubmitOpen(true)}
                isDisabled={isTimeUp}
              >
                <Icon name="CheckIcon" size={16} color="#fff" />
                <Button.Label>
                  Submit · {answeredCount}/{totalQuestions}
                </Button.Label>
              </Button>
            ) : (
              <Button
                variant="primary"
                onPress={handleNextPage}
                isDisabled={isTimeUp}
              >
                <Button.Label>Next</Button.Label>
                <Icon name="CaretRightIcon" size={16} color="#fff" />
              </Button>
            )}
          </View>
        </View>
      </View>

      <Dialog isOpen={submitOpen} onOpenChange={setSubmitOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="w-full max-w-lg mx-auto">
            <View className="mb-4 gap-2">
              <Dialog.Title>Submit assessment?</Dialog.Title>
              <Dialog.Description>
                Once submitted, you can't change your answers.
              </Dialog.Description>
            </View>

            {allAnswered ? (
              <View className="flex-row items-center gap-3 rounded-xl bg-success-soft border border-success/30 p-3 mb-4">
                <View className="w-10 h-10 rounded-xl items-center justify-center bg-success/15">
                  <Icon name="CheckIcon" size={18} color="#059669" />
                </View>
                <View className="flex-1">
                  <AppText weight="semibold" className="text-sm text-success">
                    All {totalQuestions} answered
                  </AppText>
                  <AppText className="text-xs text-success/80">
                    Looks good.
                  </AppText>
                </View>
              </View>
            ) : (
              <View className="gap-2 mb-4">
                <View className="flex-row items-center gap-3 rounded-xl bg-default border border-border p-3">
                  <View className="w-10 h-10 rounded-xl items-center justify-center bg-success/15">
                    <Icon name="CheckIcon" size={18} color="#059669" />
                  </View>
                  <View className="flex-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-foreground"
                    >
                      Answered
                    </AppText>
                    <AppText className="text-xs text-muted">
                      {answeredCount} of {totalQuestions} questions
                    </AppText>
                  </View>
                  <AppText
                    weight="bold"
                    className="text-2xl text-foreground"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {answeredCount}
                  </AppText>
                </View>
                <View className="rounded-xl bg-warning-soft border border-warning/30 p-3">
                  <View className="flex-row items-center gap-3 mb-1">
                    <View className="w-10 h-10 rounded-xl items-center justify-center bg-warning/20">
                      <Icon
                        name="WarningCircleIcon"
                        size={18}
                        color="#b45309"
                      />
                    </View>
                    <View className="flex-1">
                      <AppText
                        weight="semibold"
                        className="text-sm text-warning"
                      >
                        {unansweredPositions.length} unanswered
                      </AppText>
                      <AppText className="text-xs text-warning/80">
                        Tap a number to jump back.
                      </AppText>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-1.5">
                    {unansweredPositions.map((position) => (
                      <Pressable
                        key={position}
                        onPress={() => handleJumpTo(position)}
                        accessibilityRole="button"
                        accessibilityLabel={`Jump to question ${position}`}
                        className="rounded-lg bg-surface px-2.5 py-1 active:opacity-70"
                      >
                        <AppText
                          weight="bold"
                          className="text-xs text-warning"
                          style={{ fontVariant: ["tabular-nums"] }}
                        >
                          {position}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            <View>
              <Button onPress={handleSubmitConfirm}>
                <Button.Label>
                  {allAnswered ? "Submit" : "Submit anyway"}
                </Button.Label>
              </Button>
              <Button variant="ghost" onPress={() => setSubmitOpen(false)}>
                <Button.Label>Go back</Button.Label>
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
  navigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  timeUpBanner: {
    padding: 12,
    alignItems: "center",
  },
  timeUpText: {
    fontWeight: "700",
    fontSize: 16,
  },
});

const QuestionListSkeleton = () => {
  return (
    <View style={styles.paginationContainer}>
      <View className="px-4 pt-3 pb-2 gap-2">
        <View className="flex-row justify-between">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </View>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </View>
      <View className="p-4">
        <View style={questionStyles.questionContainer}>
          <Skeleton className="h-5 w-full rounded mb-1" />
          <Skeleton className="h-3 w-20 rounded mb-3" />
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-md mb-1" />
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
