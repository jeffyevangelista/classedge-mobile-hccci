import { useCallback } from "react";
import { Button, Dialog } from "heroui-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import SyncStatusCard from "./SyncStatusCard";
import ForceSyncButton from "./ForceSyncButton";
import { useSyncSheet } from "../SyncSheetContext";
import { useFailedAttachments } from "@/features/attachments/hooks/useFailedAttachments";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { retryAllFailedAttachments } from "@/features/attachments/attachments.api";

const SyncSheetContent = () => {
  const failed = useFailedAttachments();
  const status = useAttachmentStatus();

  return (
    <>
      <Dialog.Title>Sync Center</Dialog.Title>
      <SyncStatusCard />

      {status.lowStorage ? (
        <View className="mt-3 p-3 rounded-lg bg-warning/10">
          <AppText className="text-warning">
            Low device storage. New downloads are paused until you free up
            space.
          </AppText>
        </View>
      ) : null}

      {failed.data && failed.data.length > 0 ? (
        <View className="mt-3 gap-2">
          <AppText weight="semibold">
            {failed.data.length} attachment
            {failed.data.length === 1 ? "" : "s"} failed to download
          </AppText>
          <Button onPress={retryAllFailedAttachments}>
            <Button.Label>Retry all</Button.Label>
          </Button>
        </View>
      ) : null}

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
