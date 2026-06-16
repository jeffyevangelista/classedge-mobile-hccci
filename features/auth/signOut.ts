import { clearAllAttachments } from "@/features/attachments/attachments.api";
import { flush, track } from "@/lib/activity-tracker";
import { dropQueue } from "@/lib/activity-tracker/queue";
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
  // Flush any queued audit events under the outgoing JWT before teardown.
  // Spec §7.7: drop the queue afterwards so anything that failed to flush
  // is never re-sent under a future user's session.
  try {
    track("logout");
    await flush();
  } catch (err) {
    console.warn("[signOut] activity-tracker flush failed", err);
  } finally {
    dropQueue();
  }

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
