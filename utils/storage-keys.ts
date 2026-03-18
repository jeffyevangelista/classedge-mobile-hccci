export const ASYNC_STORAGE_KEYS = {
  HAS_SEEN_INTRO: "hasSeenIntro",
  ATTEMPT: "attempt",
} as const;

export type AsyncStorageKey =
  (typeof ASYNC_STORAGE_KEYS)[keyof typeof ASYNC_STORAGE_KEYS];

export const MMKV_KEYS = {
  ACCESS_TOKEN: "accessToken",
  POWERSYNC_TOKEN: "powersyncToken",
  AUTH_USER: "authUser",
  EXPIRES_AT: "expiresAt",
} as const;

export type MMKVKey = (typeof MMKV_KEYS)[keyof typeof MMKV_KEYS];
