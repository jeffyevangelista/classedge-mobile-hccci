import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { appendSyncEvent } from "@/features/sync/syncEvents";
import useStore from "@/lib/store";
import { captureAuthError, captureAuthMessage } from "@/lib/telemetry";
import { recordForcedLogout } from "./forcedLogoutNotice";
import { isTokenInvalidResponse } from "./isTokenInvalidResponse";
import { refresh } from "./refreshToken";
import { signOut } from "./signOut";

const BACKGROUND_TOKEN_REFRESH = "BACKGROUND_TOKEN_REFRESH";

// Refresh the token 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
// Foreground polling interval (60 seconds)
const POLL_INTERVAL_MS = 60 * 1000;

// Shared in-flight refresh promise. With rotating refresh tokens, two
// concurrent callers using the same refresh token would race: the first
// rotates it, the second sends the now-revoked one and gets 401 (and
// some backends blacklist the new token on reuse). All callers
// (foreground poll, AppState, background task, PowerSync
// invalidateCredentials, axios interceptor) funnel through this so only
// one network refresh is in flight at a time.
let inflightRefresh: Promise<boolean> | null = null;

/**
 * Silently refresh tokens when needed.
 * Returns true if tokens were refreshed, false otherwise.
 *
 * Pass `{ force: true }` to bypass the within-buffer check. Used by
 * PowerSync's invalidateCredentials hook and the axios 401 interceptor,
 * which fire when the server rejects the current token regardless of
 * how much wall-clock time is left on it.
 */
export async function silentRefresh(opts?: {
  force?: boolean;
}): Promise<boolean> {
  const { refreshToken, expiresAt, isConnected, isInternetReachable } =
    useStore.getState();

  // Skip when offline — session stays valid locally
  if (!isConnected || !isInternetReachable) return false;
  // No session to refresh
  if (!refreshToken || !expiresAt) return false;

  const timeUntilExpiry = expiresAt - Date.now();

  // Only refresh if we're within the buffer window, unless forced
  if (!opts?.force && timeUntilExpiry > REFRESH_BUFFER_MS) return false;

  // Dedup: a refresh is already in flight — await it instead of firing
  // a second request with the same (about-to-be-rotated) refresh token.
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      // Re-read the refresh token inside the inflight wrapper in case
      // another path rotated it between the outer check and now.
      const currentRefreshToken = useStore.getState().refreshToken;
      if (!currentRefreshToken) return false;

      // Capture local onboarding state before the refresh overwrites it
      const wasOnboardingDone =
        useStore.getState().authUser?.legalUpdateRequired === false;

      try {
        const data = await refresh(currentRefreshToken);
        const { setAccessToken, setPowersyncToken, setRefreshToken } =
          useStore.getState();
        setAccessToken(data.accessToken);
        // Preserve local legalUpdateRequired: false if the server JWT is stale
        if (
          wasOnboardingDone &&
          useStore.getState().authUser?.legalUpdateRequired
        ) {
          useStore.getState().setLegalUpdateRequired(false);
        }
        setPowersyncToken(data.powersyncToken);
        await setRefreshToken(data.refreshToken);
        console.log("[TokenRefresh] Tokens refreshed silently");
        await appendSyncEvent({
          kind: "auth",
          status: "ok",
          message: "Tokens refreshed silently",
        });
        return true;
      } catch (error: any) {
        console.warn("[TokenRefresh] Silent refresh failed:", error);
        // A bare 401 (legacy SimpleJWT body) or a 401/403 carrying a
        // `token_not_valid`/`not_authenticated` code unambiguously means
        // the refresh token itself is dead. Other 403s (WAF/proxy/deploy
        // hiccups) fall through to a normal retry. The captive-portal
        // guard still applies: only force logout when the device is
        // genuinely online.
        const status = error?.response?.status;
        captureAuthError("silent_refresh_failed", error, { status });
        await appendSyncEvent({
          kind: "auth",
          status: "fail",
          httpStatus: typeof status === "number" ? status : null,
          message:
            error instanceof Error ? error.message : "Silent refresh failed",
        });
        if (isTokenInvalidResponse(error)) {
          const { isConnected, isInternetReachable } = useStore.getState();
          if (isConnected && isInternetReachable) {
            const reason =
              status === 401 ? "refresh_401" : "refresh_403_token_invalid";
            captureAuthMessage("forced_logout", { reason });
            await recordForcedLogout();
            await signOut();
          }
        }
        return false;
      }
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

// Register the background task handler (must be at module level)
TaskManager.defineTask(BACKGROUND_TOKEN_REFRESH, async () => {
  try {
    await silentRefresh();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function registerBackgroundTask() {
  try {
    await BackgroundTask.registerTaskAsync(BACKGROUND_TOKEN_REFRESH, {
      minimumInterval: 15 * 60, // 15 minutes (OS minimum)
    });
    console.log("[TokenRefresh] Background task registered");
  } catch (error) {
    console.warn("[TokenRefresh] Background task registration failed:", error);
  }
}

/**
 * Hook that manages proactive token refresh:
 * - Foreground: polls every 60s, refreshes 5 min before expiry
 * - App resume: immediately checks on foregrounding
 * - Background: expo-background-task refreshes periodically
 */
export function useTokenRefresh() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clean up if logged out
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // --- Foreground polling ---
    // Run once immediately, then every POLL_INTERVAL_MS
    silentRefresh();
    intervalRef.current = setInterval(silentRefresh, POLL_INTERVAL_MS);

    // --- App state listener (resume from background) ---
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        silentRefresh();
      }
    };
    const appStateSub = AppState.addEventListener("change", handleAppState);

    // --- Background task ---
    registerBackgroundTask();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      appStateSub.remove();
    };
  }, [isAuthenticated]);
}
