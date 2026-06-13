import { Pressable, View } from "react-native";
import React from "react";
import { useClassroomActivities } from "../classroom.hooks";
import { Link, useGlobalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import { ScreenList } from "@/components/ScreenList";
import { Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/utils/formatDate";
import SyncingPill from "@/features/sync/components/SyncingPill";

type ClassroomActivity = {
  localId: string;
  activityName: string;
  endTime?: string | null;
  classroomMode?: boolean | number;
  attempts?: unknown[];
};

const ClassroomActivitiyList = () => {
  const { classroomId } = useGlobalSearchParams();
  const { data, isLoading, isError, error, refetch, isRefetching, isFetching } =
    useClassroomActivities(classroomId as string);

  // Skeleton during the initial fetch AND during a retry from the
  // error state — see features/classroom/components/LessonList for the
  // full rationale.
  if (isLoading || (isFetching && !data?.length))
    return (
      <View className="flex-1">
        <ActivityListSkeleton />
      </View>
    );
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );
  if (data.length === 0)
    return (
      <View className="flex-1">
        <NoDataFallback
          icon="SmileySad"
          title="No activities found"
          onRefetch={refetch}
        />
      </View>
    );

  return (
    <View className="flex-1">
      <ScreenList
        renderItem={({ item }) => (
          <ActivityItem
            activity={item}
            href={`/classroom/${classroomId}/input-grades/${item.localId}`}
          />
        )}
        data={data}
        refreshing={isRefetching}
        onRefresh={refetch}
        // `SyncingPill` rides inside the scroll content so its top gap
        // scrolls away with the rest of the list — same behavior as
        // the Materials / Courseworks tabs. `ScreenList` already trims
        // the bottom via `useScrollBottomInset`; the extra 8pt keeps
        // the last card off the home indicator.
        ListHeaderComponent={<SyncingPillRow />}
        contentContainerStyle={{ paddingBottom: 8 }}
      />
    </View>
  );
};

const SyncingPillRow = () => (
  <View className="px-2.5 pb-2">
    <SyncingPill priority={2} />
  </View>
);

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

  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Grade ${activity.activityName}`}
        android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
        className="w-full max-w-3xl mx-auto mb-1 px-3 active:opacity-80"
      >
        <View className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3">
          <View className="w-10 h-10 rounded-full items-center justify-center bg-accent-soft">
            <Icon name="PencilLineIcon" size={18} className="text-accent" />
          </View>
          <View className="flex-1 min-w-0">
            <AppText
              weight="semibold"
              className="text-[15px] text-foreground"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {activity.activityName}
            </AppText>
            <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
              {formattedDate ? (
                <AppText className="text-[11px] text-muted">
                  Due {formattedDate}
                </AppText>
              ) : null}
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
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
};

const ActivityListSkeleton = () => {
  // Width permutations match the LessonList / CourseworkList skeletons
  // so the three grading lists feel visually consistent while loading.
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-4/5", "w-1/2"] as const;
  return (
    <View>
      {widths.map((titleWidth, i) => (
        <View key={i} className="w-full max-w-3xl mx-auto px-3 mb-1">
          <View className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <View className="flex-1">
              <Skeleton className={`h-[18px] ${titleWidth} rounded`} />
              <View style={{ height: 2 }} />
              <Skeleton className="h-[14px] w-44 rounded" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export default ClassroomActivitiyList;
