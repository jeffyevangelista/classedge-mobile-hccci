import useStore from "@/lib/store";
import { getApiErrorMessage } from "@/lib/api-error";
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
      setAccessToken(data.accessToken);
      setPowersyncToken(data.powersyncToken);
      await setRefreshToken(data.refreshToken);
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
      Alert.alert("Logout failed:", getApiErrorMessage(error));
    },
  });
};

export const useForgotPassword = () => {
  const { setEmail } = useStore.getState();
  const { toast } = useToast();
  const router = useRouter();
  return useMutation({
    mutationKey: ["forgot-password"],
    mutationFn: ({ email }: { email: string }) => forgotPassword(email),
    onSuccess: (data, { email }: { email: string }) => {
      if (data.provider && data.success === false) {
        toast.show({
          label: "Error",
          description: data.message,
          variant: "danger",
        });
      }

      if (data.success) router.push("/forgot-password/otp-verification");

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
      console.log({ token });

      return msLogin(token);
    },
    onSuccess: async (data: AuthResponse) => {
      console.log(data);

      setAccessToken(data.accessToken);
      setPowersyncToken(data.powersyncToken);
      await setRefreshToken(data.refreshToken);
    },
    onError: async (error) => {
      await clearCredentials();
      toast.show({
        variant: "danger",
        label: "Something went wrong",
        description: getApiErrorMessage(error),
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
      setAccessToken(data.accessToken);
      setNeedsOnboarding(false);
      setPowersyncToken(data.powersyncToken);
      await setRefreshToken(data.refreshToken);
    },
    onError: (error) => {
      toast.show({
        variant: "danger",
        label: "Onboarding failed",
        description: getApiErrorMessage(error),
      });
    },
  });
};
