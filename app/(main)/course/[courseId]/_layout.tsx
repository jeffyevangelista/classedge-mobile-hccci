import React from "react";
import { Stack, useRouter } from "expo-router";
import BackButton from "@/components/BackButton";
import { Platform, Pressable } from "react-native";
import { Button } from "heroui-native";
import { Icon } from "@/components/Icon";
import { InfoIcon } from "phosphor-react-native";
import CourseDetailsSheet from "@/features/courses/components/CourseDetailsSheet";

const CourseDetailsLayout = () => {
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerRight: () => <CourseDetailsSheet />,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
};

export default CourseDetailsLayout;
