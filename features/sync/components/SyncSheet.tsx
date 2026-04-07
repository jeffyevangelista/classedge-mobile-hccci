import { useCallback } from "react";
import { Dialog } from "heroui-native";
import { View } from "react-native";
import SyncStatusCard from "./SyncStatusCard";
import ForceSyncButton from "./ForceSyncButton";
import { useSyncSheet } from "../SyncSheetContext";

const SyncSheetContent = () => {
  return (
    <>
      <Dialog.Title>Sync Center</Dialog.Title>
      <SyncStatusCard />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          marginTop: 12,
        }}
      >
        <ForceSyncButton />
      </View>
    </>
  );
};

const SyncSheet = () => {
  const { isSyncSheetOpen, closeSyncSheet } = useSyncSheet();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeSyncSheet();
    },
    [closeSyncSheet],
  );

  return (
    <Dialog isOpen={isSyncSheetOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-lg mx-auto">
          <SyncSheetContent />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default SyncSheet;
