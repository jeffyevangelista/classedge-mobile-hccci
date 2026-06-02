import { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";
import useStore from "@/lib/store";
import { cancelOAuth, handleCallbackUrl } from "@/features/auth/authService";
import { getApiErrorMessage } from "@/lib/api-error";

const phaseLabel: Record<string, string> = {
  idle: "Just a moment…",
  opening_browser: "Opening Microsoft…",
  awaiting_user: "Waiting for Microsoft…",
  exchanging_code: "Verifying your account…",
  exchanging_session: "Setting up your session…",
};

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; state?: string }>();
  const oauthPhase = useStore((s) => s.oauthPhase);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallScreen = height < 700;
  const [error, setError] = useState<string | null>(null);
  const wasInFlight = useRef(false);

  // Stray navigation guard: Expo Router may navigate to this route on a
  // partial redirect (e.g., Android sends `classedge.dev://auth/callback`
  // with no query when the user presses back in the browser). If we mount
  // without a `code` param, this isn't a real OAuth callback — bounce back
  // to login immediately so the "Signing you in" UI never flashes.
  useEffect(() => {
    if (!params.code) {
      router.replace("/login");
    }
  }, [params.code]);

  useEffect(() => {
    if (!params.code) return;

    // Reconstruct the deep-link URL for the service. Include `state` so
    // handleCallbackUrl can look up the per-flow PKCE verifier; without it
    // the service silently no-ops as a "stale URL".
    const stateSegment = params.state
      ? `&state=${encodeURIComponent(params.state)}`
      : "";
    const url = `classedge://auth/callback?code=${encodeURIComponent(
      params.code,
    )}${stateSegment}`;

    handleCallbackUrl(url).catch((err) => {
      setError(getApiErrorMessage(err));
    });
  }, [params.code]);

  // Detect cancellation (e.g., 30s timeout): we were in a non-idle phase, the
  // phase reset to idle, no error surfaced, AND we're not authenticated — that
  // means the watchdog (or another cancelOAuth caller) reset us. Route back to
  // login. The isAuthenticated check is critical: on success, phase also flips
  // to idle, but isAuthenticated becomes true and the root layout's
  // Stack.Protected handles the transition to (main); we must NOT navigate to
  // /login then or the user sees a flash of LoginScreen before the swap.
  useEffect(() => {
    if (oauthPhase !== "idle") {
      wasInFlight.current = true;
      return;
    }
    if (wasInFlight.current && !error && !isAuthenticated) {
      wasInFlight.current = false;
      router.replace("/login");
    }
  }, [oauthPhase, error, isAuthenticated]);

  const handleTryAgain = () => {
    cancelOAuth();
    setError(null);
    router.replace("/login");
  };

  // No code param → render nothing while the stray-navigation guard above
  // fires `router.replace("/login")`. Prevents the "Signing you in" flash.
  if (!params.code) return null;

  if (error) {
    return (
      <View
        accessibilityRole="alert"
        className="flex-1 bg-background"
        style={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 20,
        }}
      >
        <View className="flex-1 items-center justify-center w-full max-w-md mx-auto gap-6">
          <View
            className="rounded-full p-4"
            style={{ backgroundColor: `${dangerColor}1A` }}
          >
            <Icon
              name="WarningCircleIcon"
              size={48}
              color={dangerColor}
            />
          </View>
          <View className="items-center gap-2">
            <AppText
              weight="semibold"
              className="text-2xl sm:text-3xl text-foreground text-center"
            >
              Sign-in failed
            </AppText>
            <AppText className="text-sm text-muted text-center">
              {error}
            </AppText>
          </View>
          <Button
            className="w-full mt-4"
            variant="primary"
            size="lg"
            onPress={handleTryAgain}
          >
            <Button.Label>Try again</Button.Label>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 20,
      }}
    >
      <View className="flex-1 items-center justify-center w-full max-w-md mx-auto">
        <Image
          source={require("@/assets/logo.png")}
          className={isSmallScreen ? "w-20 h-20" : "w-28 h-28"}
          contentFit="contain"
        />
        <AppText
          weight="semibold"
          className="text-2xl sm:text-3xl mt-4 text-foreground text-center"
        >
          Signing you in
        </AppText>
        <AppText className="text-xs text-muted text-center mt-1">
          {phaseLabel[oauthPhase] ?? "Just a moment…"}
        </AppText>
        <View className="mt-10">
          <Spinner color={accentColor} />
        </View>
      </View>
    </View>
  );
}
