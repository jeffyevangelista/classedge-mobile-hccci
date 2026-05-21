import BackButton from "@/components/BackButton";
import { SyncSheetProvider } from "@/features/sync/SyncSheetContext";
import SyncGate from "@/features/sync/components/SyncGate";
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
      <SyncGate>
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
            name="lesson/[lessonId]/index"
          />
          <Stack.Screen
            options={emptyTitleHeader}
            name="activity/[activityId]/index"
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
      </SyncGate>
      <SyncSheet />
    </SyncSheetProvider>
  );
};

export default MainLayout;
