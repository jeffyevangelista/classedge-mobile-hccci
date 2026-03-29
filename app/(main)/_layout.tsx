import BackButton from "@/components/BackButton";
import TabsHeader from "@/components/TabsHeader";
import { Stack } from "expo-router";

const MainLayout = () => {
  return (
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
          // headerTitle: "",
          headerShadowVisible: false,
          headerLeft: () => <BackButton />,
        }}
        name="assessment/[assessmentId]/index"
      />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "",
          headerShadowVisible: false,
          headerLeft: () => <BackButton />,
        }}
        name="material/[materialId]/index"
      />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "",
          headerShadowVisible: false,
        }}
        name="attempt/[attemptId]/index"
      />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "",
          headerShadowVisible: false,
        }}
        name="lesson/[lessonId]/index"
      />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "",
          headerShadowVisible: false,
        }}
        name="activity/[activityId]/index"
      />

      <Stack.Screen name="classroom" />
    </Stack>
  );
};

export default MainLayout;
