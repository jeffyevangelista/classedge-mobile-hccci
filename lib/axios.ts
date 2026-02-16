import { refresh } from "@/features/auth/refreshToken";
import { API_URL } from "@/utils/env";
import axios from "axios";
import { Alert } from "react-native";
import useStore from "./store";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  const { accessToken } = useStore.getState();

  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const { setAccessToken, refreshToken, clearCredentials } =
      useStore.getState();

    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/refresh/"
    ) {
      originalRequest._retry = true;
      console.log("token expired");

      if (refreshToken) {
        console.log("refreshing", { refreshToken });
        try {
          const { access } = await refresh(refreshToken);

          setAccessToken(access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          await clearCredentials();
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please log in again.",
          );
          return Promise.reject(refreshError);
        }
      }
    }

    if (error.response) {
      error.message = error.response.data.message ?? error.message;
    }

    return Promise.reject(error);
  },
);
