export const ASYNC_STORAGE_KEYS = {
  HAS_SEEN_INTRO: "hasSeenIntro",
  ATTEMPT: "attempt",
  THEME_PREFERENCE: "themePreference",
} as const;

export type AsyncStorageKey =
  (typeof ASYNC_STORAGE_KEYS)[keyof typeof ASYNC_STORAGE_KEYS];

export const MMKV_KEYS = {
  ACCESS_TOKEN: "accessToken",
  AUTH_USER: "authUser",
  EXPIRES_AT: "expiresAt",
  FORCED_LOGOUT_NOTICE: "forcedLogoutNotice",
  POWERSYNC_TOKEN: "powersyncToken",
  REFRESH_EXPIRES_AT: "refreshExpiresAt",
  LAST_REFRESH_EXPIRY_WARNING_SHOWN: "lastRefreshExpiryWarningShown",
} as const;

export type MMKVKey = (typeof MMKV_KEYS)[keyof typeof MMKV_KEYS];
