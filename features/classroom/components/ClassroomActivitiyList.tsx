import { View, Text } from "react-native";
import React from "react";
import { useClassroomActivities } from "../classroom.hooks";
import { Link, useLocalSearchParams } from "expo-router";
import { AppText } from "@/components/AppText";
import { FlashList } from "@shopify/flash-list";
import { Card } from "heroui-native";

const ClassroomActivitiyList = () => {
  const { classroomId } = useLocalSearchParams();
  const { data, isLoading } = useClassroomActivities(classroomId as string);
  if (isLoading) return <AppText>loading...</AppText>;

  console.log(JSON.stringify({ data }));

  return (
    <FlashList
      renderItem={({ item }) => (
        <Link href={"/"} className="mb-2.5">
          <Card className="rounded-lg shadow-none w-full">
            <AppText>{item.activityName}</AppText>
          </Card>
        </Link>
      )}
      data={data}
    />
  );
};

export default ClassroomActivitiyList;
