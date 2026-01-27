import "@/global.css";
import useStore from "@/lib/store";
import RootProvider from "@/providers/RootProvider";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Spinner, useThemeColor } from "heroui-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const themeColorForeground = useThemeColor("foreground");
  const { restoreSession, clearCredentials, isAuthenticated } = useStore();
  const [sessionRestored, setSessionRestored] = useState(false);
  const [loaded, error] = useFonts({
    "Poppins-Regular": Poppins_400Regular,
    "Poppins-Medium": Poppins_500Medium,
    "Poppins-SemiBold": Poppins_600SemiBold,
    "Poppins-Bold": Poppins_700Bold,
    // Add only what you TRULY need for your design
  });

  const loadSession = async () => {
    try {
      await restoreSession();
      console.log("session restored");
    } catch (error) {
      console.warn("Session restore failed:", error);
      await clearCredentials();
    } finally {
      setSessionRestored(true);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if ((loaded || error) && sessionRestored) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, sessionRestored]);

  if ((!loaded && !error) || !sessionRestored) {
    return (
      <View
        style={{
          backgroundColor: "black",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <RootProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(main)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="dark" />
    </RootProvider>
  );
}
