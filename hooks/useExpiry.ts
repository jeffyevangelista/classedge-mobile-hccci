import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export const useExpiry = (
  willEndAtIso: string | undefined,
  onExpire: () => void,
) => {
  const [isExpired, setIsExpired] = useState(false);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!willEndAtIso) return;
    const willEndMs = new Date(willEndAtIso).getTime();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      setIsExpired(true);
      onExpireRef.current();
    };

    const arm = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const remaining = willEndMs - Date.now();
      if (remaining <= 0) {
        fire();
        return;
      }
      timeoutId = setTimeout(fire, remaining);
    };

    arm();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") arm();
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      sub.remove();
    };
  }, [willEndAtIso]);

  return isExpired;
};
