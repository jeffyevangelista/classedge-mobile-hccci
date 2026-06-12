import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import BackButton from "@/components/BackButton";
import { Icon } from "@/components/Icon";
import { useClassroom } from "@/features/classroom/classroom.hooks";
import {
  CreateActionSheet,
  type CreateAction,
} from "@/features/classroom/components/CreateActionSheet";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const ClassroomLayout = () => {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const router = useRouter();
  const headerOptions = useThemedHeaderOptions();
  const { data } = useClassroom(classroomId);
  const subjectName = data?.[0]?.subjectName ?? "";
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // Adding a new "Create ..." flow is a one-liner here.
  const createActions: CreateAction[] = [
    {
      key: "activity",
      icon: "PencilLineIcon",
      label: "In-class activity",
      description: "You'll grade students manually after class.",
      onPress: () =>
        router.push(`/(main)/classroom/${classroomId}/create-activity`),
    },
  ];

  return (
    <>
    <Stack
      screenOptions={{
        ...headerOptions,
        // iOS centers headers by default; force left-alignment on both
        // platforms so the title sits right after the back button —
        // matches the Android convention and avoids the title getting
        // visually shoved by iOS's liquid-glass back-button capsule.
        headerTitleAlign: "left",
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
              <Pressable
                onPress={() => setCreateSheetOpen(true)}
                className="w-9 h-9 rounded-full flex justify-center items-center"
                accessibilityRole="button"
                accessibilityLabel="Create new"
              >
                <Icon name="PlusIcon" color={tintColor} />
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(`/(main)/classroom/${classroomId}/course-details`)
                }
                className="w-9 h-9 rounded-full flex justify-center items-center"
                accessibilityRole="button"
                accessibilityLabel="Class info"
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
          headerTitle: "New in-class activity",
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
    <CreateActionSheet
      isOpen={createSheetOpen}
      onOpenChange={setCreateSheetOpen}
      actions={createActions}
    />
    </>
  );
};

export default ClassroomLayout;
