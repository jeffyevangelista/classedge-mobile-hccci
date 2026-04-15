import { Button } from "heroui-native";
import { Icon, IconName } from "@/components/Icon";
import { useSyncData } from "../useSyncData";
import { useSyncSheet } from "../SyncSheetContext";
import { ActivityIndicator } from "react-native";

const SyncCenter = () => {
  const { openSyncSheet } = useSyncSheet();
  const { uploading, downloading, connected, connecting } = useSyncData();

  const getIconAndColor = (): { icon: IconName; color: string } => {
    if (!connected) {
      return { icon: "CloudSlashIcon", color: "#EF4444" };
    }

    if (downloading) {
      return { icon: "CloudArrowDownIcon", color: "#F59E0B" };
    }
    if (uploading) {
      return { icon: "CloudArrowUpIcon", color: "#F59E0B" };
    }
    return { icon: "CloudCheckIcon", color: "#10B981" };
  };

  const { icon, color } = getIconAndColor();

  return (
    <Button isIconOnly variant="ghost" onPress={openSyncSheet}>
      {connecting ? (
        <ActivityIndicator />
      ) : (
        <Icon name={icon} color={color} size={26} />
      )}
    </Button>
  );
};

export default SyncCenter;
