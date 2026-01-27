export const ASYNC_STORAGE_KEYS = {
  HAS_SEEN_INTRO: "hasSeenIntro",
  EXPIRES_AT: "expiresAt",
  ATTEMPT: "attempt",
} as const;

export type AsyncStorageKey =
  (typeof ASYNC_STORAGE_KEYS)[keyof typeof ASYNC_STORAGE_KEYS];
