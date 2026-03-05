import api from "@/lib/axios";
import axios from "axios";
import type { AuthResponse, LoginCredentials } from "./auth.types";

export const login = async (loginCredentials: LoginCredentials) => {
  return (await api.post("/auth/login/", loginCredentials)).data;
};

export const getPowerSyncToken = async () => {
  return (await api.post("/powersync/token/")).data;
};

export const forgotPassword = async (email: string) => {
  return (await api.post("/auth/request-otp/", { email })).data;
};

export const verifyOtp = async (email: string, otp: string) => {
  return (await api.post("/auth/verify-otp/", { email, otp })).data;
};

export const resetPassword = async (email: string, password: string) => {
  return (await api.post("/auth/reset-password/", { email, password })).data;
};

export const msLogin = async (token: string | null): Promise<AuthResponse> => {
  return (
    await api.get(`/auth/microsoft/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  ).data;
};
