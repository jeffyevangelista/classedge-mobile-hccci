import { View } from "react-native";
import React, { useEffect, useCallback } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useGetAssessmentAttempt } from "@/features/assessment/assessment.hooks";
import { useAssessmentTimer } from "@/hooks/useAssessmentTimer";
import { useAttemptSession } from "@/hooks/useAttemptSession";
import QuestionList from "@/features/assessment/components/QuestionList";
import useStore from "@/lib/store";
import { Skeleton } from "heroui-native";

const AttemptScreen = () => {
  const { attemptId } = useLocalSearchParams();
  const { authUser } = useStore();
  const {
    data: attempt,
    isLoading,
    isError,
    error,
  } = useGetAssessmentAttempt(attemptId as string);
  const navigation = useNavigation();

  const onAutoSubmit = useCallback(() => {
    router.replace({
      pathname: "/(main)/assessment/[assessmentId]",
      params: { assessmentId: String(attempt?.activityId) },
    });
  }, [attempt?.activityId]);

  const { saveLastIndex, elapsedRef } = useAttemptSession({
    attempt: attempt ?? null,
    onAutoSubmit,
  });

  const { formattedTime, remainingTime } = useAssessmentTimer(
    attempt?.duration || 0,
    elapsedRef,
  );

  useEffect(() => {
    if (!attempt || isLoading) return;

    navigation.setOptions({
      headerTitle: formattedTime,
      headerTitleAlign: "center",
      headerTitleStyle: {
        color: remainingTime < 60 ? "red" : "black",
        fontWeight: "700",
      },
    });
  }, [formattedTime, remainingTime, navigation, attempt, isLoading]);

  if (isLoading) return <AttemptScreenSkeleton />;
  if (isError)
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Skeleton className="h-5 w-48 rounded-full" />
      </View>
    );
  if (!attempt)
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
      />
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
