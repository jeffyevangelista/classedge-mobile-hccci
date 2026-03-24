import { View, Text } from "react-native";
import React, { useEffect, useCallback } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useGetAssessmentAttempt } from "@/features/assessment/assessment.hooks";
import { useAssessmentTimer } from "@/hooks/useAssessmentTimer";
import { useAttemptSession } from "@/hooks/useAttemptSession";
import QuestionList from "@/features/assessment/components/QuestionList";
import useStore from "@/lib/store";

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

  if (isLoading) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View>
        <Text>Error: {error?.message}</Text>
      </View>
    );
  }

  if (!attempt) {
    return (
      <View>
        <Text>Attempt not found</Text>
      </View>
    );
  }

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

export default AttemptScreen;
