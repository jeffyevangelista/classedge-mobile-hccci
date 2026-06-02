import { useEffect, useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { useSyncData } from "../useSyncData";
import { useSyncSheet } from "../SyncSheetContext";
import { useAttachmentSyncStatus } from "@/features/attachments/hooks/useAttachmentSyncStatus";

const SyncBadge = ({ count }: { count: number }) => (
  <View className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-danger rounded-full items-center justify-center px-1 border-2 border-surface">
    <AppText
      weight="bold"
      className="text-[9px] text-white"
      style={{ lineHeight: 11 }}
    >
      {count > 9 ? "9+" : String(count)}
    </AppText>
  </View>
);

const SyncCenter = () => {
  const { openSyncSheet } = useSyncSheet();
  const { uploading, downloading, connected, connecting } = useSyncData();
  const { isDownloading: attachmentsDownloading, failed: attachmentsFailed } =
    useAttachmentSyncStatus();

  const dangerColor = useThemeColor("danger");
  const warningColor = useThemeColor("warning");
  const successColor = useThemeColor("success");
  const mutedColor = useThemeColor("muted");

  const { icon, color } = useMemo<{ icon: IconName; color: string }>(() => {
    if (!connected) return { icon: "CloudSlashIcon", color: dangerColor };
    if (attachmentsFailed > 0 && !attachmentsDownloading) {
      return { icon: "CloudWarningIcon", color: warningColor };
    }
    if (downloading || attachmentsDownloading) {
      return { icon: "CloudArrowDownIcon", color: warningColor };
    }
    if (uploading) return { icon: "CloudArrowUpIcon", color: warningColor };
    return { icon: "CloudCheckIcon", color: successColor };
  }, [
    connected,
    attachmentsFailed,
    attachmentsDownloading,
    downloading,
    uploading,
    dangerColor,
    warningColor,
    successColor,
  ]);

  const accessibilityLabel = useMemo(() => {
    if (!connected) return "Sync center, offline";
    if (attachmentsFailed > 0 && !attachmentsDownloading) {
      return `Sync center, ${attachmentsFailed} failed download${attachmentsFailed === 1 ? "" : "s"}`;
    }
    if (downloading || attachmentsDownloading) return "Sync center, downloading";
    if (uploading) return "Sync center, uploading";
    return "Sync center, synced";
  }, [
    connected,
    attachmentsFailed,
    attachmentsDownloading,
    downloading,
    uploading,
  ]);

  const isActiveSync =
    !connecting && (!!uploading || !!downloading || attachmentsDownloading);

  // Pulse the icon while sync is actively running so the activity registers
  // at a glance without forcing a directional arrow to spin.
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (isActiveSync) {
      opacity.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
    } else {
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [isActiveSync, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Spin the ArrowsClockwise icon while establishing the connection.
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (connecting) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      rotation.value = 0;
    }
  }, [connecting, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      onPress={openSyncSheet}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="w-9 h-9 rounded-full justify-center items-center"
    >
      {connecting ? (
        <Animated.View key="spin" style={spinStyle}>
          <Icon name="ArrowsClockwiseIcon" color={mutedColor} size={24} />
        </Animated.View>
      ) : isActiveSync ? (
        <Animated.View key="pulse" style={animatedStyle}>
          <Icon name={icon} color={color} size={24} />
        </Animated.View>
      ) : (
        <Icon name={icon} color={color} size={24} />
      )}
      {attachmentsFailed > 0 && <SyncBadge count={attachmentsFailed} />}
    </Pressable>
  );
};

export default SyncCenter;
