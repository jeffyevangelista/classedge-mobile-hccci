import {
  deleteMMKVItem,
  getMMKVItem,
  setMMKVItem,
} from "@/lib/storage/mmkv-storage";
import { powersync } from "@/powersync/system";
import { MMKV_KEYS } from "@/utils/storage-keys";

export type ForcedLogoutNotice = {
  unsyncedCount: number;
  timestamp: number;
};

/**
 * Stash a notice describing a forced logout so the next mount of the login
 * screen can surface it. Must run BEFORE signOut() on the forced path,
 * since signOut wipes the PowerSync DB and the ps_crud count would be 0
 * afterward. Best-effort: failures here must not block the logout itself.
 */
export async function recordForcedLogout(): Promise<void> {
  try {
    const result = await powersync.getAll<{ count: number }>(
      "SELECT count(*) as count FROM ps_crud",
    );
    const unsyncedCount = result[0]?.count ?? 0;
    const notice: ForcedLogoutNotice = {
      unsyncedCount,
      timestamp: Date.now(),
    };
    setMMKVItem(MMKV_KEYS.FORCED_LOGOUT_NOTICE, notice);
  } catch (err) {
    console.warn("[recordForcedLogout] failed", err);
  }
}

/**
 * Read and clear the stashed notice. Returns null if no forced logout has
 * happened since the last consumption.
 */
export function consumeForcedLogoutNotice(): ForcedLogoutNotice | null {
  const notice = getMMKVItem<ForcedLogoutNotice>(
    MMKV_KEYS.FORCED_LOGOUT_NOTICE,
  );
  if (notice) {
    deleteMMKVItem(MMKV_KEYS.FORCED_LOGOUT_NOTICE);
  }
  return notice ?? null;
}
