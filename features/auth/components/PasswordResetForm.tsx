import { zodResolver } from "@hookform/resolvers/zod";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Button,
  FieldError,
  Spinner,
  TextField,
  useThemeColor,
  useToast,
} from "heroui-native";
import { MotiView } from "moti";
import { useCallback, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Pressable,
  type TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import AppInput from "@/components/AppInput";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import { useResetPassword } from "../auth.hooks";
import {
  type ConfirmPasswordFormValues,
  confirmPasswordSchema,
} from "../auth.schemas";

const PasswordResetForm = () => {
  const themeColorAccentForeground = useThemeColor("accent-foreground");
  const mutedColor = useThemeColor("muted");
  const successColor = useThemeColor("success");
  const { toast } = useToast();
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { height } = useWindowDimensions();
  const isLarge = height > 800;
  const email = useStore((s) => s.email);
  const router = useRouter();
  const { mutateAsync: resetPassword, isPending } = useResetPassword();
  const { control, handleSubmit, watch, formState } =
    useForm<ConfirmPasswordFormValues>({
      resolver: zodResolver(confirmPasswordSchema),
      defaultValues: {
        password: "",
        confirmPassword: "",
      },
    });

  const password = watch("password");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const requirements = useMemo(
    () => [
      { label: "At least 12 characters", met: (password || "").length >= 12 },
      {
        label: "At least 1 uppercase letter",
        met: /[A-Z]/.test(password || ""),
      },
      {
        label: "At least 1 lowercase letter",
        met: /[a-z]/.test(password || ""),
      },
      { label: "At least 1 number", met: /[0-9]/.test(password || "") },
      {
        label: "At least 1 symbol (!@#$...)",
        met: /[^A-Za-z0-9]/.test(password || ""),
      },
    ],
    [password],
  );

  const handleResetPassword = async (data: ConfirmPasswordFormValues) => {
    const { resetToken, setResetToken } = useStore.getState();
    if (!email || !resetToken) {
      toast.show({
        variant: "danger",
        label: "Session expired",
        description: "Please request a new OTP.",
      });
      router.replace("/(auth)/forgot-password");
      return;
    }
    try {
      await resetPassword({
        email,
        password: data.password,
        resetToken,
      });
      setResetToken(null);
      router.replace("/(auth)/forgot-password/reset-success");
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
      const { resetToken } = useStore.getState();
      if (!email || !resetToken) {
        router.replace("/(auth)/forgot-password");
        return;
      }
      const timer = setTimeout(() => {
        passwordRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }, [email, router]),
  );

  return (
    <View className="w-full max-w-md mx-auto self-center gap-5">
      <TextField>
        <Controller
          name="password"
          control={control}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <>
              <View className="w-full flex-row items-center">
                <AppInput
                  ref={passwordRef}
                  placeholder="New Password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  submitBehavior="submit"
                  className="flex-1 pr-10"
                />
                <Pressable
                  className="absolute right-4"
                  hitSlop={10}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Icon
                    name={showPassword ? "EyeIcon" : "EyeSlashIcon"}
                    size={20}
                    color={mutedColor}
                  />
                </Pressable>
              </View>
              {error && <FieldError>{error.message}</FieldError>}
              {value?.length > 0 && (
                <MotiView
                  from={{ opacity: 0, translateY: -4 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  className="mt-3 gap-1.5"
                >
                  {requirements.map((req) => (
                    <View
                      key={req.label}
                      className="flex-row items-center gap-2"
                    >
                      <Icon
                        name={req.met ? "CheckCircle" : "XCircle"}
                        size={16}
                        color={req.met ? successColor : mutedColor}
                        weight={req.met ? "fill" : "regular"}
                      />
                      <AppText
                        className="text-sm"
                        style={{ color: req.met ? successColor : mutedColor }}
                      >
                        {req.label}
                      </AppText>
                    </View>
                  ))}
                </MotiView>
              )}
            </>
          )}
        />
      </TextField>

      <TextField>
        <Controller
          name="confirmPassword"
          control={control}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <>
              <View className="w-full flex-row items-center">
                <AppInput
                  ref={confirmRef}
                  placeholder="Confirm Password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit(handleResetPassword)}
                  className="flex-1 pr-10"
                />
                <Pressable
                  className="absolute right-4"
                  hitSlop={10}
                  onPress={() => setShowConfirm(!showConfirm)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  <Icon
                    name={showConfirm ? "EyeIcon" : "EyeSlashIcon"}
                    size={20}
                    color={mutedColor}
                  />
                </Pressable>
              </View>
              {error && <FieldError>{error.message}</FieldError>}
            </>
          )}
        />
      </TextField>
      <Button
        size={isLarge ? "lg" : "md"}
        isDisabled={!formState.isValid || isPending}
        onPress={handleSubmit(handleResetPassword)}
      >
        {isPending ? (
          <Spinner color={themeColorAccentForeground} />
        ) : (
          <Button.Label>Continue</Button.Label>
        )}
      </Button>
    </View>
  );
};

export default PasswordResetForm;
