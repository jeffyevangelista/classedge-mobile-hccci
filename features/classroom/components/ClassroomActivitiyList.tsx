import { View, Text } from "react-native";
import React from "react";
import { useClassroomActivities } from "../classroom.hooks";
import { Link, useLocalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import { FlashList } from "@shopify/flash-list";
import { Card, Skeleton } from "heroui-native";

const ClassroomActivitiyList = () => {
  const { classroomId } = useLocalSearchParams();
  const { data, isLoading } = useClassroomActivities(classroomId as string);
  if (isLoading) return <ActivityListSkeleton />;

  return (
    <FlashList
      renderItem={({ item }) => (
        <Link
          href={`/classroom/${classroomId}/input-grades/${item.localId}`}
          className="mb-2.5"
        >
          <Card className="rounded-xl shadow-none w-full">
            <AppText>{item.activityName}</AppText>
          </Card>
        </Link>
      )}
      data={data}
    />
  );
};

const ActivityListSkeleton = () => (
  <View className="gap-2.5 p-2.5">
    {Array(5)
      .fill(0)
      .map((_, i) => (
        <Card key={i} className="rounded-xl shadow-none w-full">
          <Skeleton className="h-4 w-3/4 rounded-full" />
        </Card>
      ))}
  </View>
);

export default ClassroomActivitiyList;
