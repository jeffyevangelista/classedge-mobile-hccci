import { Pressable, TextInput, useWindowDimensions, View } from "react-native";
import { useCallback, useRef, useState } from "react";
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
import zxcvbn from "zxcvbn";
import { AnimatePresence, MotiView } from "moti";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { EyeIcon, EyeSlashIcon } from "phosphor-react-native";

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
  const strength = zxcvbn(password || "");

  const scoreColors = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#22c55e"];
  const scoreLabels = ["Very weak", "Weak", "Fair", "Good", "Strong"];

  const handleResetPassword = async (data: ConfirmPasswordFormValues) => {
    try {
      await resetPassword({ email: email!, password: data.password });
      router.replace("/(auth)/forgot-password/reset-success");
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
                  className="flex-1 pr-10 border"
                />
                <Pressable
                  className="absolute right-4"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Icon
                    as={showPassword ? EyeIcon : EyeSlashIcon}
                    size={20}
                    color="gray"
                  />
                </Pressable>
              </View>
              {error && <FieldError>{error.message}</FieldError>}
              <AnimatePresence>
                {value?.length > 0 && (
                  <MotiView
                    from={{ opacity: 0, translateY: -4 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: -4 }}
                    className="mt-3"
                  >
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <MotiView
                        from={{ width: "0%" }}
                        animate={{
                          width: `${((strength.score + 1) / 5) * 100}%`,
                          backgroundColor: scoreColors[strength.score],
                        }}
                        transition={{
                          type: "timing",
                          duration: 400,
                        }}
                        className="h-2 rounded-full"
                      />
                    </View>
                    <AppText
                      className="mt-1 text-sm font-medium"
                      style={{ color: scoreColors[strength.score] }}
                    >
                      {scoreLabels[strength.score]}
                    </AppText>
                  </MotiView>
                )}
              </AnimatePresence>
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
