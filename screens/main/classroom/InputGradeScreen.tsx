import { View } from "react-native";
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { useClassroomActivity } from "@/features/classroom/classroom.hooks";
import StudentScoringList from "@/features/classroom/components/StudentScoringList";
import { Card } from "heroui-native";
import { useGlobalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";

const InputGradeScreen = () => {
  const { activityId } = useGlobalSearchParams();

  const navigation = useNavigation();

  const { data, isLoading, isError, error } = useClassroomActivity(
    activityId as string,
  );

  const activity = data?.[0];

  useEffect(() => {
    if (activity?.activityName) {
      navigation.setOptions({ title: activity.activityName });
    }
  }, [activity?.activityName, navigation]);

  if (isLoading) {
    return <AppText>Loading...</AppText>;
  }

  if (isError) {
    return <AppText>{error.message}</AppText>;
  }

  if (!activity) {
    return <AppText>Activity not found</AppText>;
  }

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
            <AppText className="font-semibold">{activity.maxScore}</AppText>
          </View>
          <View className="gap-1">
            <AppText className="text-xs text-muted-foreground">
              Passing Score
            </AppText>
            <AppText className="font-semibold">
              {activity.passingScore}
              {activity.passingScoreType === "percentage" ? "%" : ""}
            </AppText>
          </View>
        </View>
      </Card>
      <StudentScoringList activityDetail={activity} />
    </Screen>
  );
};

export default InputGradeScreen;
