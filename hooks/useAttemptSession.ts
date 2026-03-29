import { useEffect, useRef, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  updateHeartbeat,
  updateLastIndex,
  submitAttempt,
} from "@/features/assessment/assessment.service";

const HEARTBEAT_INTERVAL_MS = 10_000;
const MINOR_GLITCH_THRESHOLD_S = 30;

type AttemptData = {
  localId: string;
  duration: number;
  totalElapsedSeconds: number;
  lastHeartbeatAt: string;
  lastIndex: number;
  status: string;
};

type UseAttemptSessionOptions = {
  attempt: AttemptData | null | undefined;
  onAutoSubmit: () => void;
};

export const useAttemptSession = ({
  attempt,
  onAutoSubmit,
}: UseAttemptSessionOptions) => {
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const monotonicBaseRef = useRef(Date.now());
  const isSubmittingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize from stored values on mount or when attempt changes
  useEffect(() => {
    if (!attempt) return;

    const now = Date.now();
    const lastHeartbeat = new Date(attempt.lastHeartbeatAt).getTime();
    const gapSeconds = Math.floor((now - lastHeartbeat) / 1000);

    if (lastHeartbeat > now) {
      // Clock was set backwards — tampered. Auto-submit immediately.
      console.warn(
        "[AttemptSession] Clock tampering detected. Auto-submitting.",
      );
      handleAutoSubmit();
      return;
    }

    if (gapSeconds <= MINOR_GLITCH_THRESHOLD_S) {
      // Minor glitch: resume from stored elapsed
      elapsedRef.current = attempt.totalElapsedSeconds;
    } else {
      // Large gap: add the gap to elapsed to penalize closing the app
      elapsedRef.current = attempt.totalElapsedSeconds + gapSeconds;
    }

    lastTickRef.current = now;
    monotonicBaseRef.current = now;
  }, [attempt?.localId]);

  const handleAutoSubmit = useCallback(async () => {
    if (!attempt || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      await updateHeartbeat(attempt.localId, elapsedRef.current);
      await submitAttempt(attempt.localId, 0);
      onAutoSubmit();
    } catch (err) {
      console.error("[AttemptSession] Auto-submit failed:", err);
      isSubmittingRef.current = false;
    }
  }, [attempt?.localId, onAutoSubmit]);

  // Main timer tick + heartbeat
  useEffect(() => {
    if (!attempt) return;
    if (attempt.status === "completed") return;

    const duration = attempt.duration;
    let heartbeatAccumulator = 0;

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = Math.floor((now - lastTickRef.current) / 1000);

      // Detect monotonic clock jump (clock set backwards during session)
      if (now < monotonicBaseRef.current) {
        console.warn(
          "[AttemptSession] Monotonic clock jump detected. Auto-submitting.",
        );
        handleAutoSubmit();
        return;
      }

      if (delta <= 0) return;

      elapsedRef.current += delta;
      lastTickRef.current = now;
      monotonicBaseRef.current = now;
      heartbeatAccumulator += delta * 1000;

      // Check if time is up
      if (elapsedRef.current >= duration) {
        handleAutoSubmit();
        clearInterval(interval);
        return;
      }

      // Heartbeat every 10 seconds
      if (heartbeatAccumulator >= HEARTBEAT_INTERVAL_MS) {
        heartbeatAccumulator = 0;
        updateHeartbeat(attempt.localId, elapsedRef.current).catch((err) =>
          console.error("[AttemptSession] Heartbeat update failed:", err),
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [attempt?.localId, attempt?.status, handleAutoSubmit]);

  // AppState listener: detect background/foreground transitions
  useEffect(() => {
    if (!attempt) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prevState = appStateRef.current;

        if (prevState.match(/inactive|background/) && nextState === "active") {
          // Returning to foreground
          const now = Date.now();
          const lastHeartbeat = new Date(attempt.lastHeartbeatAt).getTime();

          // Clock tampering check
          if (now < lastHeartbeat) {
            console.warn(
              "[AttemptSession] Clock set backwards on resume. Auto-submitting.",
            );
            handleAutoSubmit();
            return;
          }

          const gapMs = now - lastTickRef.current;
          const gapSeconds = Math.floor(gapMs / 1000);

          // Always accumulate the gap time (the timer keeps ticking conceptually)
          elapsedRef.current += gapSeconds;
          lastTickRef.current = now;
          monotonicBaseRef.current = now;

          // Save heartbeat immediately on resume
          updateHeartbeat(attempt.localId, elapsedRef.current).catch((err) =>
            console.error("[AttemptSession] Resume heartbeat failed:", err),
          );

          // Check if time expired while in background
          if (elapsedRef.current >= attempt.duration) {
            handleAutoSubmit();
          }
        }

        appStateRef.current = nextState;
      },
    );

    return () => subscription.remove();
  }, [attempt?.localId, handleAutoSubmit]);

  const saveLastIndex = useCallback(
    async (index: number) => {
      if (!attempt) return;
      try {
        await updateLastIndex(attempt.localId, index);
      } catch (err) {
        console.error("[AttemptSession] Failed to save lastIndex:", err);
      }
    },
    [attempt?.localId],
  );

  const getElapsedSeconds = useCallback(() => elapsedRef.current, []);

  const getRemainingSeconds = useCallback(() => {
    if (!attempt) return 0;
    const remaining = attempt.duration - elapsedRef.current;
    return remaining > 0 ? remaining : 0;
  }, [attempt?.duration]);

  const isTimeUp = useCallback(() => {
    if (!attempt) return false;
    return elapsedRef.current >= attempt.duration;
  }, [attempt?.duration]);

  return {
    saveLastIndex,
    getElapsedSeconds,
    getRemainingSeconds,
    isTimeUp,
    handleAutoSubmit,
    elapsedRef,
  };
};
