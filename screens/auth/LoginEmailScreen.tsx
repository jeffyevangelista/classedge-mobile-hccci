import { AppText } from "@/components/AppText";
import LoginForm from "@/features/auth/components/LoginForm";
import { useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

const LoginEmailScreen = () => {
  const { height } = useWindowDimensions();
  const dynamicTopPadding = height * 0.1;
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        paddingTop: dynamicTopPadding,
        paddingHorizontal: 24,
      }}
      className="bg-background"
      keyboardShouldPersistTaps="handled"
    >
      <View className="w-full max-w-md mb-8 items-center">
        <AppText
          weight="semibold"
          className="text-2xl text-foreground mb-2 text-center"
        >
          Sign in with email
        </AppText>
        <AppText className="text-muted text-center">
          Enter your credentials to continue
        </AppText>
      </View>
      <LoginForm />
    </KeyboardAwareScrollView>
  );
};

export default LoginEmailScreen;
