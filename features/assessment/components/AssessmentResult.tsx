import { View, Text } from "react-native";
import React from "react";
import AssessmentAttempts from "./AssessmentAttempts";
import { AppText } from "@/components/AppText";

type AssessmentResultProps = {
  assessmentData: any;
  isLoading: boolean;
};

const AssessmentResult = ({
  assessmentData,
  isLoading,
}: AssessmentResultProps) => {
  if (isLoading) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!assessmentData) {
    return null;
  }

  return (
    <View className="mt-3 gap-4">
      <View className="rounded-xl">
        <View className="gap-2">
          <View className="flex-row justify-between">
            <AppText weight="semibold">Score</AppText>
            <AppText>{assessmentData.score}</AppText>
          </View>
          <AssessmentAttempts assessmentData={assessmentData} />
        </View>
      </View>
    </View>
  );
};

export default AssessmentResult;
