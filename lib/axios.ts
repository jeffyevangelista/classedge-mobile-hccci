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
    const { setAccessToken, refreshToken } = useStore.getState();

    console.log({ status: error.response?.status, refreshToken });

    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      if (refreshToken) {
        console.log("refreshing");

        try {
          console.log("triggered");

          const { accessToken } = await refresh(refreshToken);

          setAccessToken(accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (error) {
          Alert.alert("Error", "Failed to refresh token");
          return Promise.reject(error);
        }
      }
    }

    if (error.response) {
      error.message = error.response.data.message ?? error.message;
    }

    return Promise.reject(error);
  },
);
