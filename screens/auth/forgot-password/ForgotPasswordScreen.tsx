import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import ForgotPassword from "@/assets/illustrations/forgot-password/forgot-password.svg";
import AuthIllustrationLayout from "@/components/AuthIllustrationLayout";
import ForgotPasswordForm from "@/features/auth/components/ForgotPasswordForm";

const ForgotPasswordScreen = () => {
  const router = useRouter();

  return (
    <AuthIllustrationLayout
      Illustration={ForgotPassword}
      title="Forgot Password?"
      description="No worries! Enter your email address below and we'll send you reset instructions."
      step={{ current: 1, total: 3 }}
    >
      <ForgotPasswordForm />
      <Button
        variant="ghost"
        size="sm"
        className="mt-5"
        onPress={() => router.dismissTo("/(auth)/login")}
      >
        <Button.Label>Back to Login</Button.Label>
      </Button>
    </AuthIllustrationLayout>
  );
};

export default ForgotPasswordScreen;
