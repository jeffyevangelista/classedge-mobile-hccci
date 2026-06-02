import { clearAllAttachments } from "@/features/attachments/attachments.api";
import useStore from "@/lib/store";
import { powersync } from "@/powersync/system";
import { persister, queryClient } from "@/providers/QueryProvider";

/**
 * Tear down all client-side session state.
 *
 * Used by both the manual logout button and the forced logout path inside
 * `silentRefresh` (when the refresh token itself is rejected). Each step
 * is independently guarded so a single failure cannot leave the device
 * half-signed-out — credentials must always clear, since that flip is
 * what unmounts the authed routes.
 */
export async function signOut(): Promise<void> {
  try {
    await clearAllAttachments();
  } catch (err) {
    console.warn("[signOut] clearAllAttachments failed", err);
  }

  try {
    await powersync.disconnectAndClear();
  } catch (err) {
    console.warn("[signOut] powersync.disconnectAndClear failed", err);
  }

  try {
    await useStore.getState().clearCredentials();
  } catch (err) {
    console.warn("[signOut] clearCredentials failed", err);
  }

  try {
    queryClient.clear();
  } catch (err) {
    console.warn("[signOut] queryClient.clear failed", err);
  }

  try {
    await persister.removeClient();
  } catch (err) {
    console.warn("[signOut] persister.removeClient failed", err);
  }
}
