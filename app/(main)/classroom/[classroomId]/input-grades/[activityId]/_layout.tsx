import { Stack } from "expo-router";

const InputGradesLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
};

export default InputGradesLayout;
