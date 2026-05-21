import { useCallback, useState } from "react";
import { Button, Dialog, useThemeColor, useToast } from "heroui-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import SyncStatusCard from "./SyncStatusCard";
import ForceSyncButton from "./ForceSyncButton";
import { useSyncSheet } from "../SyncSheetContext";
import { useFailedAttachments } from "@/features/attachments/hooks/useFailedAttachments";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { retryAllFailedAttachments } from "@/features/attachments/attachments.api";

const SyncSheetContent = () => {
  const failed = useFailedAttachments();
  const status = useAttachmentStatus();
  const { toast } = useToast();
  const warningColor = useThemeColor("warning");
  const dangerColor = useThemeColor("danger");

  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryAll = useCallback(async () => {
    setIsRetrying(true);
    try {
      await retryAllFailedAttachments();
      toast.show({
        variant: "success",
        label: "Retry queued",
        description: "Failed attachments are being downloaded again.",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to retry attachments.";
      toast.show({
        variant: "danger",
        label: "Retry failed",
        description: message,
      });
    } finally {
      setIsRetrying(false);
    }
  }, [toast]);

  const failedCount = failed.data?.length ?? 0;

  return (
    <>
      <Dialog.Title>Sync Center</Dialog.Title>
      <SyncStatusCard />

      {status.lowStorage && (
        <View className="mt-3 p-3 rounded-lg bg-warning-soft flex-row items-start gap-2">
          <Icon name="WarningIcon" size={16} color={warningColor} />
          <AppText className="text-warning flex-1 text-sm">
            Low device storage. New downloads are paused until you free up
            space.
          </AppText>
        </View>
      )}

      {failedCount > 0 && (
        <View className="mt-3 p-3 rounded-lg bg-danger-soft gap-2">
          <View className="flex-row items-start gap-2">
            <Icon name="WarningCircleIcon" size={16} color={dangerColor} />
            <AppText weight="semibold" className="text-danger flex-1 text-sm">
              {failedCount} attachment{failedCount === 1 ? "" : "s"} failed to
              download
            </AppText>
          </View>
          <Button
            variant="danger"
            size="sm"
            onPress={handleRetryAll}
            isDisabled={isRetrying}
          >
            <Button.Label>
              {isRetrying ? "Retrying..." : "Retry all"}
            </Button.Label>
          </Button>
        </View>
      )}

      <View className="flex-row justify-end mt-3">
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
