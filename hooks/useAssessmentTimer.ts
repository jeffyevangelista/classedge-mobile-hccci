import { useState, useEffect, type MutableRefObject } from "react";

export const useAssessmentTimer = (
  durationSeconds: number,
  elapsedRef: MutableRefObject<number>,
) => {
  const [remainingTime, setRemainingTime] = useState<number>(() => {
    const remaining = durationSeconds - elapsedRef.current;
    return remaining > 0 ? remaining : 0;
  });

  useEffect(() => {
    if (!durationSeconds) return;

    // Immediately sync on duration change to avoid stale 0
    const initial = durationSeconds - elapsedRef.current;
    setRemainingTime(initial > 0 ? initial : 0);

    const interval = setInterval(() => {
      const remaining = durationSeconds - elapsedRef.current;
      setRemainingTime(remaining > 0 ? remaining : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [durationSeconds]);

  const formattedTime = `${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, "0")}`;

  return { remainingTime, formattedTime };
};
