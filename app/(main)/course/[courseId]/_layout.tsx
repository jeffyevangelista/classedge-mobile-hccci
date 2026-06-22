import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Platform, Pressable } from "react-native";
import BackButton from "@/components/BackButton";
import { Icon } from "@/components/Icon";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const CourseDetailsLayout = () => {
  const { courseId } = useLocalSearchParams();
  const router = useRouter();
  const headerOptions = useThemedHeaderOptions();

  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerTitle: "",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          headerRight: ({ tintColor }) => (
            <Pressable
              onPress={() =>
                router.push(`/(main)/course/${courseId}/course-details`)
              }
              className="w-9 h-9 rounded-full flex justify-center items-center"
            >
              <Icon
                name="InfoIcon"
                color={tintColor}
                style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
              />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="course-details"
        options={{
          headerTitle: "Course Details",
        }}
      />
    </Stack>
  );
};

export default CourseDetailsLayout;
