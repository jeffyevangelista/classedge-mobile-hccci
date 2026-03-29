import api from "@/lib/axios";
import axios from "axios";
import { env } from "@/utils/env";
import type { AuthResponse, LoginCredentials } from "./auth.types";

export const login = async (loginCredentials: LoginCredentials) => {
  return (await api.post("/auth/login/", loginCredentials)).data;
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

export const msLogin = async (token: string): Promise<AuthResponse> => {
  return (
    await axios.get(`${env.EXPO_PUBLIC_API_URL}/auth/microsoft/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  ).data;
};
