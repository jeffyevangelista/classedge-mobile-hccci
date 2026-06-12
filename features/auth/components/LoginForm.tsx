import {
  Button,
  FieldError,
  Label,
  Spinner,
  TextField,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin } from "../auth.hooks";
import AppInput from "@/components/AppInput";
import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import { getApiErrorMessage } from "@/lib/api-error";
import { LoginFormValues, loginSchema } from "../auth.schemas";

const LoginForm = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const { mutateAsync: login, isPending } = useLogin();
  const themeColorAccentForeground = useThemeColor("accent-foreground");
  const mutedColor = useThemeColor("muted");
  const passwordRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleLogin = async (data: LoginFormValues) => {
    try {
      await login({ username: data.email, password: data.password });
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Error",
        description: getApiErrorMessage(error),
      });
    }
  };

  return (
    <View className="p-2.5 gap-3 w-full max-w-md">
      <TextField isInvalid={!!errors.email}>
        <Label>Email</Label>
        <Controller
          name="email"
          control={control}
          render={({ field: { onChange, value } }) => (
            <AppInput
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              placeholder="juandelacruz@hccci.edu.ph"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.email && <FieldError>{errors.email.message}</FieldError>}
      </TextField>
      <View className="gap-2">
        <TextField isInvalid={!!errors.password}>
          <Label>Password</Label>
          <View className="w-full flex-row items-center">
            <Controller
              name="password"
              control={control}
              render={({ field: { onChange, value } }) => (
                <AppInput
                  ref={passwordRef}
                  value={value}
                  onChangeText={onChange}
                  className="flex-1 pr-10"
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit(handleLogin)}
                />
              )}
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
          {errors.password && (
            <FieldError>{errors.password.message}</FieldError>
          )}
        </TextField>
        <Button
          onPress={() => router.push("/forgot-password")}
          variant="ghost"
          size="sm"
          className="self-end"
        >
          <Button.Label>Forgot Password</Button.Label>
        </Button>
      </View>
      <Button
        isDisabled={isPending}
        size="lg"
        className="mt-2"
        onPress={handleSubmit(handleLogin)}
      >
        {isPending ? (
          <Spinner color={themeColorAccentForeground} />
        ) : (
          <Button.Label>Login</Button.Label>
        )}
      </Button>
    </View>
  );
};

export default LoginForm;
