import { View } from "react-native";
import Screen from "@/components/screen";
import { AppText } from "@/components/AppText";
import { useClassroomActivity } from "@/features/classroom/classroom.hooks";
import StudentScoringList, {
  StudentScoringSkeleton,
} from "@/features/classroom/components/StudentScoringList";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";

const InputGradeScreen = () => {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();

  const parentNavigation = useNavigation("/(main)/classroom/[classroomId]");

  const { data, isLoading, isError, error } = useClassroomActivity(
    activityId ?? "",
  );

  const activity = data?.[0];

  useEffect(() => {
    if (!activity?.activityName) return;
    const subtitle = [
      `Max ${activity.maxScore} pts`,
      activity.passingScore != null
        ? `Passing ${activity.passingScore}${
            activity.passingScoreType === "percentage" ? "%" : ""
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    parentNavigation.setOptions({
      headerTitle: () => (
        <View>
          <AppText
            weight="bold"
            numberOfLines={1}
            className="text-base text-foreground"
          >
            {activity.activityName}
          </AppText>
          {!!subtitle && (
            <AppText numberOfLines={1} className="text-xs text-foreground/70">
              {subtitle}
            </AppText>
          )}
        </View>
      ),
    });
  }, [
    activity?.activityName,
    activity?.maxScore,
    activity?.passingScore,
    activity?.passingScoreType,
    parentNavigation,
  ]);

  if (isLoading)
    return (
      <Screen>
        <StudentScoringSkeleton />
      </Screen>
    );

  if (isError)
    return (
      <View className="flex-1 px-2.5 pt-2.5">
        <ErrorFallback message={getApiErrorMessage(error)} />
      </View>
    );

  if (!activity)
    return (
      <View className="flex-1 px-2.5 pt-2.5">
        <NoDataFallback
          title="Activity not found"
          description="The activity you're looking for doesn't exist"
        />
      </View>
    );

  return (
    <Screen>
      <StudentScoringList activityDetail={activity} />
    </Screen>
  );
};

export default InputGradeScreen;
