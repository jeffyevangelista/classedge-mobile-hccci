import { useState, useEffect } from "react";

export const useClock = (updateInterval = 60000) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Sync the interval to the start of the next minute for a cleaner UI transition
    const timeout = setTimeout(
      () => {
        setNow(new Date());

        const interval = setInterval(() => {
          setNow(new Date());
        }, updateInterval);

        return () => clearInterval(interval);
      },
      (60 - new Date().getSeconds()) * 1000,
    );

    return () => clearTimeout(timeout);
  }, [updateInterval]);

  return now;
};
