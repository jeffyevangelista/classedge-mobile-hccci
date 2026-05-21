import { useEffect } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
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

const SyncCenter = () => {
  const { openSyncSheet } = useSyncSheet();
  const { uploading, downloading, connected, connecting } = useSyncData();
  const { isDownloading: attachmentsDownloading, failed: attachmentsFailed } =
    useAttachmentSyncStatus();

  const dangerColor = useThemeColor("danger");
  const warningColor = useThemeColor("warning");
  const successColor = useThemeColor("success");

  const getIconAndColor = (): { icon: IconName; color: string } => {
    if (!connected) {
      return { icon: "CloudSlashIcon", color: dangerColor };
    }
    if (attachmentsFailed > 0 && !attachmentsDownloading) {
      return { icon: "CloudWarningIcon", color: warningColor };
    }
    if (downloading || attachmentsDownloading) {
      return { icon: "CloudArrowDownIcon", color: warningColor };
    }
    if (uploading) {
      return { icon: "CloudArrowUpIcon", color: warningColor };
    }
    return { icon: "CloudCheckIcon", color: successColor };
  };

  const { icon, color } = getIconAndColor();
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

  const badgeCount = attachmentsFailed > 9 ? "9+" : String(attachmentsFailed);

  return (
    <Pressable
      onPress={openSyncSheet}
      accessibilityRole="button"
      accessibilityLabel="Sync center"
      className="w-9 h-9 rounded-full justify-center items-center"
    >
      {connecting ? (
        <ActivityIndicator />
      ) : (
        <Animated.View style={animatedStyle}>
          <Icon name={icon} color={color} size={24} />
        </Animated.View>
      )}
      {attachmentsFailed > 0 && (
        <View
          className="absolute -top-0.5 -right-0.5 bg-danger rounded-full items-center justify-center px-1 border-2 border-surface"
          style={{ minWidth: 16, height: 16 }}
        >
          <AppText
            weight="bold"
            className="text-[9px] text-white"
            style={{ lineHeight: 11 }}
          >
            {badgeCount}
          </AppText>
        </View>
      )}
    </Pressable>
  );
};

export default SyncCenter;
