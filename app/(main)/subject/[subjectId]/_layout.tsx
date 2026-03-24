import { View, Text, Pressable, Platform } from "react-native";
import React from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import BackButton from "@/components/BackButton";
import { Icon } from "@/components/Icon";

const SubjectLayout = () => {
  const { subjecdtId } = useLocalSearchParams();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerTitle: "",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerRight: () => {
            const router = useRouter();
            return (
              <Pressable
                onPress={() =>
                  router.push(`/(main)/course/${subjecdtId}/course-details`)
                }
                className="w-9 h-9 rounded-full flex justify-center items-center"
              >
                <Icon
                  name="InfoIcon"
                  style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
                />
              </Pressable>
            );
          },
        }}
      />
      <Stack.Screen name="course-details" />
    </Stack>
  );
};

export default SubjectLayout;
