import { View, Text } from "react-native";
import React from "react";
import Screen from "@/components/screen";
import CourseTimeline from "@/features/courses/components/CourseTimeline";

const CourseScreen = () => {
  return (
    <Screen withPadding>
      <CourseTimeline />
    </Screen>
  );
};

export default CourseScreen;
