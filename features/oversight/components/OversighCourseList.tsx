import { View, Text } from "react-native";
import React from "react";
import { useOversightCourses } from "../oversight.hooks";
import { AppText } from "@/components/AppText";

const OversighCourseList = () => {
  const { data, isLoading, isError, error } = useOversightCourses();

  if (isLoading) return <AppText>loading...</AppText>;
  if (isError) return <AppText>{error.message}</AppText>;

  console.log(data);

  return (
    <View>
      <Text>{JSON.stringify(data)}</Text>
    </View>
  );
};

export default OversighCourseList;
