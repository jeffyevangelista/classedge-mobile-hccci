import { ActivityIndicator, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

// Ensure the auth session completes when the OAuth redirect lands here.
WebBrowser.maybeCompleteAuthSession();

// This screen exists solely to prevent an "unmatched route" error
// when the OAuth redirect returns via the classedge:// scheme.
// It is placed inside the !isAuthenticated Stack.Protected guard so
// Expo Router automatically redirects to (onboarding) or (main) once
// the token exchange (driven by MSAuthButton) sets isAuthenticated = true.
// No manual navigation or timeout needed — useMsLogin handles errors
// via onError (clears credentials + shows toast).
export default function AuthCallback() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
