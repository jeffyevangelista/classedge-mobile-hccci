import { useFocusEffect, useRouter } from "expo-router";
import {
  Button,
  InputOTP,
  Spinner,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  type TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { AppText } from "@/components/AppText";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { useForgotPassword, useVerifyOtp } from "../auth.hooks";

const OTP_LENGTH = 6;
const INITIAL_RESEND_COOLDOWN = 60;

const formatMmSs = (totalSeconds: number) => {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
};

const OTPVerificationForm = () => {
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { height } = useWindowDimensions();
  const themeColorAccentForeground = useThemeColor("accent-foreground");
  const router = useRouter();
  const { toast } = useToast();
  const email = useStore((s) => s.email);
  const otpExpiresAt = useStore((s) => s.otpExpiresAt);
  const [value, setValue] = useState("");
  const [hasAttemptedOnce, setHasAttemptedOnce] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(INITIAL_RESEND_COOLDOWN);
  const [expirySeconds, setExpirySeconds] = useState(0);
  const { mutateAsync: verifyOtp, isPending: verifyOtpPending } =
    useVerifyOtp();
  const { mutateAsync: forgotPassword, isPending: forgotPasswordPending } =
    useForgotPassword();

  const isOtpComplete = value.length === OTP_LENGTH && /^\d+$/.test(value);
  const isCoolingDown = resendCooldown > 0;
  const isExpired = otpExpiresAt !== null && expirySeconds <= 0;

  useEffect(() => {
    if (!isCoolingDown) return;
    const id = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isCoolingDown]);

  useEffect(() => {
    if (!otpExpiresAt) {
      setExpirySeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((otpExpiresAt - Date.now()) / 1000),
      );
      setExpirySeconds(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpExpiresAt]);

  const handleChange = (next: string) => {
    setValue(next);
    if (hasAttemptedOnce && next.length < OTP_LENGTH) {
      setHasAttemptedOnce(false);
    }
  };

  const handleVerify = async () => {
    if (!email || !isOtpComplete) return;
    try {
      const result = await verifyOtp({ email, otp: value });
      const token = result?.data?.resetToken as string | undefined;
      if (token) useStore.getState().setResetToken(token);
      router.push("/(auth)/forgot-password/password-reset");
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Error",
        description: getApiErrorMessage(error),
      });
    }
  };

  const handleResend = async () => {
    if (!email || isCoolingDown) return;
    try {
      const data = await forgotPassword({ email });
      const resendIn =
        (data?.resendIn as number | undefined) ?? INITIAL_RESEND_COOLDOWN;
      setResendCooldown(resendIn);
      // New OTP invalidates the old one — clear the field, allow auto-verify
      // on the new code, and refocus so the user can type immediately.
      setValue("");
      setHasAttemptedOnce(false);
      inputRef.current?.focus();
      toast.show({
        variant: "success",
        label: "Success",
        description: "OTP has been resent",
      });
    } catch (error: any) {
      // Server returns resend_in on 429 so the client can sync to the
      // authoritative wait time instead of restarting a fresh countdown.
      const resendIn = error?.response?.data?.resend_in as number | undefined;
      if (resendIn) setResendCooldown(resendIn);
      toast.show({
        variant: "danger",
        label: "Error",
        description: getApiErrorMessage(error),
      });
    }
  };

  const autoVerify = async (otpValue: string) => {
    if (hasAttemptedOnce || !email) return;
    Keyboard.dismiss();
    setHasAttemptedOnce(true);
    try {
      const result = await verifyOtp({ email, otp: otpValue });
      const token = result?.data?.resetToken as string | undefined;
      if (token) useStore.getState().setResetToken(token);
      router.push("/(auth)/forgot-password/password-reset");
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Error",
        description: getApiErrorMessage(error),
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!email) {
        router.replace("/(auth)/forgot-password");
        return;
      }
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }, [email, router]),
  );

  const busy = verifyOtpPending || forgotPasswordPending;

  return (
    <View className="w-full max-w-md mx-auto self-center gap-5">
      <InputOTP
        className="mx-auto"
        maxLength={OTP_LENGTH}
        onComplete={autoVerify}
        value={value}
        onChange={handleChange}
      >
        <InputOTP.Group>
          {Array.from({ length: OTP_LENGTH }).map((_, index) => (
            <InputOTP.Slot key={index} className="shadow-none" index={index} />
          ))}
        </InputOTP.Group>
      </InputOTP>

      <AppText
        className={
          isExpired
            ? "text-danger text-sm text-center -mt-2"
            : "text-muted text-sm text-center -mt-2"
        }
      >
        {isExpired
          ? "Code expired. Tap Resend to get a new one."
          : !isOtpComplete
            ? "Enter the 6-digit code"
            : otpExpiresAt
              ? `Code expires in ${formatMmSs(expirySeconds)}`
              : " "}
      </AppText>

      <Button
        isDisabled={busy || !isOtpComplete || isExpired}
        onPress={handleVerify}
        size={height > 800 ? "lg" : "md"}
      >
        {busy ? (
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
          isDisabled={busy || isCoolingDown}
          onPress={handleResend}
        >
          <Button.Label>
            {isCoolingDown ? `Resend in ${resendCooldown}s` : "Resend"}
          </Button.Label>
        </Button>
      </View>
      <Button
        variant="ghost"
        size="sm"
        isDisabled={busy}
        onPress={() => router.dismissTo("/(auth)/forgot-password")}
        className="self-center"
      >
        <Button.Label>Use a different email</Button.Label>
      </Button>
    </View>
  );
};

export default OTPVerificationForm;
