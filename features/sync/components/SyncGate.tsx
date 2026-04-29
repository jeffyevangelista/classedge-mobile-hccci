import { useEffect, useRef, useState } from "react";
import { useStatus } from "@powersync/react-native";
import SyncSplash from "./SyncSplash";

type Props = { children: React.ReactNode };

export const SyncGate = ({ children }: Props) => {
  const status = useStatus();
  const streams = status.syncStreams;

  const allStreamsSynced =
    streams != null &&
    streams.length > 0 &&
    streams.every((s) => s.subscription.hasSynced === true);

  // Returning user with cached data: hasSynced is true the moment SQLite
  // opens, so we can let them in immediately even if currently offline.
  // Capture at mount so a mid-session flip doesn't confuse us.
  const wasSyncedAtMountRef = useRef<boolean | null>(null);
  if (wasSyncedAtMountRef.current === null) {
    wasSyncedAtMountRef.current = status.hasSynced === true;
  }
  const returningUser = wasSyncedAtMountRef.current === true;

  // First-time sync latch: once every stream is synced, stay open even if
  // connectivity drops (which clears syncStreams metadata).
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (allStreamsSynced) setOpened(true);
  }, [allStreamsSynced]);

  if (returningUser || opened) {
    return <>{children}</>;
  }

  return <SyncSplash />;
};

export default SyncGate;
