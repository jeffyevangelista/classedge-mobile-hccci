import { Pressable, TextInput, useWindowDimensions, View } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Button,
  FieldError,
  Input,
  Spinner,
  TextField,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useFocusEffect, useRouter } from "expo-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useResetPassword } from "../auth.hooks";
import useStore from "@/lib/store";
import {
  ConfirmPasswordFormValues,
  confirmPasswordSchema,
} from "../auth.schemas";
import { MotiView } from "moti";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { getApiErrorMessage } from "@/lib/api-error";

const PasswordResetForm = () => {
  const themeColorAccentForeground = useThemeColor("accent-foreground");
  const { toast } = useToast();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { height } = useWindowDimensions();
  const isLarge = height > 800;
  const { email } = useStore.getState();
  const router = useRouter();
  const { mutateAsync: resetPassword, isPending } = useResetPassword();
  const { control, handleSubmit, watch, formState } =
    useForm<ConfirmPasswordFormValues>({
      resolver: zodResolver(confirmPasswordSchema),
    });

  const password = watch("password");
  const [showPassword, setShowPassword] = useState(false);

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
    try {
      await resetPassword({ email: email!, password: data.password });
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
      // Delay to ensure input is mounted before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }, []),
  );

  return (
    <View className="w-full max-w-md max-auto self-center gap-5">
      <TextField>
        <Controller
          name="password"
          control={control}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <>
              <View className="w-full flex-row items-center">
                <Input
                  placeholder="New Password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry={!showPassword}
                  className="flex-1 pr-10 border shadow-none"
                  style={{ elevation: 0, shadowOpacity: 0 }}
                />
                <Pressable
                  className="absolute right-4"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Icon
                    name={showPassword ? "EyeIcon" : "EyeSlashIcon"}
                    size={20}
                    color="gray"
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
                        color={req.met ? "#22c55e" : "#9ca3af"}
                        weight={req.met ? "fill" : "regular"}
                      />
                      <AppText
                        className="text-sm"
                        style={{ color: req.met ? "#22c55e" : "#9ca3af" }}
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
              <Input
                placeholder="Confirm Password"
                value={value}
                onChangeText={onChange}
                secureTextEntry={!showPassword}
              />
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
