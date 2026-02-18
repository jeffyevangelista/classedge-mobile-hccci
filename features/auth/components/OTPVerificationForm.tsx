import { Keyboard, TextInput, useWindowDimensions, View } from "react-native";
import {
  Button,
  InputOTP,
  Spinner,
  useThemeColor,
  useToast,
} from "heroui-native";
import { AppText } from "@/components/AppText";
import { useFocusEffect, useRouter } from "expo-router";
import useStore from "@/lib/store";
import { useForgotPassword, useVerifyOtp } from "../auth.hooks";
import { useCallback, useRef, useState } from "react";

const OTPVerificationForm = () => {
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { height } = useWindowDimensions();
  const themeColorAccentForeground = useThemeColor("accent-foreground");
  const router = useRouter();
  const { toast } = useToast();
  const { email } = useStore.getState();
  const [value, setValue] = useState("");
  const [hasAttemptedOnce, setHasAttemptedOnce] = useState(false);
  const { mutateAsync: verifyOtp, isPending: verifyOtpPending } =
    useVerifyOtp();
  const { mutateAsync: forgotPassword, isPending: forgotPasswordPending } =
    useForgotPassword();

  const handleVerify = async () => {
    try {
      await verifyOtp({ email: email!, otp: value });
      router.push("/(auth)/forgot-password/password-reset");
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Error",
        description: error.message || "An error occurred",
      });
    }
  };

  const handleResend = async () => {
    try {
      await forgotPassword({ email: email! });
      toast.show({
        variant: "success",
        label: "Success",
        description: "OTP has been resent",
      });
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Error",
        description: error.message || "An error occurred",
      });
    }
  };

  const autoVerify = async (otpValue: string) => {
    if (hasAttemptedOnce) return;
    Keyboard.dismiss();
    setHasAttemptedOnce(true);
    try {
      await verifyOtp({ email: email!, otp: otpValue });
      router.push("/(auth)/forgot-password/password-reset");
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Error",
        description: error.message || "An error occurred",
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }, []),
  );

  return (
    <View className="w-full max-w-md max-auto self-center gap-5">
      <InputOTP
        className="mx-auto"
        maxLength={6}
        onComplete={autoVerify}
        value={value}
        onChange={setValue}
      >
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
          <InputOTP.Slot index={3} />
          <InputOTP.Slot index={4} />
          <InputOTP.Slot index={5} />
        </InputOTP.Group>
      </InputOTP>

      <Button
        isDisabled={verifyOtpPending || forgotPasswordPending}
        onPress={handleVerify}
        size={height > 800 ? "lg" : "md"}
      >
        {verifyOtpPending || forgotPasswordPending ? (
          <Spinner color={themeColorAccentForeground} />
        ) : (
          <Button.Label>Verify</Button.Label>
        )}
      </Button>
      <View className="flex-row items-center justify-center mt-2">
        <AppText>Didn't receive code? </AppText>
        <Button
          variant="ghost"
          size="sm"
          isDisabled={verifyOtpPending || forgotPasswordPending}
          onPress={handleResend}
        >
          <Button.Label>Resend</Button.Label>
        </Button>
      </View>
    </View>
  );
};

export default OTPVerificationForm;
