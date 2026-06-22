import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import { Alert } from "react-native";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import {
  completeOnboarding,
  forgotPassword,
  getActiveLegalDocuments,
  getPublicLegalDocuments,
  login,
  resetPassword,
  verifyOtp,
} from "./auth.apis";
import type { AuthResponse, LoginCredentials } from "./auth.types";
import { hydrateSession } from "./hydrateSession";
import { refresh } from "./refreshToken";

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
  const { setEmail, setOtpExpiresAt } = useStore.getState();
  return useMutation({
    mutationKey: ["forgot-password"],
    mutationFn: ({ email }: { email: string }) => forgotPassword(email),
    onSuccess: (data, { email }: { email: string }) => {
      // Server intentionally returns a neutral response regardless of whether
      // the email maps to an existing account (account-enumeration prevention,
      // see backend OTPRequestAPIView). Callers decide what to do next — the
      // forgot-password form navigates to OTP; the OTP screen uses this hook
      // for resend and stays put.
      setEmail(email);
      const expiresIn = (data as { expiresIn?: number } | undefined)?.expiresIn;
      if (expiresIn) {
        setOtpExpiresAt(Date.now() + expiresIn * 1000);
      }
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
    mutationFn: ({
      email,
      password,
      resetToken,
    }: {
      email: string;
      password: string;
      resetToken: string;
    }) => resetPassword(email, password, resetToken),
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
