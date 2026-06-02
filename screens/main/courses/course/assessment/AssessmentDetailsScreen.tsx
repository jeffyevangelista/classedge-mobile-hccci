import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Skeleton, useToast } from "heroui-native";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import Screen from "@/components/screen";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import {
  useAssessmentDetails,
  useAttemptRecords,
  useQuestionCount,
} from "@/features/assessment/assessment.hooks";
import {
  buildQuestionOrder,
  countAttempts,
  createAttempt,
  findStudentActivity,
} from "@/features/assessment/assessment.service";
import AssessmentAttempts from "@/features/assessment/components/AssessmentAttempts";
import { useCourseAssessment } from "@/features/courses/courses.hooks";
import HydrationDebugPill from "@/features/notifications/HydrationDebugPill";
import { makeEntityKey } from "@/features/notifications/pushPayloadCache";
import { useEntityFromPushOrSync } from "@/features/notifications/useEntityFromPushOrSync";
import { useSafeBottomInset } from "@/hooks/useSafeBottomInset";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { AssessmentClassroomBanner } from "./details/AssessmentClassroomBanner";
import { AssessmentCtaBar, type CtaState } from "./details/AssessmentCtaBar";
import { AssessmentHeroCard } from "./details/AssessmentHeroCard";
import { AssessmentInstructions } from "./details/AssessmentInstructions";
import { AssessmentScoreCard } from "./details/AssessmentScoreCard";

const AssessmentDetailsScreen = () => {
  const { toast } = useToast();
  const safeBottomInset = useSafeBottomInset();
  const { assessmentId } = useLocalSearchParams();
  const { authUser } = useStore();
  const watch = useCourseAssessment(assessmentId as string);
  const refetchAssessment = watch.refetch;

  const assessmentEntityKey = makeEntityKey(
    "assessment",
    assessmentId as string,
  );
  const {
    data,
    source, // [push-hydrate verify]
    isResolving,
    isMissing,
    error,
  } = useEntityFromPushOrSync({
    entityKey: assessmentEntityKey,
    localData: watch.data ?? null,
    localIsLoading: watch.isLoading,
    // apiFetch intentionally omitted: no REST endpoint exists for a
    // single assessment today. Payload + watch are sufficient.
  });
  const { data: studentAssessment, refetch: refetchStudentAssessment } =
    useAssessmentDetails({
      userId: authUser?.id ?? 0,
      assessmentId: data?.id ?? "",
    });
  const { data: attempts, refetch: refetchAttempts } = useAttemptRecords(
    studentAssessment?.id ?? "",
    authUser?.id ?? 0,
  );
  const { data: questionCount, refetch: refetchQuestionCount } =
    useQuestionCount(data?.id);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchAssessment(),
        refetchStudentAssessment(),
        refetchAttempts(),
        refetchQuestionCount(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetchAssessment,
    refetchStudentAssessment,
    refetchAttempts,
    refetchQuestionCount,
  ]);

  useFocusEffect(
    useCallback(() => {
      refetchAssessment();
      refetchStudentAssessment();
      refetchAttempts();
      refetchQuestionCount();
    }, [
      refetchAssessment,
      refetchStudentAssessment,
      refetchAttempts,
      refetchQuestionCount,
    ]),
  );

  const ongoingAttempt = useMemo(
    () => attempts?.find((a) => a.status === "ongoing") ?? null,
    [attempts],
  );

  const ctaState: CtaState = useMemo(() => {
    if (!data) return { kind: "start" };
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
  }, [data, attempts]);

  if (!data && isResolving) return <AssessmentDetailsSkeleton />;

  // Show the error fallback only when we have no data to render. If
  // payload or REST is already populating `data`, swallow a transient
  // watch error rather than disrupting the user.
  if (!data && (watch.error ?? error)) {
    return (
      <ErrorFallback
        message={getApiErrorMessage(watch.error ?? error)}
        onRefetch={() => refetchAssessment()}
      />
    );
  }

  if (!data && isMissing) {
    return (
      <NoDataFallback
        title="Assessment not found"
        description="The assessment you're looking for doesn't exist"
      />
    );
  }

  // Unreachable per the hook's isResolving / isMissing invariant when
  // apiFetch is absent; kept as a type-narrowing guard for `data`.
  if (!data) return null;

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

  const revealScores =
    !!studentAssessment && data.showScore && studentAssessment.totalScore > 0;

  return (
    <Screen className="max-w-3xl mx-auto w-full ">
      <ScreenScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="gap-4 p-4">
          {/* [push-hydrate verify] */}
          <HydrationDebugPill
            entityKey={assessmentEntityKey}
            source={source}
            isResolving={isResolving}
            isMissing={isMissing}
          />
          <AssessmentHeroCard
            activityName={data.activityName}
            endTime={data.endTime}
            questionCount={questionCount}
            timeDurationMinutes={data.timeDuration}
            attemptsUsed={attempts?.length}
            maxRetake={data.maxRetake}
          />

          {data.classroomMode ? <AssessmentClassroomBanner /> : null}

          {revealScores && studentAssessment ? (
            <AssessmentScoreCard
              score={studentAssessment.totalScore}
              maxScore={data.maxScore}
              passingScore={data.passingScore}
              passingScoreType={data.passingScoreType}
            />
          ) : null}

          <AssessmentInstructions
            text={data.activityInstruction}
            filePath={data.activityFileInstruction || undefined}
          />

          {studentAssessment && authUser?.id && (attempts?.length ?? 0) > 0 ? (
            <View>
              <AppText weight="semibold" className="text-base mb-2">
                Previous attempts
              </AppText>
              <AssessmentAttempts
                studentActivityId={studentAssessment.id}
                studentId={authUser.id}
                maxScore={data.maxScore}
                showScore={revealScores}
              />
            </View>
          ) : null}
        </View>
      </ScreenScrollView>

      {ongoingAttempt || data.classroomMode ? null : (
        <AssessmentCtaBar
          state={ctaState}
          starting={starting}
          onStart={handleStart}
          bottomInset={safeBottomInset}
        />
      )}
    </Screen>
  );
};

const AssessmentDetailsSkeleton = () => (
  <Screen className="max-w-3xl mx-auto w-full pb-2.5">
    <View className="gap-4 p-4">
      <Skeleton className="h-36 w-full rounded-xl" />
      <View className="gap-2">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-5/6 rounded-full" />
        <Skeleton className="h-3 w-4/6 rounded-full" />
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
