import { ActivityIndicator, View } from "react-native";

// This screen exists solely to prevent an "unmatched route" error
// when the OAuth redirect returns via the classedge:// scheme.
// Navigation is handled by useMsLogin's onSuccess after tokens are stored.
export default function AuthCallback() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
