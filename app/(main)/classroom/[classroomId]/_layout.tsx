import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Select } from "heroui-native";
import { Platform, Pressable, View } from "react-native";
import BackButton from "@/components/BackButton";
import { Icon } from "@/components/Icon";
import { useClassroom } from "@/features/classroom/classroom.hooks";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const ClassroomLayout = () => {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const router = useRouter();
  const headerOptions = useThemedHeaderOptions();
  const { data } = useClassroom(classroomId);
  const subjectName = data?.[0]?.subjectName ?? "";

  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerTitle: "",
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{
          headerTitle: subjectName,
          headerRight: ({ tintColor }) => (
            <View className="flex-row items-center gap-1">
              <Select
                onValueChange={(v) => {
                  const value = Array.isArray(v) ? v[0]?.value : v?.value;
                  if (value === "activity") {
                    router.push(
                      `/(main)/classroom/${classroomId}/create-activity`,
                    );
                  }
                }}
              >
                <Select.Trigger
                  variant="unstyled"
                  className="w-9 h-9 rounded-full justify-center items-center"
                >
                  <Icon name="PlusIcon" color={tintColor} />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="popover">
                    <Select.Item value="activity" label="Create Activity" />
                  </Select.Content>
                </Select.Portal>
              </Select>
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
            </View>
          ),
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
