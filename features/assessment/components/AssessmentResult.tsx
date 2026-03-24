import { View, Text } from "react-native";
import React from "react";
import AssessmentAttempts from "./AssessmentAttempts";
import { AppText } from "@/components/AppText";
import { Skeleton } from "heroui-native";

type AssessmentResultProps = {
  assessmentData: any;
  isLoading: boolean;
};

const AssessmentResult = ({
  assessmentData,
  isLoading,
}: AssessmentResultProps) => {
  if (isLoading) {
    return <AssessmentResultSkeleton />;
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

const AssessmentResultSkeleton = () => {
  return (
    <View className="mt-3 gap-4">
      <View className="rounded-xl">
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </View>
          <View className="gap-1.5">
            {Array(3)
              .fill(0)
              .map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default AssessmentResult;
