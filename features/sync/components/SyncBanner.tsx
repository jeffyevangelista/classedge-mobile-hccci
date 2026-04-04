import { useSyncData } from "../useSyncData";
import { Spinner } from "heroui-native";
import { Icon } from "@/components/Icon";
import { Button } from "heroui-native";
import { useThemeColor } from "heroui-native";
import { useSyncSheet } from "../SyncSheetContext";

const SyncBanner = () => {
  const { openSyncSheet } = useSyncSheet();
  const { uploading, unsyncedCount, connected } = useSyncData();
  const themeColorDangerForeground = useThemeColor("danger-foreground");

  if (unsyncedCount > 0 && !connected) {
    return (
      <Button
        variant="danger"
        isDisabled={uploading}
        className="flex flex-row items-center gap-2.5 rounded-3xl "
        onPress={openSyncSheet}
      >
        {uploading ? (
          <Spinner />
        ) : (
          <>
            <Icon
              name="WarningCircleIcon"
              size={24}
              color={themeColorDangerForeground}
            />
            <Button.Label>Review {unsyncedCount} Unsynced Items</Button.Label>
          </>
        )}
      </Button>
    );
  }

  return null;
};

export default SyncBanner;
