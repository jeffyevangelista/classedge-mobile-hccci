import { Stack } from "expo-router";

const OnboardingLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
};

export default OnboardingLayout;
