import { Stack, useRouter } from "expo-router";
import BackButton from "@/components/BackButton";
import CourseDetailsSheet from "@/features/courses/components/CourseDetailsSheet";

const CourseDetailsLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerRight: () => <CourseDetailsSheet />,
        headerStyle: {
          backgroundColor: "#f9f9f9",
        },
        headerTitle: "",
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
};

export default CourseDetailsLayout;
