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
import type { AuthUser } from "./auth.types";

export type OAuthPhase =
  | "idle"
  | "opening_browser"
  | "awaiting_user"
  | "exchanging_code"
  | "exchanging_session";

type AuthState = {
  accessToken: string | null;
  powersyncToken: string | null;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  email: string | null;
  resetToken: string | null;
  otpExpiresAt: number | null;
  oauthPhase: OAuthPhase;
  oauthStartedAt: number | null;
};

type AuthAction = {
  setAccessToken: (accessToken: string) => void;
  setPowersyncToken: (powersyncToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  clearCredentials: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setEmail: (email: string) => void;
  setResetToken: (resetToken: string | null) => void;
  setOtpExpiresAt: (otpExpiresAt: number | null) => void;
  setLegalUpdateRequired: (legalUpdateRequired: boolean) => void;
  setOAuthPhase: (next: { phase: OAuthPhase; startedAt: number | null }) => void;
};

export type AuthSlice = AuthState & AuthAction;

const initialState: AuthState = {
  accessToken: null,
  powersyncToken: null,
  refreshToken: null,
  refreshExpiresAt: null,
  expiresAt: null,
  isAuthenticated: false,
  authUser: null,
  email: null,
  resetToken: null,
  otpExpiresAt: null,
  oauthPhase: "idle",
  oauthStartedAt: null,
};

const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  ...initialState,
  setAccessToken: (accessToken: string) => {
    if (!accessToken) {
      return;
    }

    const decoded = jwtDecode<Record<string, unknown>>(accessToken);
    const userId = decoded.user_id as number;
    const exp = decoded.exp as number;
    const legalUpdateRequired = decoded.legal_update_required as boolean;
    const needsPasswordSetup = decoded.needs_password_setup as boolean;
    const role = decoded.role as string;
    const pendingLegalDocTypes =
      (decoded.pending_legal_doc_types as string[]) ?? [];

    if (!userId || !exp) {
      console.warn("[AUTH] Invalid token: missing id or exp");
      return;
    }
    const expiresAt = exp * 1000;
    const authUser: AuthUser = {
      id: userId,
      legalUpdateRequired,
      needsPasswordSetup,
      role,
      pendingLegalDocTypes,
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
    let refreshExpiresAt: number | null = null;
    try {
      const decoded = jwtDecode<Record<string, unknown>>(refreshToken);
      const exp = decoded.exp as number | undefined;
      if (typeof exp === "number") {
        refreshExpiresAt = exp * 1000;
        setMMKVItem(MMKV_KEYS.REFRESH_EXPIRES_AT, refreshExpiresAt);
      }
    } catch (err) {
      console.warn("[AUTH] Could not decode refresh token exp", err);
    }
    set({ refreshToken, refreshExpiresAt });
  },
  clearCredentials: async () => {
    deleteMMKVItem(MMKV_KEYS.ACCESS_TOKEN);
    deleteMMKVItem(MMKV_KEYS.POWERSYNC_TOKEN);
    deleteMMKVItem(MMKV_KEYS.AUTH_USER);
    deleteMMKVItem(MMKV_KEYS.EXPIRES_AT);
    deleteMMKVItem(MMKV_KEYS.REFRESH_EXPIRES_AT);
    deleteMMKVItem(MMKV_KEYS.LAST_REFRESH_EXPIRY_WARNING_SHOWN);
    await deleteSSItem(env.EXPO_PUBLIC_REFRESH_TOKEN_KEY);
    set(() => ({ ...initialState }));
  },
  restoreSession: async () => {
    try {
      const accessToken = getMMKVItem<string>(MMKV_KEYS.ACCESS_TOKEN);
      const powersyncToken = getMMKVItem<string>(MMKV_KEYS.POWERSYNC_TOKEN);
      const authUser = getMMKVItem<AuthUser>(MMKV_KEYS.AUTH_USER);
      const expiresAt = getMMKVItem<number>(MMKV_KEYS.EXPIRES_AT);
      const refreshExpiresAt = getMMKVItem<number>(
        MMKV_KEYS.REFRESH_EXPIRES_AT,
      );
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
        refreshExpiresAt,
        authUser,
        isAuthenticated,
        expiresAt,
        oauthPhase: "idle",
        oauthStartedAt: null,
      });
    } catch (error) {
      console.warn("Session restore failed:", error);
      set(() => ({ ...initialState }));
    }
  },
  setEmail: (email: string) => {
    set({ email });
  },
  setResetToken: (resetToken: string | null) => {
    set({ resetToken });
  },
  setOtpExpiresAt: (otpExpiresAt: number | null) => {
    set({ otpExpiresAt });
  },
  setLegalUpdateRequired: (legalUpdateRequired: boolean) => {
    set((state) => {
      const updatedAuthUser = state.authUser
        ? { ...state.authUser, legalUpdateRequired }
        : null;
      if (updatedAuthUser) {
        setMMKVItem(MMKV_KEYS.AUTH_USER, updatedAuthUser);
      }
      return { authUser: updatedAuthUser };
    });
  },
  setOAuthPhase: ({ phase, startedAt }) => {
    set({ oauthPhase: phase, oauthStartedAt: startedAt });
  },
});

export default createAuthSlice;
