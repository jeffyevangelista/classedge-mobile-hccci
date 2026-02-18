import { Stack, useRouter } from "expo-router";
import BackButton from "@/components/BackButton";
import CourseDetailsSheet from "@/features/courses/components/CourseDetailsSheet";

const CourseDetailsLayout = () => {
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
