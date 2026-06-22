import axios from "axios";
import { silentRefresh } from "@/features/auth/useTokenRefresh";
import { env } from "@/utils/env";
import { ApiError, isStandardizedError } from "./api-error";
import { snakeToCamel } from "./case-transform";
import useStore from "./store";

const api = axios.create({
  baseURL: env.EXPO_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
    "X-Platform": "mobile",
  },
  withCredentials: true,
});

api.interceptors.response.use((response) => {
  if (response.data) {
    response.data = snakeToCamel(response.data);
  }
  return response;
});

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
    const originalRequest = error.config;

    // Parse drf-standardized-errors early — except token-related 401/403s
    // that should fall through to the refresh logic below.
    if (error.response && isStandardizedError(error.response.data)) {
      const { status, data } = error.response;
      const TOKEN_ERROR_CODES = new Set([
        "token_not_valid",
        "not_authenticated",
      ]);
      const isTokenError =
        (status === 401 || status === 403) &&
        data.errors.some((e: { code: string }) =>
          TOKEN_ERROR_CODES.has(e.code),
        );

      if (!isTokenError) {
        return Promise.reject(new ApiError(data, status));
      }
    }

    if (
      (error.response?.status === 403 || error.response?.status === 401) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      // silentRefresh dedups concurrent callers and clears credentials
      // itself on a 401/403 from the refresh endpoint.
      const ok = await silentRefresh({ force: true });
      if (!ok) {
        return Promise.reject(error);
      }
      const { accessToken } = useStore.getState();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    }
    // 1. Response Errors (Server replied with 4xx or 5xx)
    if (error.response) {
      const { status } = error.response;

      switch (status) {
        case 401:
          /* Redirect to login */ break;
        case 403:
          /* Permission denied */ break;
        case 500:
          /* Server crash */ break;
        default:
          if (__DEV__) console.log(`Server Error: ${status}`);
      }
    }
    // 2. Request Errors (Request sent but no response - Network/CORS/Timeout)
    else if (error.request) {
      if (__DEV__) console.log("Network Error: No response from server.");
    }
    // 3. Setup Errors (Something went wrong in your code before sending)
    else {
      if (__DEV__) console.log("Request Setup Error:", error.message);
    }

    return Promise.reject(error); // Keep the error chain alive
  },
);

export default api;
