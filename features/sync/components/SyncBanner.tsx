import React, { useState } from "react";
import { useSyncData } from "../useSyncData";
import { Spinner } from "heroui-native";
import { Icon } from "@/components/Icon";
import { WarningCircleIcon } from "phosphor-react-native";
import { Button } from "heroui-native";
import { useThemeColor } from "heroui-native";
import SyncSheet from "./SyncSheet";

const SyncBanner = () => {
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const { uploading, unsyncedCount, connected } = useSyncData();
  const themeColorDangerForeground = useThemeColor("danger-foreground");

  if (unsyncedCount > 0 && !connected) {
    return (
      <>
        <SyncSheet isOpen={isSyncOpen} setIsOpen={setIsSyncOpen} />
        <Button
          variant="danger"
          isDisabled={uploading}
          className="flex flex-row items-center gap-2.5 rounded-3xl "
          onPress={() => setIsSyncOpen(true)}
        >
          {uploading ? (
            <Spinner />
          ) : (
            <>
              <Icon
                as={WarningCircleIcon}
                size={24}
                color={themeColorDangerForeground}
              />
              <Button.Label>Review {unsyncedCount} Unsynced Items</Button.Label>
            </>
          )}
        </Button>
      </>
    );
  }

  return null;
};

export default SyncBanner;
