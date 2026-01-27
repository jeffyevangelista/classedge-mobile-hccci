import { Stack } from "expo-router";
import BackButton from "@/components/BackButton";

const CourseLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
      }}
    >
      <Stack.Screen name="[courseId]" />
      <Stack.Screen name="course-details" />
    </Stack>
  );
};

export default CourseLayout;
