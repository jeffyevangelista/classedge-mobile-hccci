// features/auth/oauthVerifierStore.ts
//
// Per-flow PKCE codeVerifier storage. Each Microsoft OAuth attempt generates
// a unique flowId (passed to MS as the `state` parameter and round-tripped
// back in the redirect URL). The verifier is stored keyed by that flowId,
// so concurrent flows, stale URL replays, and watchdog timeouts can't
// trample each other.
//
// TTL = 10 minutes (matches Microsoft's authorization code validity window).
// Pruning is lazy: pruneExpired() runs at the start of each new login.

import {
  deleteMMKVItem,
  getAllMMKVKeys,
  getMMKVItem,
  setMMKVItem,
} from "@/lib/storage/mmkv-storage";

const KEY_PREFIX = "oauth_verifier:";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

// Legacy single-slot key from before flow-keyed storage. Pruned on first run
// after upgrade. Value matches what was in MMKV_KEYS.OAUTH_CODE_VERIFIER.
const LEGACY_KEY = "oauthCodeVerifier";

type VerifierEntry = {
  codeVerifier: string;
  createdAt: number;
};

const keyFor = (flowId: string) => `${KEY_PREFIX}${flowId}`;

export function saveVerifier(flowId: string, codeVerifier: string): void {
  const entry: VerifierEntry = { codeVerifier, createdAt: Date.now() };
  setMMKVItem(keyFor(flowId), entry);
}

export function getVerifier(flowId: string): string | null {
  const entry = getMMKVItem<VerifierEntry>(keyFor(flowId));
  return entry?.codeVerifier ?? null;
}

export function deleteVerifier(flowId: string): void {
  deleteMMKVItem(keyFor(flowId));
}

/**
 * Delete verifier entries older than TTL_MS, plus the legacy single-slot key
 * if it's still present (one-time cleanup after upgrade).
 *
 * Called at the start of each startMicrosoftLogin() so the set never grows
 * unbounded. No background timer needed.
 */
export function pruneExpired(): void {
  // Legacy cleanup — always remove this if present.
  deleteMMKVItem(LEGACY_KEY);

  const now = Date.now();
  const allKeys = getAllMMKVKeys();
  for (const key of allKeys) {
    if (!key.startsWith(KEY_PREFIX)) continue;
    const entry = getMMKVItem<VerifierEntry>(key);
    if (!entry || typeof entry.createdAt !== "number") {
      // Malformed entry — delete defensively.
      deleteMMKVItem(key);
      continue;
    }
    if (now - entry.createdAt > TTL_MS) {
      deleteMMKVItem(key);
    }
  }
}
