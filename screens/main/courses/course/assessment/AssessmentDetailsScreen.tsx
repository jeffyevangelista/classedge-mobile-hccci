import { View, ScrollView } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useCourseAssessment } from "@/features/courses/courses.hooks";
import {
  useAssessmentDetails,
  useAttemptRecords,
} from "@/features/assessment/assessment.hooks";
import { AppText } from "@/components/AppText";
import useStore from "@/lib/store";
import Screen from "@/components/screen";
import { Button, useToast } from "heroui-native";
import AssessmentResult from "@/features/assessment/components/AssessmentResult";
import {
  getAttemptRecords,
  getQuestions,
  startAssessmentAttempt,
} from "@/features/assessment/assessment.services";
import { useEffect } from "react";

const AssessmentDetailsScreen = () => {
  const { toast } = useToast();
  const { assessmentId } = useLocalSearchParams();
  const { authUser } = useStore();
  const navigation = useNavigation();
  const { data, isLoading, isError, error } = useCourseAssessment(
    assessmentId as string,
  );

  const { data: assessmentData, isLoading: isAssessmentLoading } =
    useAssessmentDetails({
      userId: authUser?.id!,
      assessmentId: String(data?.id!),
    });

  const { data: assessmentAttempts } = useAttemptRecords(
    assessmentData?.id!,
    authUser?.id!,
  );

  useEffect(() => {
    if (data) {
      navigation.setOptions({
        title: data.activityName,
      });
    }
  }, [data]);

  console.log(assessmentId);

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

  const handleStartAssessment = async () => {
    const studentAssessmentId = assessmentData?.id;
    const activityId = assessmentData?.activityId;

    try {
      const questions = await getQuestions(activityId!);

      const existingAttempts = await getAttemptRecords(
        studentAssessmentId!,
        authUser?.id!,
      );

      if (existingAttempts.length >= data.maxRetake) {
        throw new Error("Maximum number of retakes reached");
      }

      // Build question order, shuffle if the activity requires it
      let questionIds = questions.map((q) => q.id);
      if (data.shuffleQuestions) {
        for (let i = questionIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]];
        }
      }

      const result = await startAssessmentAttempt(
        studentAssessmentId!,
        authUser?.id!,
        data.timeDuration,
        existingAttempts.length + 1,
        activityId!,
        questionIds,
      );

      console.log("result", result);

      router.replace({
        pathname: "/(main)/attempt/[attemptId]",
        params: { attemptId: result[0].localId },
      });

      console.log("attempt started", result);
    } catch (error) {
      console.log(error);
      toast.show({
        label: "Error",
        description: "Failed to start attempt",
        variant: "danger",
      });
    }
  };

  console.log(new Date(data.endTime));

  const disableButton = new Date(data.endTime) < new Date();
  const maxRetakesReached = (assessmentAttempts?.length ?? 0) >= data.maxRetake;

  return (
    <Screen className="max-w-3xl mx-auto w-full">
      <ScrollView className="flex-1 p-2.5">
        <View className="gap-4">
          <View className=" rounded-xl">
            <View className="mt-4 gap-2">
              <View className="flex-row justify-between">
                <AppText weight="semibold">Due:</AppText>
                <AppText>{formatDate(data.endTime)}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">Time Duration:</AppText>
                <AppText>{data.timeDuration}</AppText>
              </View>

              <View className="flex-row justify-between">
                <AppText weight="semibold">Passing Score:</AppText>
                <AppText>{data.passingScore}</AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText weight="semibold">Max Retakes:</AppText>
                <AppText>{data.maxRetake}</AppText>
              </View>
            </View>
          </View>
        </View>
        <AssessmentResult
          assessmentData={assessmentData}
          isLoading={isAssessmentLoading}
        />
        {!maxRetakesReached && (
          <Button isDisabled={disableButton} onPress={handleStartAssessment}>
            <Button.Label>Start Assessment</Button.Label>
          </Button>
        )}
      </ScrollView>
    </Screen>
  );
};

export default AssessmentDetailsScreen;
