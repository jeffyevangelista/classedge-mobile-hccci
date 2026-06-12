import BackButton from "@/components/BackButton";
import { Stack } from "expo-router";
import { useThemedHeaderOptions } from "@/hooks/useThemedHeaderOptions";

const AuthLayout = () => {
  const headerOptions = useThemedHeaderOptions();
  const transparentHeaderOptions = useThemedHeaderOptions({ transparent: true });
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="login-email"
        options={{
          ...transparentHeaderOptions,
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
      <Stack.Screen
        name="legal/[docType]"
        options={{
          headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
          headerTitle: "",
        }}
      />
    </Stack>
  );
};

export default AuthLayout;
