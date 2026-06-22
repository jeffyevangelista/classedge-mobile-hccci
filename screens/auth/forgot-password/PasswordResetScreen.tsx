import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import EnterPassword from "@/assets/illustrations/forgot-password/enter-password.svg";
import { AppText } from "@/components/AppText";
import AuthIllustrationLayout from "@/components/AuthIllustrationLayout";
import PasswordResetForm from "@/features/auth/components/PasswordResetForm";
import useStore from "@/lib/store";

const PasswordResetScreen = () => {
  const router = useRouter();
  const email = useStore((s) => s.email);

  return (
    <AuthIllustrationLayout
      Illustration={EnterPassword}
      title="Set a New Password"
      description={
        <>
          Create a new password for{" "}
          <AppText weight="semibold" className="text-foreground">
            {email}
          </AppText>
        </>
      }
      step={{ current: 3, total: 3 }}
    >
      <PasswordResetForm />
      <Button
        size="sm"
        variant="ghost"
        onPress={() => router.dismissTo("/(auth)/login")}
      >
        <Button.Label>Cancel</Button.Label>
      </Button>
    </AuthIllustrationLayout>
  );
};

export default PasswordResetScreen;
