import { useState, useEffect } from "react";

export const useClock = (updateInterval = 60000) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Sync the interval to the start of the next minute for a cleaner UI transition
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => {
          setNow(new Date());
        }, updateInterval);
      },
      (60 - new Date().getSeconds()) * 1000,
    );

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [updateInterval]);

  return now;
};
