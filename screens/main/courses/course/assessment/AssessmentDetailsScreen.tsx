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
import { Button, Skeleton, useToast } from "heroui-native";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import AssessmentResult from "@/features/assessment/components/AssessmentResult";
import {
  getAttemptRecords,
  getQuestions,
  startAssessmentAttempt,
} from "@/features/assessment/assessment.service";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AssessmentDetailsScreen = () => {
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
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

  if (isLoading) return <AssessmentDetailsSkeleton />;
  if (isError) return <ErrorFallback message={error.message} />;
  if (!data)
    return (
      <NoDataFallback
        title="Assessment not found"
        description="The assessment you're looking for doesn't exist"
      />
    );

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

      router.replace({
        pathname: "/(main)/attempt/[attemptId]",
        params: { attemptId: result[0].localId },
      });
    } catch (error) {
      toast.show({
        label: "Error",
        description: "Failed to start attempt",
        variant: "danger",
      });
    }
  };

  const disableButton = new Date(data.endTime) < new Date();
  const maxRetakesReached = (assessmentAttempts?.length ?? 0) >= data.maxRetake;

  return (
    <Screen className="max-w-3xl mx-auto w-full bg-white dark:bg-neutral-900 pb-2.5 ">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-6 p-4">
          <View>
            <AppText className="text-sm text-neutral-500 dark:text-neutral-400">
              Due {formatDate(data.endTime)}
            </AppText>
            <AppText
              weight="semibold"
              className="text-xl text-neutral-900 dark:text-neutral-100 mt-1"
            >
              {data.activityName}
            </AppText>
          </View>

          <View>
            <AppText
              weight="semibold"
              className="text-base text-neutral-900 dark:text-neutral-100 mb-2"
            >
              Details
            </AppText>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <AppText className="text-neutral-500 dark:text-neutral-400">
                  Time Duration
                </AppText>
                <AppText className="text-neutral-900 dark:text-neutral-100">
                  {data.timeDuration} min
                </AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText className="text-neutral-500 dark:text-neutral-400">
                  Passing Score
                </AppText>
                <AppText className="text-neutral-900 dark:text-neutral-100">
                  {data.passingScore}
                </AppText>
              </View>
              <View className="flex-row justify-between">
                <AppText className="text-neutral-500 dark:text-neutral-400">
                  Max Retakes
                </AppText>
                <AppText className="text-neutral-900 dark:text-neutral-100">
                  {data.maxRetake}
                </AppText>
              </View>
            </View>
          </View>

          <AssessmentResult
            assessmentData={assessmentData}
            isLoading={isAssessmentLoading}
          />
        </View>
      </ScrollView>
      {!maxRetakesReached && (
        <View
          className="p-4 bg-white dark:bg-neutral-900"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Button isDisabled={disableButton} onPress={handleStartAssessment}>
            <Button.Label>Start Assessment</Button.Label>
          </Button>
        </View>
      )}
    </Screen>
  );
};

const AssessmentDetailsSkeleton = () => (
  <Screen className="max-w-3xl mx-auto w-full bg-white dark:bg-neutral-900 pb-2.5">
    <View className="gap-6 p-4">
      <View>
        <Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton className="h-6 w-3/4 rounded-full mt-2" />
      </View>
      <View className="gap-2">
        <Skeleton className="h-4 w-16 rounded-full mb-1" />
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <View key={i} className="flex-row justify-between">
              <Skeleton className="h-3 w-28 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </View>
          ))}
      </View>
      <View className="gap-2">
        <Skeleton className="h-4 w-20 rounded-full" />
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
      </View>
    </View>
  </Screen>
);

export default AssessmentDetailsScreen;
