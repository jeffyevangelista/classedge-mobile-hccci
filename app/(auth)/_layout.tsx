import BackButton from "@/components/BackButton";
import { colors } from "@/utils/colors";
import { Stack } from "expo-router";

const AuthLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.backgroundColor,
        },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="login-email"
        options={{
          headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
          headerTitle: "",
        }}
      />
      <Stack.Screen
        name="forgot-password/index"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="forgot-password/otp-verification"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="forgot-password/password-reset"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="forgot-password/reset-success"
        options={{ headerShown: false }}
      />
    </Stack>
  );
};

export default AuthLayout;
