import "@/global.css";
import * as Sentry from "@sentry/react-native";
import { initTelemetry, armPostLoginReady, captureAuthMessage } from "@/lib/telemetry";
import * as Linking from "expo-linking";
import {
  cancelOAuth,
  handleCallbackUrl,
} from "@/features/auth/authService";
import { useTokenRefresh } from "@/features/auth/useTokenRefresh";
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
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import NetworkBanner from "@/features/network/NetworkBanner";
import "@azure/core-asynciterator-polyfill";

SplashScreen.preventAutoHideAsync();
initTelemetry();

function RootLayout() {
  const { restoreSession, clearCredentials, isAuthenticated, authUser } =
    useStore();
  const oauthPhase = useStore((s) => s.oauthPhase);
  const oauthStartedAt = useStore((s) => s.oauthStartedAt);
  useTokenRefresh();
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
    if (isAuthenticated) armPostLoginReady();
  }, [isAuthenticated]);

  // Cold-start: app launched via deep link (classedge://auth/callback?code=…)
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      if (url.includes("auth/callback") && url.includes("code=")) {
        captureAuthMessage("oauth_cold_start_recovery", {
          elapsedFromLaunchMs: 0,
        });
        handleCallbackUrl(url).catch((err) => {
          console.warn("[OAuth cold-start] handleCallbackUrl failed", err);
        });
      }
    });
  }, []);

  // Warm-app: deep link arrives while app is running
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (!url) return;
      if (url.includes("auth/callback") && url.includes("code=")) {
        handleCallbackUrl(url).catch((err) => {
          console.warn("[OAuth deep-link] handleCallbackUrl failed", err);
        });
      }
    });
    return () => subscription.remove();
  }, []);

  // Timeout watchdog: cancel OAuth if the user-facing phases persist past 30s.
  // Only watches `opening_browser` and `awaiting_user` — phases where the user
  // is interacting with the browser. Once we transition to `exchanging_code`
  // or `exchanging_session` the network call is in flight; cancelling there
  // would orphan the in-flight exchange and cause a transient `oauthPhase=idle`
  // that callback.tsx's cancel-detect effect misreads as a real cancellation,
  // briefly flashing LoginScreen before the eventual exchange success.
  useEffect(() => {
    const isUserFacingPhase =
      oauthPhase === "opening_browser" || oauthPhase === "awaiting_user";
    if (!isUserFacingPhase || !oauthStartedAt) return;
    const elapsed = Date.now() - oauthStartedAt;
    const remaining = 30_000 - elapsed;
    if (remaining <= 0) {
      captureAuthMessage("oauth_phase_timeout", {
        phase: oauthPhase,
        elapsedMs: elapsed,
      });
      cancelOAuth();
      return;
    }
    const timer = setTimeout(() => {
      captureAuthMessage("oauth_phase_timeout", {
        phase: oauthPhase,
        elapsedMs: 30_000,
      });
      cancelOAuth();
    }, remaining);
    return () => clearTimeout(timer);
  }, [oauthPhase, oauthStartedAt]);

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
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="auth/callback" />
          </Stack.Protected>
          <Stack.Protected
            guard={isAuthenticated && !!authUser?.legalUpdateRequired}
          >
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
          <Stack.Protected
            guard={isAuthenticated && !authUser?.legalUpdateRequired}
          >
            <Stack.Screen name="(main)" />
          </Stack.Protected>
        </Stack>
        <NetworkBanner />
      </RootProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
