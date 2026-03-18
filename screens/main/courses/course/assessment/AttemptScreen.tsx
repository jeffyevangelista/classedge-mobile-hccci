import { View, Text } from "react-native";
import React, { useEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useGetAssessmentAttempt } from "@/features/assessment/assessment.hooks";
import { useAssessmentTimer } from "@/hooks/useAssessmentTimer";
import QuestionList from "@/features/assessment/components/QuestionList";

const AttemptScreen = () => {
  const { attemptId } = useLocalSearchParams();
  const {
    data: attempt,
    isLoading,
    isError,
    error,
  } = useGetAssessmentAttempt(attemptId as string);
  const navigation = useNavigation();

  const { formattedTime, remainingTime } = useAssessmentTimer(
    attempt?.startedAt || new Date().toISOString(),
    attempt?.duration || 0,
    () => {
      // Handle time up
    },
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

  return (
    <View style={{ flex: 1 }}>
      <QuestionList activityId={attempt.activityId} />
    </View>
  );
};

export default AttemptScreen;
