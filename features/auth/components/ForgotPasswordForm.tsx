import { View, useWindowDimensions, TextInput } from "react-native";
import { useCallback, useRef } from "react";
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Spinner,
  TextField,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useForgotPassword } from "../auth.hooks";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ForgotPasswordFormvalues,
  forgotPasswordSchema,
} from "../auth.schemas";
import { AxiosError } from "axios";

const ForgotPasswordForm = () => {
  const { toast } = useToast();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const themeColorAccentForeground = useThemeColor("accent-foreground");
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { mutateAsync: forgotPassword, isPending } = useForgotPassword();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleForgotPassword = async (data: ForgotPasswordFormvalues) => {
    try {
      await forgotPassword(data);
      router.push("/forgot-password/otp-verification");
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
    <View className="w-full gap-5 max-w-md mx-auto self-center">
      <TextField isInvalid={!!errors.email}>
        <Controller
          name="email"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Input
              placeholder="juandelacruz@hccci.edu.ph"
              ref={inputRef}
              keyboardType="email-address"
              autoCapitalize="none"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.email && <FieldError>{errors.email.message}</FieldError>}
      </TextField>

      <Button
        isDisabled={isPending}
        onPress={handleSubmit(handleForgotPassword)}
        size={height > 800 ? "lg" : "md"}
      >
        {isPending ? (
          <Spinner color={themeColorAccentForeground} />
        ) : (
          <Button.Label>Send Code</Button.Label>
        )}
      </Button>
    </View>
  );
};

export default ForgotPasswordForm;
