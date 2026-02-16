import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { BottomSheet, Card } from "heroui-native";
import { FlatList, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/AppText";
import { useSyncData } from "../useSyncData";

const BOTTOM_SHEET_MAX_WIDTH = 768;

const SheetItem = ({ item }: { item: any }) => {
  return (
    <Card className="p-4 mb-2">
      <View className="gap-2">
        <View className="flex-row justify-between items-center">
          <AppText className="font-semibold text-base">{item.table}</AppText>
          <View className="bg-blue-100 px-2 py-1 rounded">
            <AppText className="text-xs text-blue-700">
              {item.operation}
            </AppText>
          </View>
        </View>
        <AppText className="text-xs text-gray-500">ID: {item.recordId}</AppText>
      </View>
    </Card>
  );
};

// 1. Isolated Content Component
// This component handles the data. When data changes, ONLY this renders.
const SyncSheetContent = () => {
  const {
    hasSynced,
    unsyncedCount,
    pendingChanges,
    lastSyncedAt,
    downloading,
    uploading,
    connected,
    connecting,
  } = useSyncData();

  return (
    <>
      <BottomSheet.Title>Sync Center</BottomSheet.Title>
      <View className="flex-col gap-2">
        <AppText className="text-xs text-gray-500">
          Connection Status:{" "}
          {connected ? (
            <AppText className="text-xs text-green-500">Connected</AppText>
          ) : (
            <AppText className="text-xs text-red-500">Disconnected</AppText>
          )}
        </AppText>
        <AppText className="text-xs text-gray-500">
          Sync Status:{" "}
          {/* {(uploading && <AppText>Uploading</AppText>) ||
            (downloading && <AppText>Downloading</AppText>) || (
              <AppText>Synced</AppText>
            )} */}
          {uploading && <AppText>Uploading</AppText>}
          {downloading && <AppText>Downloading</AppText>}
          {hasSynced && <AppText>Synced</AppText>}
          {unsyncedCount > 0 && <AppText>{unsyncedCount} Unsynced</AppText>}
        </AppText>
        <AppText className="text-xs text-gray-500">
          Last Synced: {lastSyncedAt?.toLocaleString() ?? "Never"}
        </AppText>
      </View>
      <View className="mt-5 flex-1">
        <FlatList
          ListEmptyComponent={
            <AppText className="self-center">No pending Items</AppText>
          }
          data={pendingChanges}
          keyExtractor={(item) => item.rowId.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => <SheetItem item={item} />}
        />
      </View>
    </>
  );
};

interface SyncSheetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}
const SyncSheet = ({ isOpen, setIsOpen }: SyncSheetProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 0,
      minHeight: 400, // Giving it a set height helps stability
    }),
    [screenWidth],
  );

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["50%", "90%"]} style={contentStyle}>
          {/* By nesting the data hook here, the Sheet wrapper remains stable */}
          <SyncSheetContent />
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

export default SyncSheet;
