import { useState, useEffect } from "react";

export const useAssessmentTimer = (
  startedAt: string,
  durationSeconds: number,
  onTimeUp: () => void,
) => {
  const calculateInitialTime = () => {
    if (!startedAt || !durationSeconds) return 0;
    const start = new Date(startedAt).getTime();
    const now = new Date().getTime();
    const elapsed = Math.floor((now - start) / 1000);
    const remaining = durationSeconds - elapsed;
    return remaining > 0 ? remaining : 0;
  };

  const [remainingTime, setRemainingTime] =
    useState<number>(calculateInitialTime);

  useEffect(() => {
    const calculateTime = () => {
      const start = new Date(startedAt).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - start) / 1000);
      const remaining = durationSeconds - elapsed;

      if (remaining <= 0) {
        setRemainingTime(0);
        onTimeUp();
        return false; // Stop the interval
      }
      setRemainingTime(remaining);
      return true;
    };

    // Initial calculation
    calculateTime();

    const interval = setInterval(() => {
      const active = calculateTime();
      if (!active) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, durationSeconds]);

  // Format helper: returns "MM:SS"
  const formattedTime = `${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, "0")}`;

  return { remainingTime, formattedTime };
};
