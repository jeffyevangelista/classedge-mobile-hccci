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
    </Stack>
  );
};

export default AuthLayout;
