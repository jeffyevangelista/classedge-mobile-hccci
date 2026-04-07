import { View } from "react-native";
import React, { useMemo } from "react";
import { useGlobalSearchParams } from "expo-router";
import {
  useClassroomStudents,
  useStudentScoresForActivity,
} from "@/features/classroom/classroom.hooks";
import { FlashList } from "@shopify/flash-list";
import { AppText } from "@/components/AppText";
import { Avatar, Card } from "heroui-native";
import { Icon } from "@/components/Icon";

type ActivityDetail = {
  localId: string;
  maxScore: number;
};

const ScoreDisplayList = ({
  activityDetail,
}: {
  activityDetail: ActivityDetail;
}) => {
  const { classroomId } = useGlobalSearchParams();

  const {
    data: students,
    isLoading,
    isError,
    error,
  } = useClassroomStudents(classroomId as string);

  const { data: existingScores } = useStudentScoresForActivity(
    activityDetail.localId,
  );

  const scoresMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (existingScores) {
      for (const score of existingScores) {
        map[score.studentId] = score.totalScore;
      }
    }
    return map;
  }, [existingScores]);

  if (isLoading) {
    return <AppText>Loading...</AppText>;
  }

  if (isError) {
    return <AppText>Error: {error?.message}</AppText>;
  }

  return (
    <FlashList
      className="max-w-3xl w-full mx-auto"
      data={students}
      renderItem={({ item }) => {
        const score = scoresMap[item.studentId];
        const isPassing =
          score !== undefined && score >= activityDetail.maxScore * 0.5;

        return (
          <Card className="rounded-xl items-center gap-2 mb-2 shadow-none flex-row">
            <Avatar alt="user-avatar">
              <Avatar.Image />
              <Avatar.Fallback>{item.studentId}</Avatar.Fallback>
            </Avatar>
            <AppText className="flex-1">{item.studentId}</AppText>
            <View className="flex-row items-center gap-2">
              <AppText className="font-semibold">
                {score !== undefined
                  ? `${score} / ${activityDetail.maxScore}`
                  : "—"}
              </AppText>
              {score !== undefined && (
                <Icon
                  name="CheckCircle"
                  size={18}
                  color={isPassing ? "#22c55e" : "#f59e0b"}
                />
              )}
            </View>
          </Card>
        );
      }}
      keyExtractor={(item) => item.studentId.toString()}
    />
  );
};

export default ScoreDisplayList;
