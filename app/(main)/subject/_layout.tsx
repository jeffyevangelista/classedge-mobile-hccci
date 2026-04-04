import { View, Text } from "react-native";
import React from "react";
import { Stack } from "expo-router";
import BackButton from "@/components/BackButton";

const SubjectLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
      }}
    >
      <Stack.Screen name="[subjectId]" options={{ headerShown: false }} />
    </Stack>
  );
};

export default SubjectLayout;
