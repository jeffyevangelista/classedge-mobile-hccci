import { Link, Stack, useRouter, useLocalSearchParams } from "expo-router";
import BackButton from "@/components/BackButton";
import CourseDetailsSheet from "@/features/courses/components/CourseDetailsSheet";
import { Platform, Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { PressableFeedback } from "heroui-native";

const CourseDetailsLayout = () => {
  const { courseId } = useLocalSearchParams();

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
                  router.push(`/(main)/course/${courseId}/course-details`)
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

export default CourseDetailsLayout;
