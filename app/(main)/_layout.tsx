import BackButton from "@/components/BackButton";
import { SyncSheetProvider } from "@/features/sync/SyncSheetContext";
import SyncSheet from "@/features/sync/components/SyncSheet";
import { Stack } from "expo-router";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const MainLayout = () => {
  const headerOptions = useThemedHeaderOptions();
  const transparentHeaderOptions = useThemedHeaderOptions({ transparent: true });

  const emptyTitleHeader = {
    ...transparentHeaderOptions,
    headerShown: true,
    headerTitle: "",
    headerLeft: ({ tintColor }: { tintColor?: string }) => (
      <BackButton tintColor={tintColor} />
    ),
  };

  return (
    <SyncSheetProvider>
      <Stack screenOptions={{ ...headerOptions, headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="course" />
        <Stack.Screen name="subject" />
        <Stack.Screen
          options={emptyTitleHeader}
          name="assessment/[assessmentId]/index"
        />
        <Stack.Screen
          options={emptyTitleHeader}
          name="material/[materialId]/index"
        />
        <Stack.Screen
          options={emptyTitleHeader}
          name="attempt/[attemptId]/index"
        />
        <Stack.Screen
          options={emptyTitleHeader}
          name="attempt/[attemptId]/review"
        />
        <Stack.Screen
          options={emptyTitleHeader}
          name="lesson/[lessonId]/index"
        />
        <Stack.Screen
          options={emptyTitleHeader}
          name="activity/[activityId]/index"
        />
        <Stack.Screen
          options={{ ...emptyTitleHeader, headerTitle: "Announcements" }}
          name="announcement/index"
        />
        <Stack.Screen
          options={emptyTitleHeader}
          name="announcement/[announcementId]/index"
        />
        <Stack.Screen
          options={emptyTitleHeader}
          name="event/[eventId]/index"
        />

        <Stack.Screen name="classroom" />
        <Stack.Screen
          name="camera"
          options={{
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
      <SyncSheet />
    </SyncSheetProvider>
  );
};

export default MainLayout;
