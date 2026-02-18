import useStore from "@/lib/store";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { forgotPassword, login, resetPassword, verifyOtp } from "./auth.apis";
import type { AuthResponse, LoginCredentials } from "./auth.types";

export const useLogin = () => {
  const router = useRouter();
  const { setAccessToken, setRefreshToken } = useStore.getState();
  return useMutation({
    mutationKey: ["login"],
    mutationFn: (payload: LoginCredentials) => login(payload),
    onSuccess: async (data: AuthResponse) => {
      await Promise.all([
        setAccessToken(data.access),
        setRefreshToken(data.refresh),
      ]);
      router.replace("/(main)/(tabs)");
    },
  });
};

export const useLogout = () => {
  const router = useRouter();
  const { clearCredentials } = useStore.getState();
  return useMutation({
    mutationKey: ["logout"],
    mutationFn: async () => await clearCredentials(),
    onSuccess: () => {
      router.replace("/(auth)/login");
    },
    onError: (error) => {
      Alert.alert("Logout failed:", error.message);
    },
  });
};

export const useForgotPassword = () => {
  const { setEmail } = useStore.getState();
  return useMutation({
    mutationKey: ["forgot-password"],
    mutationFn: ({ email }: { email: string }) => forgotPassword(email),
    onSuccess: (_, { email }: { email: string }) => {
      setEmail(email);
    },
  });
};

export const useVerifyOtp = () => {
  return useMutation({
    mutationKey: ["verify-otp"],
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      verifyOtp(email, otp),
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationKey: ["reset-password"],
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      resetPassword(email, password),
  });
};
