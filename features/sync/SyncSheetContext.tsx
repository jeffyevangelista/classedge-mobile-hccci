import { createContext, useContext, useState, useCallback } from "react";

type SyncSheetContextType = {
  isSyncSheetOpen: boolean;
  openSyncSheet: () => void;
  closeSyncSheet: () => void;
};

const SyncSheetContext = createContext<SyncSheetContextType>({
  isSyncSheetOpen: false,
  openSyncSheet: () => {},
  closeSyncSheet: () => {},
});

export const SyncSheetProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isSyncSheetOpen, setIsSyncSheetOpen] = useState(false);

  const openSyncSheet = useCallback(() => {
    setIsSyncSheetOpen(true);
  }, []);

  const closeSyncSheet = useCallback(() => {
    setIsSyncSheetOpen(false);
  }, []);

  return (
    <SyncSheetContext.Provider
      value={{ isSyncSheetOpen, openSyncSheet, closeSyncSheet }}
    >
      {children}
    </SyncSheetContext.Provider>
  );
};

export const useSyncSheet = () => {
  const context = useContext(SyncSheetContext);
  if (!context) {
    throw new Error("useSyncSheet must be used within a SyncSheetProvider");
  }
  return context;
};
