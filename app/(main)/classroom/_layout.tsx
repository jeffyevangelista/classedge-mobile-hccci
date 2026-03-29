import { Stack } from "expo-router";

const ClassroomLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[classroomId]" />
    </Stack>
  );
};

export default ClassroomLayout;
