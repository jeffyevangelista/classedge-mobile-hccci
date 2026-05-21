import { formatDate } from "@/utils/formatDate";
import { Assessment } from "../oversight.type";
import { Link } from "expo-router";
import { Card } from "heroui-native";
import { View } from "react-native";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";

const ASSESSMENT_ICON_COLOR = "#f97316";

const getActivityIcon = (activityType: string) => {
  const iconMap = {
    Assignment: { label: "Assignment" },
    Exam: { label: "Exam" },
    SpecialActivity: { label: "Special Activity" },
    Quiz: { label: "Quiz" },
    Participation: { label: "Participation" },
  };
  return iconMap[activityType as keyof typeof iconMap] || iconMap.Assignment;
};

const CourseworkItem = ({
  activityName,
  activityTypeName,
  endTime,
  classroomMode,
  attempts,
  id,
}: Assessment) => {
  const { label } = getActivityIcon(activityTypeName);
  const formattedDate = endTime ? formatDate(endTime, true) : null;

  const isClassroomActivity = !!classroomMode;
  const hasSubmission = (attempts?.length ?? 0) > 0;
  const isOverdue =
    !isClassroomActivity &&
    !hasSubmission &&
    endTime != null &&
    new Date(endTime).getTime() < Date.now();

  return (
    <Link
      href={`/activity/${id}`}
      className="w-full max-w-3xl mx-auto mb-2.5 px-2.5"
    >
      <Card className="rounded-xl flex-row items-center gap-3 shadow-none">
        <View className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
          <Icon
            name="PencilLineIcon"
            size={24}
            color={ASSESSMENT_ICON_COLOR}
          />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {label}: {activityName}
          </AppText>
          <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
            <AppText className="text-xs text-muted">
              Due {formattedDate}
            </AppText>
            {isClassroomActivity ? (
              <View className="px-2 py-0.5 rounded-full bg-accent-soft">
                <AppText
                  weight="semibold"
                  className="text-[10px] text-accent"
                >
                  In class
                </AppText>
              </View>
            ) : hasSubmission ? (
              <View className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <AppText
                  weight="semibold"
                  className="text-[10px]"
                  style={{ color: "#10b981" }}
                >
                  Submitted
                </AppText>
              </View>
            ) : isOverdue ? (
              <View className="px-2 py-0.5 rounded-full bg-danger-soft">
                <AppText
                  weight="semibold"
                  className="text-[10px] text-danger"
                >
                  Overdue
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    </Link>
  );
};

export default CourseworkItem;
