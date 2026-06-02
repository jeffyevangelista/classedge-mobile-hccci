import {
  View,
  StyleSheet,
  ScrollView,
  AppState,
  type AppStateStatus,
} from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  useGetOrderedQuestions,
  useGetAnswersForAttempt,
  useChoicesForActivity,
} from "../assessment.hooks";
import { saveAnswer } from "../assessment.service";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import EmptyState from "@/components/EmptyState";
import { Skeleton, Button, Dialog, useThemeColor } from "heroui-native";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import { Icon } from "@/components/Icon";
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
  const mutedTrackColor = useThemeColor("default");
  const foregroundColor = useThemeColor("foreground");

  // Populate answers from existing records on load / re-entry
  useEffect(() => {
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
    if (!existingAnswers) return;
    const restoredAnswers: Record<number, string> = {};
    const restoredUploads: Record<number, string> = {};
    for (const a of existingAnswers) {
      restoredAnswers[a.activityQuestionId] = a.studentAnswer;
      if (a.uploadedFile) restoredUploads[a.activityQuestionId] = a.uploadedFile;
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

  const flushPendingSaves = useCallback(async () => {
    const entries = Array.from(pendingSavesRef.current.entries());
    pendingSavesRef.current.forEach(({ timer }) => clearTimeout(timer));
    pendingSavesRef.current.clear();
    await Promise.all(
      entries.map(([questionId, { answer }]) =>
        saveAnswer(retakeRecordId, questionId, studentId, answer).catch(
          (err) =>
            console.error("[QuestionList] Flush save failed:", err),
        ),
      ),
    );
  }, [retakeRecordId, studentId]);

  const handleAnswer = useCallback(
    (questionId: number, answer: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));

      const existing = pendingSavesRef.current.get(questionId);
      if (existing) clearTimeout(existing.timer);

      const timer = setTimeout(() => {
        saveAnswer(retakeRecordId, questionId, studentId, answer).catch(
          (err) =>
            console.error("[QuestionList] Failed to save answer:", err),
        );
        pendingSavesRef.current.delete(questionId);
      }, 250);

      pendingSavesRef.current.set(questionId, { answer, timer });
    },
    [retakeRecordId, studentId],
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
        saveAnswer(retakeRecordId, questionId, studentId, answer).catch(
          (err) =>
            console.error("[QuestionList] Unmount flush failed:", err),
        );
      });
      pendingSavesRef.current.clear();
    };
  }, [retakeRecordId, studentId]);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (next === "background" || next === "inactive") {
          flushPendingSaves();
        }
      },
    );
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

  return (
    <View style={styles.paginationContainer}>
      {isTimeUp && (
        <View
          style={[styles.timeUpBanner, { backgroundColor: dangerColor }]}
        >
          <AppText
            style={[styles.timeUpText, { color: dangerForegroundColor }]}
          >
            Time is up! Submitting...
          </AppText>
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
          <View
            style={[styles.progressTrack, { backgroundColor: mutedTrackColor }]}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: totalQuestions,
              now: currentPage + 1,
            }}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: accentColor,
                  width: `${
                    totalQuestions > 0
                      ? ((currentPage + 1) / totalQuestions) * 100
                      : 0
                  }%`,
                },
              ]}
            />
          </View>
          <QuestionRenderer
            question={currentQuestion}
            currentAnswer={answers[currentQuestion.id] ?? ""}
            onAnswer={handleAnswer}
            disabled={isTimeUp}
            choices={choices}
            currentUpload={uploads[currentQuestion.id]}
            onUpload={handleUpload}
          />
        </View>
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
                <Button.Label>Submit</Button.Label>
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
            <View className="mb-5 gap-3">
              <Dialog.Title>Submit assessment?</Dialog.Title>
              <Dialog.Description>
                Once submitted, you can't change your answers.
              </Dialog.Description>
            </View>
            <View>
              <Button onPress={handleSubmitConfirm}>Submit</Button>
              <Button variant="ghost" onPress={() => setSubmitOpen(false)}>
                Cancel
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
    textAlign: "center",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
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
      <View style={styles.currentQuestionContainer}>
        <Skeleton className="h-6 w-40 rounded mb-3" />
        <View style={questionStyles.questionContainer}>
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
