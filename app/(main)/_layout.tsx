import BackButton from "@/components/BackButton";
import { Stack } from "expo-router";

const MainLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="course" />
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
    </Stack>
  );
};

export default MainLayout;
