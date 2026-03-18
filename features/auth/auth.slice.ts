import {
  deleteMMKVItem,
  getMMKVItem,
  setMMKVItem,
} from "@/lib/storage/mmkv-storage";
import {
  deleteSSItem,
  getSSItem,
  setSSItem,
} from "@/lib/storage/secure-storage";
import { env } from "@/utils/env";
import { MMKV_KEYS } from "@/utils/storage-keys";
import { jwtDecode } from "jwt-decode";
import type { StateCreator } from "zustand";
import type { AuthUser, DecodedToken } from "./auth.types";

type AuthState = {
  accessToken: string | null;
  powersyncToken: string | null;
  refreshToken: string | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  email: string | null;
};

type AuthAction = {
  setAccessToken: (accessToken: string) => void;
  setPowersyncToken: (powersyncToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  clearCredentials: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setEmail: (email: string) => void;
};

export type AuthSlice = AuthState & AuthAction;

const initialState: AuthState = {
  accessToken: null,
  powersyncToken: null,
  refreshToken: null,
  expiresAt: null,
  isAuthenticated: false,
  authUser: null,
  email: null,
};

const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  ...initialState,
  setAccessToken: (accessToken: string) => {
    if (!accessToken) {
      return;
    }

    const { user_id, exp, needs_onboarding, needs_password_setup, role } =
      jwtDecode<DecodedToken>(accessToken);

    if (!user_id || !exp) {
      console.warn("[AUTH] Invalid token: missing id or exp");
      return;
    }
    const expiresAt = exp * 1000;
    const authUser = {
      id: user_id,
      needs_onboarding,
      needs_password_setup,
      role,
    };

    setMMKVItem(MMKV_KEYS.ACCESS_TOKEN, accessToken);
    setMMKVItem(MMKV_KEYS.AUTH_USER, authUser);
    setMMKVItem(MMKV_KEYS.EXPIRES_AT, expiresAt);

    set({
      accessToken,
      expiresAt,
      isAuthenticated: true,
      authUser,
    });
  },
  setPowersyncToken: (powersyncToken: string) => {
    setMMKVItem(MMKV_KEYS.POWERSYNC_TOKEN, powersyncToken);
    set({ powersyncToken });
  },
  setRefreshToken: async (refreshToken: string) => {
    await setSSItem(env.EXPO_PUBLIC_REFRESH_TOKEN_KEY, refreshToken);
    set({ refreshToken });
  },
  clearCredentials: async () => {
    deleteMMKVItem(MMKV_KEYS.ACCESS_TOKEN);
    deleteMMKVItem(MMKV_KEYS.POWERSYNC_TOKEN);
    deleteMMKVItem(MMKV_KEYS.AUTH_USER);
    deleteMMKVItem(MMKV_KEYS.EXPIRES_AT);
    await deleteSSItem(env.EXPO_PUBLIC_REFRESH_TOKEN_KEY);
    set(() => ({ ...initialState }));
  },
  restoreSession: async () => {
    try {
      const accessToken = getMMKVItem<string>(MMKV_KEYS.ACCESS_TOKEN);
      const powersyncToken = getMMKVItem<string>(MMKV_KEYS.POWERSYNC_TOKEN);
      const authUser = getMMKVItem<AuthUser>(MMKV_KEYS.AUTH_USER);
      const expiresAt = getMMKVItem<number>(MMKV_KEYS.EXPIRES_AT);
      const refreshToken = await getSSItem(env.EXPO_PUBLIC_REFRESH_TOKEN_KEY);

      const isAuthenticated = !!(
        accessToken &&
        refreshToken &&
        authUser &&
        expiresAt
      );

      set({
        accessToken,
        powersyncToken,
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
  setEmail: (email: string) => {
    set({ email });
  },
});

export default createAuthSlice;
