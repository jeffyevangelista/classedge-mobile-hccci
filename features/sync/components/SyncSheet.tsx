import { useMemo, useCallback } from "react";
import { BottomSheet } from "heroui-native";
import { useWindowDimensions, View } from "react-native";
import SyncStatusCard from "./SyncStatusCard";
import ForceSyncButton from "./ForceSyncButton";
import { useSyncSheet } from "../SyncSheetContext";

const BOTTOM_SHEET_MAX_WIDTH = 768;

const SyncSheetContent = () => {
  return (
    <>
      <BottomSheet.Title>Sync Center</BottomSheet.Title>
      <SyncStatusCard />
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
  const { width: screenWidth } = useWindowDimensions();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeSyncSheet();
    },
    [closeSyncSheet],
  );

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 0,
      minHeight: 400,
    }),
    [screenWidth],
  );

  return (
    <BottomSheet isOpen={isSyncSheetOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached={true}
          snapPoints={["50%"]}
          style={contentStyle}
        >
          <SyncSheetContent />
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

export default SyncSheet;
