import { refresh } from "@/features/auth/refreshToken";
import { env } from "@/utils/env";
import axios from "axios";
import useStore from "./store";
import { Alert } from "react-native";

const api = axios.create({
  baseURL: env.EXPO_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

interface FailedRequest {
  resolve: (token?: string | null) => void;
  reject: (error: any) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.request.use(async (config) => {
  const { accessToken, isConnected, isInternetReachable } = useStore.getState();

  // Block requests when offline to avoid unnecessary timeouts
  if (!isConnected || !isInternetReachable) {
    return Promise.reject(
      new axios.Cancel("No network connection. Request cancelled."),
    );
  }

  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const {
      setAccessToken,
      setPowersyncToken,
      setRefreshToken,
      refreshToken,
      clearCredentials,
    } = useStore.getState();

    const originalRequest = error.config;

    if (
      (error.response?.status === 403 || error.response?.status === 401) &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const data = await refresh(refreshToken);

        setAccessToken(data.access_token);
        setPowersyncToken(data.powersync_token);
        await setRefreshToken(data.refresh_token);
        processQueue(null, data.access_token);
        return api(originalRequest);
      } catch (err: any) {
        processQueue(err, null);
        // Only clear credentials if the refresh failed due to a server
        // rejection (e.g. 401). Never clear when the error is a network
        // failure — the user should stay logged in while offline.
        const isNetworkError = !err?.response;
        if (!isNetworkError) {
          await clearCredentials();
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    // 1. Response Errors (Server replied with 4xx or 5xx)
    if (error.response) {
      const { status, data } = error.response;
      switch (status) {
        case 401:
          /* Redirect to login */ break;
        case 403:
          /* Permission denied */ break;
        case 500:
          /* Server crash */ break;
        default:
          console.log(`Server Error: ${status}`);
      }
    }
    // 2. Request Errors (Request sent but no response - Network/CORS/Timeout)
    else if (error.request) {
      console.log("Network Error: No response from server.");
    }
    // 3. Setup Errors (Something went wrong in your code before sending)
    else {
      console.log("Request Setup Error:", error.message);
    }

    return Promise.reject(error); // Keep the error chain alive
  },
);

export default api;
