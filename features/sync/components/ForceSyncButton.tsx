import { Button, Spinner, useThemeColor, useToast } from "heroui-native";
import { useCallback, useState } from "react";
import { Icon } from "@/components/Icon";
import { SYNC_COPY } from "@/features/sync/copy";
import { humanizeSyncError } from "@/features/sync/humanizeSyncError";
import useStore from "@/lib/store";
import { Connector } from "@/powersync/Connector";
import { powersync } from "@/powersync/system";

const ForceSyncButton = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { isConnected, isInternetReachable } = useStore();
  const { toast } = useToast();

  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");

  const isOnline = isConnected && isInternetReachable;

  const handleForceSync = useCallback(async () => {
    if (!isOnline) {
      toast.show({
        variant: "warning",
        label: "No connection",
        description:
          "You must be connected to the internet to reconnect the sync.",
      });
      return;
    }

    setIsSyncing(true);
    try {
      await powersync.disconnect();
      const connector = new Connector();
      await powersync.connect(connector);
    } catch (error) {
      console.error("Force sync failed:", error);
      const humanized = humanizeSyncError(error);
      toast.show({
        variant: "danger",
        label: "Sync failed",
        description: humanized.hint
          ? `${humanized.message} ${humanized.hint}`
          : humanized.message,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, toast]);

  return (
    <Button
      variant="outline"
      isDisabled={isSyncing || !isOnline}
      onPress={handleForceSync}
      className="flex-row items-center gap-2"
    >
      {isSyncing ? (
        <>
          <Spinner size="sm" />
          <Button.Label>{SYNC_COPY.status.connecting}</Button.Label>
        </>
      ) : (
        <>
          <Icon
            name="ArrowsClockwiseIcon"
            size={18}
            color={isOnline ? accentColor : mutedColor}
          />
          <Button.Label>{SYNC_COPY.status.reconnect}</Button.Label>
        </>
      )}
    </Button>
  );
};

export default ForceSyncButton;
