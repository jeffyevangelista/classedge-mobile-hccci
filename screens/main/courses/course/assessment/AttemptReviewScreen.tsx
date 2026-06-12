import { useLocalSearchParams } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import Screen from "@/components/screen";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import {
  useAttemptReview,
  useQuestionTypes,
} from "@/features/assessment/assessment.hooks";
import { QuestionResultCard } from "@/features/assessment/components/results/QuestionResultCard";
import {
  isAnswerCorrect,
  isAutoGraded,
} from "@/features/assessment/components/results/correctness";
import { formatDueDate, formatShortDate } from "@/features/assessment/formatters";
import useStore from "@/lib/store";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const AttemptReviewScreen = () => {
  const { attemptId } = useLocalSearchParams();
  const { authUser } = useStore();
  const { data, isLoading, isError, error } = useAttemptReview(
    attemptId as string,
  );
  const { data: types } = useQuestionTypes();
  const warningColor = useThemeColor("warning");
  const successColor = useThemeColor("success");

  // Build a map answer-by-question for O(1) lookups while rendering the
  // list. Key by String(activityQuestionId): the Drizzle schema declares
  // both sides as integer, but SQLite returns question.id as a string in
  // practice, so a number-keyed Map would silently miss every lookup.
  const answerByQuestion = useMemo(() => {
    const m = new Map<
      string,
      { studentAnswer: string; uploadedFile?: string }
    >();
    data?.answers.forEach((a) => {
      m.set(String(a.activityQuestionId), {
        studentAnswer: a.studentAnswer ?? "",
        uploadedFile:
          a.uploadedFile && a.uploadedFile.length > 0
            ? a.uploadedFile
            : undefined,
      });
    });
    return m;
  }, [data?.answers]);

  // Compute auto-graded correct count for the summary line. Manually
  // graded types (essay/upload) are excluded from this count since we
  // can't decide their outcome client-side.
  const summary = useMemo(() => {
    if (!data?.activity || !data.questions.length || !types) {
      return { correct: 0, autoTotal: 0, manualTotal: 0 };
    }
    let correct = 0;
    let autoTotal = 0;
    let manualTotal = 0;
    data.questions.forEach((q) => {
      const typeRow = types.find((t) => Number(t.id) === Number(q.quizTypeId));
      const typeKey = typeRow ? normalize(typeRow.name) : null;
      if (!isAutoGraded(typeKey)) {
        manualTotal += 1;
        return;
      }
      autoTotal += 1;
      const ans = answerByQuestion.get(String(q.id));
      const studentAnswer = ans?.studentAnswer ?? "";
      if (isAnswerCorrect(typeKey, q, studentAnswer, data.choices) === true)
        correct += 1;
    });
    return { correct, autoTotal, manualTotal };
  }, [data?.activity, data?.questions, answerByQuestion, types]);

  if (isLoading) return <AttemptReviewSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={error?.message ?? "Failed to load attempt."} />
    );
  if (!data || !data.attempt || !data.activity) {
    return (
      <NoDataFallback
        title="Attempt not found"
        description="This attempt couldn't be loaded."
      />
    );
  }

  const { attempt, activity, questions } = data;
  const isPastDue = Date.now() > new Date(activity.endTime).getTime();
  const canRevealCorrect = isPastDue && activity.showScore;
  // When `gradedAt` is null the server hasn't recorded a score yet —
  // showing "0 / N" would falsely tell the student they got nothing
  // right. Render a "Pending grading" state instead.
  const isGraded = !!attempt.gradedAt;
  const passingScore = activity.passingScore;
  const passingScoreType = activity.passingScoreType;
  const passed =
    canRevealCorrect && !!attempt.gradedAt && passingScore != null
      ? passingScoreType === "percentage"
        ? activity.maxScore > 0 &&
          (attempt.score / activity.maxScore) * 100 >= passingScore
        : attempt.score >= passingScore
      : null;
  const submittedAt = attempt.lastHeartbeatAt
    ? formatShortDate(attempt.lastHeartbeatAt)
    : null;

  return (
    <Screen className="max-w-3xl mx-auto w-full ">
      <ScreenScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="gap-3 px-3">
          <LinearGradient
            colors={["#2563eb", "#1e40af", "#1e3a8a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 16, padding: 16, overflow: "hidden" }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <AppText
                weight="bold"
                className="text-[10px] uppercase tracking-widest text-white/85"
              >
                Attempt {attempt.retakeNumber}
                {submittedAt ? ` · Submitted ${submittedAt}` : ""}
              </AppText>
              {passed === true ? (
                <View className="px-2 py-0.5 rounded-md bg-white/20 border border-white/25">
                  <AppText weight="bold" className="text-[10px] text-white">
                    Passed
                  </AppText>
                </View>
              ) : passed === false ? (
                <View className="px-2 py-0.5 rounded-md bg-white/20 border border-white/25">
                  <AppText weight="bold" className="text-[10px] text-white">
                    Did not pass
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText
              weight="bold"
              className="text-lg text-white leading-tight mb-2"
              numberOfLines={2}
            >
              {activity.activityName}
            </AppText>
            {!isGraded ? (
              <View className="flex-row items-center gap-2">
                <Icon name="CheckCircleIcon" size={16} color="#bbf7d0" />
                <View>
                  <AppText weight="bold" className="text-sm text-white">
                    Submitted
                  </AppText>
                  <AppText className="text-[11px] text-white/85">
                    Score pending grading
                  </AppText>
                </View>
              </View>
            ) : canRevealCorrect ? (
              <View className="flex-row items-baseline gap-2">
                <AppText
                  weight="bold"
                  className="text-3xl text-white"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {attempt.score}
                </AppText>
                <AppText
                  className="text-white/80"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  / {activity.maxScore}
                </AppText>
                {activity.maxScore > 0 ? (
                  <AppText
                    className="ml-auto text-xs text-white/85"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {Math.round((attempt.score / activity.maxScore) * 100)}%
                  </AppText>
                ) : null}
              </View>
            ) : (
              <AppText className="text-xs text-white/85">
                Score hidden until the due date
              </AppText>
            )}
            {canRevealCorrect && isGraded && summary.autoTotal > 0 ? (
              <View className="mt-3 pt-2 border-t border-white/15 flex-row items-center gap-1.5">
                <Icon name="CheckIcon" size={11} color="#bbf7d0" />
                <AppText
                  weight="semibold"
                  className="text-[11px] text-white/90"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {summary.correct} of {summary.autoTotal} auto-graded correct
                  {summary.manualTotal > 0
                    ? ` · ${summary.manualTotal} manual`
                    : ""}
                </AppText>
              </View>
            ) : null}
          </LinearGradient>

          {!canRevealCorrect ? (
            <View className="flex-row items-start gap-2 px-3 py-2.5 rounded-xl bg-warning-soft border border-warning/30">
              <View style={{ marginTop: 2 }}>
                <Icon name="ClockIcon" size={14} color={warningColor} />
              </View>
              <View className="flex-1">
                <AppText weight="semibold" className="text-xs text-warning">
                  Correct answers reveal after the due date
                </AppText>
                <AppText className="text-[11px] text-warning/80 mt-0.5">
                  Available {formatDueDate(activity.endTime)}. Your answers
                  are saved.
                </AppText>
              </View>
            </View>
          ) : null}

          {summary.manualTotal > 0 && canRevealCorrect ? (
            <View className="flex-row items-start gap-2 px-3 py-2.5 rounded-xl bg-accent-soft border border-accent/30">
              <View style={{ marginTop: 2 }}>
                <Icon name="ClockIcon" size={14} color={successColor} />
              </View>
              <View className="flex-1">
                <AppText weight="semibold" className="text-xs text-accent">
                  {summary.manualTotal}{" "}
                  {summary.manualTotal === 1 ? "question" : "questions"} pending
                  teacher review
                </AppText>
                <AppText className="text-[11px] text-muted mt-0.5">
                  Final score may change after grading.
                </AppText>
              </View>
            </View>
          ) : null}

          {questions.map((q, idx) => {
            const ans = answerByQuestion.get(String(q.id));
            return (
              <QuestionResultCard
                key={q.id}
                index={idx + 1}
                question={q}
                studentAnswer={ans?.studentAnswer ?? ""}
                uploadedFile={ans?.uploadedFile}
                isRevealed={canRevealCorrect}
                choices={data.choices}
              />
            );
          })}

          {/* Suppress unused authUser warning — we kept it for future
              parity with AttemptScreen's auth check. */}
          {authUser?.id == null ? null : null}
        </View>
      </ScreenScrollView>
    </Screen>
  );
};

const AttemptReviewSkeleton = () => (
  <Screen className="max-w-3xl mx-auto w-full">
    <View className="gap-3 p-3 flex-1">
      <Skeleton className="h-36 w-full rounded-xl" />
      {Array(3)
        .fill(0)
        .map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
    </View>
  </Screen>
);

export default AttemptReviewScreen;
