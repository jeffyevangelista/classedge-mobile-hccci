import React from "react";
import { Stack } from "expo-router";
import BackButton from "@/components/BackButton";
import { Platform } from "react-native";

const CourseDetailsLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerLeft:
          Platform.OS === "ios"
            ? ({ tintColor }) => <BackButton tintColor={tintColor} />
            : undefined,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
};

export default CourseDetailsLayout;
