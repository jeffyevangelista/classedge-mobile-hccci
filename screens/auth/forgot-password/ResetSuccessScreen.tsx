import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import Success from "@/assets/illustrations/forgot-password/success.svg";
import AuthIllustrationLayout from "@/components/AuthIllustrationLayout";

const ResetSuccessScreen = () => {
  const router = useRouter();

  return (
    <AuthIllustrationLayout
      Illustration={Success}
      title="Reset Password Success"
      description="You can now use your new password to login to your account."
      animateIllustration
    >
      <Button onPress={() => router.dismissTo("/(auth)/login")}>
        <Button.Label>Go to Login</Button.Label>
      </Button>
    </AuthIllustrationLayout>
  );
};

export default ResetSuccessScreen;
