import useStore from "@/lib/store";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

// This screen exists solely to prevent an "unmatched route" error
// when the OAuth redirect returns via the classedge:// scheme.
// Navigation is handled by useMsLogin's onSuccess after tokens are stored.
export default function AuthCallback() {
  const router = useRouter();
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      const timeout = setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(auth)/login");
        }
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
