import { View } from "react-native";
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import {
  useClassroomActivity,
  useStudentScoresForActivity,
} from "@/features/classroom/classroom.hooks";
import StudentScoringList from "@/features/classroom/components/StudentScoringList";
import ScoreDisplayList from "@/features/classroom/components/ScoreDisplayList";
import { Card, Skeleton } from "heroui-native";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { useGlobalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";

const InputGradeScreen = () => {
  const { activityId } = useGlobalSearchParams();

  const navigation = useNavigation();

  const { data, isLoading, isError, error } = useClassroomActivity(
    activityId as string,
  );

  const activity = data?.[0];

  const { data: existingScores, isLoading: scoresLoading } =
    useStudentScoresForActivity(activity?.localId ?? "");

  const hasExistingScores = !scoresLoading && (existingScores?.length ?? 0) > 0;

  useEffect(() => {
    if (activity?.activityName) {
      navigation.setOptions({ title: activity.activityName });
    }
  }, [activity?.activityName, navigation]);

  if (isLoading) return <InputGradeSkeleton />;

  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;

  if (!activity)
    return (
      <NoDataFallback
        title="Activity not found"
        description="The activity you're looking for doesn't exist"
      />
    );

  console.log(activity);

  return (
    <Screen>
      <Card className="rounded-xl p-4 mb-4 shadow-none gap-2 w-full max-w-3xl mx-auto mt-2.5">
        <AppText className="text-sm text-muted-foreground">
          {activity.activityInstruction}
        </AppText>
        <View className="flex-row justify-between">
          <View className="gap-1">
            <AppText className="text-xs text-muted-foreground">
              Max Score
            </AppText>
            <AppText weight="semibold">{activity.maxScore}</AppText>
          </View>
          <View className="gap-1">
            <AppText className="text-xs text-muted-foreground">
              Passing Score
            </AppText>
            <AppText weight="semibold">
              {activity.passingScore}
              {activity.passingScoreType === "percentage" ? "%" : ""}
            </AppText>
          </View>
        </View>
      </Card>
      {hasExistingScores ? (
        <ScoreDisplayList activityDetail={activity} />
      ) : (
        <StudentScoringList activityDetail={activity} />
      )}
    </Screen>
  );
};

const InputGradeSkeleton = () => (
  <Screen>
    <Card className="rounded-xl p-4 mb-4 shadow-none gap-3 w-full max-w-3xl mx-auto mt-2.5">
      <Skeleton className="h-3 w-full rounded-full" />
      <View className="flex-row justify-between">
        <View className="gap-1">
          <Skeleton className="h-2 w-16 rounded-full" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </View>
        <View className="gap-1">
          <Skeleton className="h-2 w-20 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </View>
      </View>
    </Card>
    <View className="max-w-3xl w-full mx-auto gap-2 px-2.5">
      {Array(6)
        .fill(0)
        .map((_, i) => (
          <Card
            key={i}
            className="rounded-xl items-center gap-2 shadow-none flex-row"
          >
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full flex-1" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </Card>
        ))}
    </View>
  </Screen>
);

export default InputGradeScreen;
