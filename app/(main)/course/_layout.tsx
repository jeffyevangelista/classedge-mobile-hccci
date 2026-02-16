import { Stack } from "expo-router";
import BackButton from "@/components/BackButton";

const CourseLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
      }}
    >
      <Stack.Screen name="[courseId]" options={{ headerShown: false }} />
      <Stack.Screen name="course-details" />
    </Stack>
  );
};

export default CourseLayout;
