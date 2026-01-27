import {
  deleteASItem,
  getASItem,
  setASItem,
} from "@/lib/storage/async-storage";
import {
  deleteSSItem,
  getSSItem,
  setSSItem,
} from "@/lib/storage/secure-storage";
import {
  ACCESS_TOKEN_KEY,
  AUTH_USER_KEY,
  REFRESH_TOKEN_KEY,
} from "@/utils/env";
import { ASYNC_STORAGE_KEYS } from "@/utils/storage-keys";
import { jwtDecode } from "jwt-decode";
import type { StateCreator } from "zustand";
import type { AuthUser, DecodedToken } from "./auth.types";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
};

type AuthAction = {
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  clearCredentials: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

export type AuthSlice = AuthState & AuthAction;

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  isAuthenticated: false,
  authUser: null,
};

const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  ...initialState,
  setAccessToken: async (accessToken: string) => {
    if (!accessToken) {
      return;
    }

    const { id, exp, needsOnboarding, needsPasswordSetup, role } =
      jwtDecode<DecodedToken>(accessToken);

    if (!id || !exp) {
      console.warn("[AUTH] Invalid token: missing id or exp");
      return;
    }
    const expiresAt = exp * 1000;
    const authUser = { id, needsOnboarding, needsPasswordSetup, role };

    await Promise.all([
      setSSItem(ACCESS_TOKEN_KEY, accessToken),
      setSSItem(AUTH_USER_KEY, authUser),
      setASItem(ASYNC_STORAGE_KEYS.EXPIRES_AT, expiresAt),
    ]);
    console.log("[AUTH] Successfully saved to storage");

    set({
      accessToken,
      expiresAt,
      isAuthenticated: true,
      authUser,
    });
  },
  setRefreshToken: async (refreshToken: string) => {
    await setSSItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ refreshToken });
  },
  clearCredentials: async () => {
    await Promise.all([
      deleteSSItem(ACCESS_TOKEN_KEY),
      deleteSSItem(REFRESH_TOKEN_KEY),
      deleteSSItem(AUTH_USER_KEY),
      deleteASItem(ASYNC_STORAGE_KEYS.EXPIRES_AT),
    ]);
    set(() => ({ ...initialState }));
  },
  restoreSession: async () => {
    try {
      const [accessToken, refreshToken, authUserStr, expiresAtStr] =
        await Promise.all([
          getSSItem(ACCESS_TOKEN_KEY),
          getSSItem(REFRESH_TOKEN_KEY),
          getSSItem(AUTH_USER_KEY),
          getASItem<number | null>(ASYNC_STORAGE_KEYS.EXPIRES_AT),
        ]);

      const authUser = authUserStr as AuthUser | null;
      const expiresAt = expiresAtStr;

      const isAuthenticated = !!(
        accessToken &&
        refreshToken &&
        authUser &&
        expiresAt
      );

      set({
        accessToken,
        refreshToken,
        authUser,
        isAuthenticated,
        expiresAt,
      });
    } catch (error) {
      console.warn("Session restore failed:", error);
      set(() => ({ ...initialState }));
    }
  },
});

export default createAuthSlice;
