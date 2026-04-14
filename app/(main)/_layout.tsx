import BackButton from "@/components/BackButton";
import TabsHeader from "@/components/TabsHeader";
import { SyncSheetProvider } from "@/features/sync/SyncSheetContext";
import SyncSheet from "@/features/sync/components/SyncSheet";
import { Stack } from "expo-router";

const MainLayout = () => {
  return (
    <SyncSheetProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: true,
            header: () => <TabsHeader />,
          }}
        />
        <Stack.Screen name="profile" />
        <Stack.Screen name="course" />
        <Stack.Screen name="subject" />
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "",
            headerShadowVisible: false,
            headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
          }}
          name="assessment/[assessmentId]/index"
        />
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "",
            headerShadowVisible: false,
            headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
          }}
          name="material/[materialId]/index"
        />
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "",
            headerShadowVisible: false,
            headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
          }}
          name="attempt/[attemptId]/index"
        />
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "",
            headerShadowVisible: false,
            headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
          }}
          name="lesson/[lessonId]/index"
        />
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "",
            headerShadowVisible: false,
            headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
          }}
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
      <SyncSheet />
    </SyncSheetProvider>
  );
};

export default MainLayout;
