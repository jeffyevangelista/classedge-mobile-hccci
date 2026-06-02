import { useCallback, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button, Dialog, useThemeColor, useToast } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import SyncStatusCard from "./SyncStatusCard";
import ForceSyncButton from "./ForceSyncButton";
import StreamList from "./StreamList";
import { useSyncSheet } from "../SyncSheetContext";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { retryAllFailedAttachments } from "@/features/attachments/attachments.api";

type SyncAlertProps = {
  variant: "warning" | "danger";
  icon: IconName;
  message: string;
  messageWeight?: "regular" | "semibold";
  action?: ReactNode;
};

const SyncAlert = ({
  variant,
  icon,
  message,
  messageWeight = "regular",
  action,
}: SyncAlertProps) => {
  const color = useThemeColor(variant);
  const bgClass = variant === "warning" ? "bg-warning-soft" : "bg-danger-soft";
  const textClass = variant === "warning" ? "text-warning" : "text-danger";
  return (
    <View className={`mt-3 p-3 rounded-lg gap-2 ${bgClass}`}>
      <View className="flex-row items-start gap-2">
        <Icon name={icon} size={16} color={color} />
        <AppText weight={messageWeight} className={`flex-1 text-sm ${textClass}`}>
          {message}
        </AppText>
      </View>
      {action}
    </View>
  );
};

const SyncSheetContent = () => {
  const status = useAttachmentStatus();
  const { toast } = useToast();

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
      console.error("[SyncSheet] retryAllFailedAttachments failed", err);
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

  const failedCount = status.failed;

  return (
    <>
      <Dialog.Title>Sync Center</Dialog.Title>
      <SyncStatusCard />

      {status.lowStorage && (
        <SyncAlert
          variant="warning"
          icon="WarningIcon"
          message="Low device storage. New downloads are paused until you free up space."
        />
      )}

      {failedCount > 0 && (
        <SyncAlert
          variant="danger"
          icon="WarningCircleIcon"
          messageWeight="semibold"
          message={`${failedCount} attachment${failedCount === 1 ? "" : "s"} failed to download`}
          action={
            <Button
              variant="danger"
              size="sm"
              onPress={handleRetryAll}
              isDisabled={isRetrying}
            >
              {isRetrying && <ActivityIndicator size="small" color="white" />}
              <Button.Label>
                {isRetrying ? "Retrying..." : "Retry all"}
              </Button.Label>
            </Button>
          }
        />
      )}

      <StreamList />

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
