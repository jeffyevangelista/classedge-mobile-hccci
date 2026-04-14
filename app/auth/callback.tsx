import useStore from "@/lib/store";
import { useRouter, type RelativePathString } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

// Ensure the auth session completes when the OAuth redirect lands here.
WebBrowser.maybeCompleteAuthSession();

// This screen exists solely to prevent an "unmatched route" error
// when the OAuth redirect returns via the classedge:// scheme.
// It waits for the token exchange (driven by MSAuthButton) to finish,
// then navigates directly to (main) — avoiding a flash of the login screen.
export default function AuthCallback() {
  const router = useRouter();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (hasNavigated.current) return;

    if (isAuthenticated) {
      // Auth succeeded — go straight to main
      hasNavigated.current = true;
      router.replace("/" as RelativePathString);
      return;
    }

    // Fallback: if the token exchange doesn't complete within 10s,
    // return to login so the user can retry.
    const timeout = setTimeout(() => {
      if (!hasNavigated.current && !useStore.getState().isAuthenticated) {
        hasNavigated.current = true;
        router.replace("/(auth)/login" as RelativePathString);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isAuthenticated]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
