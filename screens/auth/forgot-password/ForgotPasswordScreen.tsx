import { StyleSheet, View, useWindowDimensions } from "react-native";
import ForgotPasswordForm from "@/features/auth/components/ForgotPasswordForm";
import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import ForgotPassword from "@/assets/illustrations/forgot-password/forgot-password.svg";

const ForgotPasswordScreen = () => {
  const { height, width } = useWindowDimensions();
  const verticalPadding = height > 800 ? 64 : 32;
  const router = useRouter();

  return (
    <Screen>
      <View
        style={{
          paddingVertical: verticalPadding,
          paddingBottom: verticalPadding / 2,
        }}
        className="flex-1 items-center justify-start px-6"
      >
        <ForgotPassword
          width={width * 0.7}
          height={height * 0.2}
          style={styles.image}
        />

        <AppText
          className="mb-2 text-center text-2xl text-gray-500"
          weight="semibold"
        >
          Forgot Password?
        </AppText>
        <AppText className="self-center text-center mb-8 text-gray-500">
          No worries! Enter you email address below and we'll send you reset
          instructions.
        </AppText>
        <ForgotPasswordForm />
        <Button
          variant="ghost"
          size="sm"
          className="mt-5"
          onPress={() => router.back()}
        >
          <Button.Label>Back to Login</Button.Label>
        </Button>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  image: { marginBottom: 40 },
});

export default ForgotPasswordScreen;
