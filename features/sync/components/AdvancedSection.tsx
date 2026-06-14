import { useQuery } from "@powersync/react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useThemeColor } from "heroui-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { SYNC_COPY } from "../copy";
import StreamList from "./StreamList";

const bytesToMb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);

const StorageRow = () => {
  const { data: usage } = useQuery<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total, COUNT(*) AS count
     FROM attachments_local WHERE state = 'synced'`,
  );
  const [freeBytes, setFreeBytes] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    FileSystem.getFreeDiskStorageAsync()
      .then((free) => {
        if (!cancelled) setFreeBytes(free);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const usedMb = bytesToMb(usage?.[0]?.total ?? 0);
  const freeMb = freeBytes != null ? bytesToMb(freeBytes) : "—";

  return (
    <View className="px-3 py-2">
      <AppText className="text-xs uppercase tracking-wider text-muted mb-1">
        {SYNC_COPY.advanced.storageHeading}
      </AppText>
      <AppText className="text-sm text-foreground">
        {SYNC_COPY.advanced.storageRow(usedMb, freeMb)}
      </AppText>
    </View>
  );
};

const AdvancedSection = () => {
  const [open, setOpen] = useState(false);
  const mutedColor = useThemeColor("muted");

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <View className="px-4 py-4">
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={SYNC_COPY.advanced.heading}
        className="flex-row items-center gap-2"
      >
        <Icon
          name={open ? "CaretDownIcon" : "CaretRightIcon"}
          size={14}
          color={mutedColor}
        />
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.advanced.heading}
        </AppText>
      </Pressable>

      {open && (
        <View className="mt-3 rounded-xl border border-border bg-surface overflow-hidden">
          <View className="px-3 py-2">
            <StreamList />
          </View>
          <View className="border-t border-border" />
          <StorageRow />
        </View>
      )}
    </View>
  );
};

export default AdvancedSection;
