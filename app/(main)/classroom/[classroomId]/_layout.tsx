import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import BackButton from "@/components/BackButton";
import { Platform, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const ClassroomLayout = () => {
  const { classroomId } = useLocalSearchParams();
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
          headerRight: ({ tintColor }) => {
            const router = useRouter();
            return (
              <Pressable
                onPress={() =>
                  router.push(`/(main)/classroom/${classroomId}/course-details`)
                }
                className="w-11 h-11 rounded-full flex justify-center items-center"
              >
                <Icon
                  name="InfoIcon"
                  size={24}
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
