import useStore from "@/lib/store";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { refresh } from "./refreshToken";

const BACKGROUND_TOKEN_REFRESH = "BACKGROUND_TOKEN_REFRESH";

// Refresh the token 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
// Foreground polling interval (60 seconds)
const POLL_INTERVAL_MS = 60 * 1000;

/**
 * Silently refresh tokens when needed.
 * Returns true if tokens were refreshed, false otherwise.
 */
async function silentRefresh(): Promise<boolean> {
  const {
    refreshToken,
    expiresAt,
    isConnected,
    isInternetReachable,
    setAccessToken,
    setPowersyncToken,
    setRefreshToken,
  } = useStore.getState();

  // Skip when offline — session stays valid locally
  if (!isConnected || !isInternetReachable) return false;
  // No session to refresh
  if (!refreshToken || !expiresAt) return false;

  const timeUntilExpiry = expiresAt - Date.now();

  // Only refresh if we're within the buffer window
  if (timeUntilExpiry > REFRESH_BUFFER_MS) return false;

  // Capture local onboarding state before the refresh overwrites it
  const wasOnboardingDone =
    useStore.getState().authUser?.needsOnboarding === false;

  try {
    const data = await refresh(refreshToken);
    setAccessToken(data.accessToken);
    // Preserve local needsOnboarding: false if the server JWT is stale
    if (wasOnboardingDone && useStore.getState().authUser?.needsOnboarding) {
      useStore.getState().setNeedsOnboarding(false);
    }
    setPowersyncToken(data.powersyncToken);
    await setRefreshToken(data.refreshToken);
    console.log("[TokenRefresh] Tokens refreshed silently");
    return true;
  } catch (error) {
    console.warn("[TokenRefresh] Silent refresh failed:", error);
    return false;
  }
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
