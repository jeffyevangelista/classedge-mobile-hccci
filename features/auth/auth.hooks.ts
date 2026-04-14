import useStore from "@/lib/store";
import { useMutation } from "@tanstack/react-query";
import { Alert } from "react-native";
import {
  completeOnboarding,
  forgotPassword,
  login,
  msLogin,
  resetPassword,
  verifyOtp,
} from "./auth.apis";
import { refresh } from "./refreshToken";
import type { AuthResponse, LoginCredentials } from "./auth.types";
import { useToast } from "heroui-native";
import { useRouter } from "expo-router";

export const useLogin = () => {
  const { setAccessToken, setRefreshToken, setPowersyncToken } =
    useStore.getState();
  return useMutation({
    mutationKey: ["login"],
    mutationFn: (payload: LoginCredentials) => login(payload),
    onSuccess: async (data: AuthResponse) => {
      setAccessToken(data.access_token);
      setPowersyncToken(data.powersync_token);
      await setRefreshToken(data.refresh_token);
    },
  });
};

export const useLogout = () => {
  const { clearCredentials } = useStore.getState();
  return useMutation({
    mutationKey: ["logout"],
    networkMode: "always",
    mutationFn: async () => await clearCredentials(),
    onError: (error) => {
      Alert.alert("Logout failed:", error.message);
    },
  });
};

export const useForgotPassword = () => {
  const { setEmail } = useStore.getState();
  const router = useRouter();
  return useMutation({
    mutationKey: ["forgot-password"],
    mutationFn: ({ email }: { email: string }) => forgotPassword(email),
    onSuccess: (_, { email }: { email: string }) => {
      if (email) {
        router.push("/forgot-password/otp-verification");
      }
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

export const useMsLogin = () => {
  const {
    setAccessToken,
    setRefreshToken,
    setPowersyncToken,
    clearCredentials,
  } = useStore.getState();
  const { toast } = useToast();

  return useMutation({
    mutationKey: ["ms-login"],
    mutationFn: (token: string) => {
      return msLogin(token);
    },
    onSuccess: async (data: AuthResponse) => {
      setAccessToken(data.access_token);
      setPowersyncToken(data.powersync_token);
      await setRefreshToken(data.refresh_token);
    },
    onError: async (error) => {
      await clearCredentials();
      const errorMessage =
        error instanceof Error ? error.message : "Authentication failed";
      toast.show({
        variant: "danger",
        label: "Something went wrong",
        description: errorMessage,
      });
    },
  });
};

export const useCompleteOnboarding = () => {
  const { toast } = useToast();

  return useMutation({
    mutationKey: ["complete-onboarding"],
    mutationFn: () =>
      completeOnboarding({
        eula_version: "1.0",
        privacy_policy_version: "1.0",
        is_accepted: true,
      }),
    onSuccess: async () => {
      const {
        refreshToken,
        setAccessToken,
        setPowersyncToken,
        setRefreshToken,
        setNeedsOnboarding,
      } = useStore.getState();
      const data = await refresh(refreshToken);
      setAccessToken(data.access_token);
      setNeedsOnboarding(false);
      setPowersyncToken(data.powersync_token);
      await setRefreshToken(data.refresh_token);
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong";
      toast.show({
        variant: "danger",
        label: "Onboarding failed",
        description: errorMessage,
      });
    },
  });
};
