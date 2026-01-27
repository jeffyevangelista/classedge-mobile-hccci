import React, { useState } from "react";
import { Button } from "heroui-native";
import { Icon } from "@/components/Icon";
import {
  CloudIcon,
  CloudSlashIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
} from "phosphor-react-native";
import { colors } from "@/utils/colors";
import { useSyncData } from "../useSyncData";
import SyncSheet from "./SyncSheet";

const SyncCenter = () => {
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const {
    uploading,
    unsyncedCount,
    lastSyncedAt,
    pendingChanges,
    downloading,
    connected,
  } = useSyncData();

  const getIconAndColor = () => {
    if (!connected) {
      return { icon: CloudSlashIcon, color: "#EF4444" };
    }
    if (downloading) {
      return { icon: CloudArrowDownIcon, color: "#F59E0B" };
    }
    if (uploading) {
      return { icon: CloudArrowUpIcon, color: "#F59E0B" };
    }
    return { icon: CloudIcon, color: "#10B981" };
  };

  const { icon, color } = getIconAndColor();

  return (
    <>
      <SyncSheet isOpen={isSyncOpen} setIsOpen={setIsSyncOpen} />
      <Button isIconOnly variant="ghost" onPress={() => setIsSyncOpen(true)}>
        <Icon as={icon} color={color} size={30} />
      </Button>
    </>
  );
};

export default SyncCenter;
