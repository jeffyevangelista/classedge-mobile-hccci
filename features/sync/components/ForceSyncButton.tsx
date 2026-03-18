import { useState, useCallback } from "react";
import { Button, Spinner } from "heroui-native";
import { Icon } from "@/components/Icon";
import { powersync } from "@/powersync/system";
import { Connector } from "@/powersync/Connector";
import useStore from "@/lib/store";
import { AppText } from "@/components/AppText";
import { Alert, View } from "react-native";

const ForceSyncButton = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { isConnected, isInternetReachable } = useStore();

  const isOnline = isConnected && isInternetReachable;

  const handleForceSync = useCallback(async () => {
    if (!isOnline) {
      Alert.alert(
        "No Connection",
        "You must be connected to the internet to force a sync.",
      );
      return;
    }

    setIsSyncing(true);
    try {
      // Disconnect, then reconnect to force a full re-sync cycle
      await powersync.disconnect();
      const connector = new Connector();
      await powersync.connect(connector);
    } catch (error) {
      console.error("Force sync failed:", error);
      Alert.alert(
        "Sync Failed",
        "An error occurred while trying to sync. Please try again.",
      );
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

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
          <Button.Label>Syncing...</Button.Label>
        </>
      ) : (
        <>
          <Icon
            name="ArrowsClockwiseIcon"
            size={18}
            color={isOnline ? "#3B82F6" : "#9CA3AF"}
          />
          <Button.Label>Force Resync</Button.Label>
        </>
      )}
    </Button>
  );
};

export default ForceSyncButton;
