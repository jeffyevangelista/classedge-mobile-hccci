import { useFormattedDate } from "@/hooks/userFormattedDate";
import { Assessment } from "../oversight.type";
import { Link } from "expo-router";
import { Card } from "heroui-native";
import { View } from "react-native";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";

const getActivityIcon = (activityType: string) => {
  const iconMap = {
    Assignment: {
      label: "Assignment",
    },
    Exam: {
      label: "Exam",
    },
    SpecialActivity: {
      label: "Special Activity",
    },
    Quiz: {
      label: "Quiz",
    },
    Participation: {
      label: "Participation",
    },
  };
  return iconMap[activityType as keyof typeof iconMap] || iconMap.Assignment;
};

const CourseworkItem = ({
  activity_name,
  activity_type_name,
  end_time,
  id,
  attempts,
}: Assessment) => {
  const { label } = getActivityIcon(activity_type_name);

  const formattedDate = end_time ? useFormattedDate(end_time, true) : null;

  // Calculate urgency
  const getUrgency = () => {
    if (!end_time) return null;

    // Don't show urgency badge if there are attempts
    if (attempts?.length > 0) {
      return null;
    }

    const now = new Date();
    const dueDate = new Date(end_time);
    const hoursUntilDue =
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue < 0) {
      return { label: "Overdue", color: "text-red-600" };
    }
    if (hoursUntilDue < 24) {
      return { label: "Due today", color: "text-orange-600" };
    }
    return null;
  };

  const urgency = getUrgency();

  return (
    <Link href={`/activity/${id}`} className="mt-2.5 max-w-3xl mx-auto w-full">
      <Card className="shadow-none rounded-lg flex-row items-center active:bg-orange-50/50 dark:bg-neutral-800/50 dark:active:bg-orange-900/20">
        <View className="flex-row gap-2 flex-1">
          <View className="rounded-full p-2.5 bg-orange-50 dark:bg-orange-900/50">
            <Icon
              className="h-6 w-6 text-orange-600 dark:text-orange-400"
              name="ClipboardIcon"
            />
          </View>
          <View className="flex-1">
            <AppText
              className="text-neutral-900 dark:text-neutral-100 font-poppins-semibold text-lg flex-1"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label}: {activity_name}
            </AppText>
            <View className="flex-row gap-1 items-center">
              <AppText
                className="text-neutral-500 dark:text-neutral-400 text-xs"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Due {formattedDate}
              </AppText>
              {/* {urgency && (
                <Badge
                  size="sm"
                  variant="solid"
                  className={
                    urgency.color === "text-red-600"
                      ? "bg-red-100"
                      : "bg-orange-100"
                  }
                >
                  <BadgeText className={`${urgency.color} text-2xs`}>
                    {urgency.label}
                  </BadgeText>
                </Badge>
              )} */}
            </View>
          </View>
        </View>
      </Card>
    </Link>
  );
};

export default CourseworkItem;
