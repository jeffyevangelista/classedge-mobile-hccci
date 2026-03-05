import { View, ScrollView } from "react-native";
import React from "react";

import { useLocalSearchParams } from "expo-router";
import { useCourseAssessment } from "@/features/courses/courses.hooks";
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { Card } from "heroui-native";

const AssessmentDetailsScreen = () => {
  const { assessmentId } = useLocalSearchParams();
  const { data, isLoading, isError, error } = useCourseAssessment(
    assessmentId as string,
  );

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>Error: {error.message}</AppText>;
  if (!data) return <AppText>No data found</AppText>;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Screen>
      <ScrollView className="flex-1 p-4">
        <View className="gap-4">
          <Card className="p-4">
            <AppText weight="bold" className="text-2xl mb-2">
              {data.activityName}
            </AppText>

            <View className="mt-4 gap-2">
              <View className="flex-row justify-between">
                <AppText weight="semibold">Start Time:</AppText>
                <AppText>{formatDate(data.startTime)}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">End Time:</AppText>
                <AppText>{formatDate(data.endTime)}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">Duration:</AppText>
                <AppText>{data.timeDuration} minutes</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">Max Score:</AppText>
                <AppText>{data.maxScore}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">Passing Score:</AppText>
                <AppText>{data.passingScore}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">Passing Score Type:</AppText>
                <AppText>{data.passingScoreType}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">Max Retakes:</AppText>
                <AppText>{data.maxRetake}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">Show Score:</AppText>
                <AppText>{data.showScore ? "Yes" : "No"}</AppText>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
};

export default AssessmentDetailsScreen;
