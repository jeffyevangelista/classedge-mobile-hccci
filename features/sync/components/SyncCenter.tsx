import { useState } from "react";
import { Button, Spinner } from "heroui-native";
import { Icon, PhosphorIcon } from "@/components/Icon";
import { useSyncData } from "../useSyncData";
import SyncSheet from "./SyncSheet";

const SyncCenter = () => {
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const { uploading, downloading, connected, connecting } = useSyncData();

  const getIconAndColor = (): { icon: PhosphorIcon; color: string } => {
    if (!connected) {
      return { icon: "CloudSlashIcon", color: "#EF4444" };
    }

    if (downloading) {
      return { icon: "CloudArrowDownIcon", color: "#F59E0B" };
    }
    if (uploading) {
      return { icon: "CloudArrowUpIcon", color: "#F59E0B" };
    }
    return { icon: "CloudIcon", color: "#10B981" };
  };

  const { icon, color } = getIconAndColor();

  return (
    <>
      <SyncSheet isOpen={isSyncOpen} setIsOpen={setIsSyncOpen} />
      <Button isIconOnly variant="ghost" onPress={() => setIsSyncOpen(true)}>
        {connecting ? (
          <Spinner />
        ) : (
          <Icon name={icon} color={color} size={30} />
        )}
      </Button>
    </>
  );
};

export default SyncCenter;
