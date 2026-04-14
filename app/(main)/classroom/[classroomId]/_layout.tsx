import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import BackButton from "@/components/BackButton";
import { Platform, Pressable } from "react-native";
import { Icon } from "@/components/Icon";

const ClassroomLayout = () => {
  const { classroomId } = useLocalSearchParams();

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
          headerRight: ({ tintColor }) => {
            const router = useRouter();
            return (
              <Pressable
                onPress={() =>
                  router.push(`/(main)/classroom/${classroomId}/course-details`)
                }
                className="w-9 h-9 rounded-full flex justify-center items-center"
              >
                <Icon
                  name="InfoIcon"
                  color={tintColor}
                  style={{ marginLeft: Platform.OS === "ios" ? -2 : 0 }}
                />
              </Pressable>
            );
          },
        }}
      />
      <Stack.Screen
        name="create-activity"
        options={{
          headerTitle: "Create Activity",
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
