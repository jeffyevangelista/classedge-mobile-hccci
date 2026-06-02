import useStore from "@/lib/store";
import { jwtDecode } from "jwt-decode";
import { captureAuthMessage } from "@/lib/telemetry";
import { signOut } from "./signOut";
import type { AuthResponse } from "./auth.types";

/**
 * Write an `AuthResponse` into the store, but first detect account switches.
 *
 * If a different user was previously signed in on this device, runs the full
 * `signOut()` teardown (PowerSync DB, attachments, query cache, persister)
 * before writing the new credentials — otherwise the new user would inherit
 * the previous account's synced data.
 *
 * Same-user re-logins skip the teardown to avoid a wasteful local DB wipe.
 */
export async function hydrateSession(data: AuthResponse): Promise<void> {
  const { authUser, setAccessToken, setRefreshToken, setPowersyncToken } =
    useStore.getState();

  const decoded = jwtDecode<Record<string, unknown>>(data.accessToken);
  const incomingUserId = decoded.user_id as number | undefined;
  if (authUser?.id && incomingUserId && authUser.id !== incomingUserId) {
    captureAuthMessage("account_switch_detected", {
      previousUserId: authUser.id,
      incomingUserId,
    });
    await signOut();
  }

  setAccessToken(data.accessToken);
  setPowersyncToken(data.powersyncToken);
  await setRefreshToken(data.refreshToken);
}
