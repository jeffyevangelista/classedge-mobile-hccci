import { Stack } from "expo-router";
import BackButton from "@/components/BackButton";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const ClassroomLayout = () => {
  const headerOptions = useThemedHeaderOptions();

  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerTitleAlign: "left",
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerTitle: "",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="create-activity"
        options={{
          headerTitle: "New in-class assessment",
        }}
      />
      <Stack.Screen
        name="input-grades/[activityId]"
        options={{
          headerTitle: "Input Grades",
        }}
      />
      <Stack.Screen name="course-details" />
    </Stack>
  );
};

export default ClassroomLayout;
