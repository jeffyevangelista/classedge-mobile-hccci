import useStore from "@/lib/store";
import { getApiErrorMessage } from "@/lib/api-error";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert } from "react-native";
import {
  completeOnboarding,
  forgotPassword,
  getActiveLegalDocuments,
  getPublicLegalDocuments,
  login,
  resetPassword,
  verifyOtp,
} from "./auth.apis";
import { refresh } from "./refreshToken";
import { hydrateSession } from "./hydrateSession";
import type { AuthResponse, LoginCredentials } from "./auth.types";
import { useToast } from "heroui-native";
import { useRouter } from "expo-router";

export const useLogin = () => {
  return useMutation({
    mutationKey: ["login"],
    mutationFn: (payload: LoginCredentials) => login(payload),
    onSuccess: (data: AuthResponse) => hydrateSession(data),
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

export const useActiveLegalDocuments = () => {
  return useQuery({
    queryKey: ["active-legal-documents"],
    queryFn: getActiveLegalDocuments,
  });
};

export const usePublicLegalDocuments = (enabled = true) => {
  return useQuery({
    queryKey: ["public-legal-documents"],
    queryFn: getPublicLegalDocuments,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCompleteOnboarding = () => {
  const { toast } = useToast();

  return useMutation({
    mutationKey: ["complete-onboarding"],
    mutationFn: () => {
      const { authUser } = useStore.getState();
      const accepted = authUser?.pendingLegalDocTypes ?? [];
      return completeOnboarding({ accepted });
    },
    onSuccess: async () => {
      const {
        refreshToken,
        setAccessToken,
        setPowersyncToken,
        setRefreshToken,
        setLegalUpdateRequired,
      } = useStore.getState();
      const data = await refresh(refreshToken);
      setAccessToken(data.accessToken);
      setLegalUpdateRequired(false);
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
