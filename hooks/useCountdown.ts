import { useEffect, useState } from "react";

type CountdownResult = {
  remaining: number;
  formatted: string;
  isExpired: boolean;
};

export const useCountdown = (
  willEndAtIso: string | undefined,
  tickMs = 500,
): CountdownResult => {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!willEndAtIso) return;
    const interval = setInterval(() => setTick((t) => t + 1), tickMs);
    return () => clearInterval(interval);
  }, [willEndAtIso, tickMs]);

  if (!willEndAtIso) {
    return { remaining: 0, formatted: "0:00", isExpired: true };
  }

  const willEndMs = new Date(willEndAtIso).getTime();
  const remainingMs = Math.max(0, willEndMs - Date.now());
  const remaining = Math.ceil(remainingMs / 1000);
  const formatted = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return { remaining, formatted, isExpired: remainingMs <= 0 };
};
