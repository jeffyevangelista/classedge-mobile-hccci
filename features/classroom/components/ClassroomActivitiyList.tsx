import { View } from "react-native";
import React from "react";
import { useClassroomActivities } from "../classroom.hooks";
import { Link, useGlobalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import { FlashList } from "@shopify/flash-list";
import { Card, Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/utils/formatDate";

const ASSESSMENT_ICON_COLOR = "#f97316";

type ClassroomActivity = {
  localId: string;
  activityName: string;
  endTime?: string | null;
  classroomMode?: boolean | number;
  attempts?: unknown[];
};

const ClassroomActivitiyList = () => {
  const { classroomId } = useGlobalSearchParams();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useClassroomActivities(classroomId as string);

  if (isLoading) return <ActivityListSkeleton />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );
  if (data.length === 0)
    return (
      <NoDataFallback
        icon="SmileySad"
        title="No activities found"
        onRefetch={refetch}
      />
    );

  return (
    <FlashList
      renderItem={({ item }) => (
        <ActivityItem
          activity={item}
          href={`/classroom/${classroomId}/input-grades/${item.localId}`}
        />
      )}
      data={data}
      refreshing={isRefetching}
      onRefresh={refetch}
    />
  );
};

type ActivityItemProps = {
  activity: ClassroomActivity;
  href: string;
};

const ActivityItem = ({ activity, href }: ActivityItemProps) => {
  const formattedDate = activity.endTime
    ? formatDate(activity.endTime, true)
    : null;
  const isClassroomActivity = !!activity.classroomMode;
  const hasSubmission = (activity.attempts?.length ?? 0) > 0;
  const isOverdue =
    !isClassroomActivity &&
    !hasSubmission &&
    activity.endTime != null &&
    new Date(activity.endTime).getTime() < Date.now();

  return (
    <Link
      href={href as never}
      className="w-full max-w-3xl mx-auto mb-2.5 px-2.5"
    >
      <Card className="rounded-xl flex-row items-center gap-3 shadow-none">
        <View className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
          <Icon name="PencilLineIcon" size={24} color={ASSESSMENT_ICON_COLOR} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {activity.activityName}
          </AppText>
          <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
            {formattedDate && (
              <AppText className="text-xs text-muted">
                Due {formattedDate}
              </AppText>
            )}
            {isClassroomActivity ? (
              <View className="px-2 py-0.5 rounded-full bg-accent-soft">
                <AppText weight="semibold" className="text-[10px] text-accent">
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

const ActivityListSkeleton = () => (
  <View className="gap-2.5">
    {Array(5)
      .fill(0)
      .map((_, i) => (
        <View key={i} className="w-full max-w-3xl mx-auto px-2.5">
          <Card className="rounded-xl flex-row items-center gap-3 shadow-none">
            <Skeleton className="w-10 h-10 rounded-full" />
            <View className="flex-1 gap-1.5">
              <Skeleton className="h-5 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </View>
          </Card>
        </View>
      ))}
  </View>
);

export default ClassroomActivitiyList;
