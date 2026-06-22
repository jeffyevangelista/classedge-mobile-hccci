import { Spinner, useThemeColor } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { formatRelative } from "@/utils/getRelativeTime";
import { SYNC_COPY } from "../copy";
import { useSyncData } from "../useSyncData";
import ForceSyncButton from "./ForceSyncButton";

const StatusRow = ({
  label,
  value,
  icon,
  iconColor,
  showSpinner,
}: {
  label: string;
  value: string;
  icon?: IconName;
  iconColor?: string;
  showSpinner?: boolean;
}) => (
  <View className="flex-row items-center justify-between py-1.5">
    <AppText className="text-sm text-muted">{label}</AppText>
    <View className="flex-row items-center gap-1.5 flex-shrink">
      {showSpinner ? (
        <Spinner size="sm" />
      ) : icon ? (
        <Icon name={icon} size={16} color={iconColor} />
      ) : null}
      <AppText
        className="text-sm text-foreground"
        style={iconColor ? { color: iconColor } : undefined}
        numberOfLines={1}
      >
        {value}
      </AppText>
    </View>
  </View>
);

const StatusSection = () => {
  const {
    connected,
    connecting,
    uploading,
    downloading,
    unsyncedCount,
    lastSyncedAt,
  } = useSyncData();
  const attachments = useAttachmentStatus();

  const successColor = useThemeColor("success");
  const warningColor = useThemeColor("warning");
  const dangerColor = useThemeColor("danger");
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");

  // Context-aware subtitle copy.
  const subtitle = useMemo(() => {
    if (attachments.lowStorage) return SYNC_COPY.status.lowStorage;
    if (connecting) return SYNC_COPY.status.connecting;
    if (!connected) {
      return unsyncedCount > 0
        ? SYNC_COPY.status.offlineWithPending(unsyncedCount)
        : SYNC_COPY.status.offline;
    }
    if (uploading) return SYNC_COPY.status.syncing;
    if (downloading) return SYNC_COPY.status.downloading;
    return SYNC_COPY.status.synced;
  }, [
    attachments.lowStorage,
    connecting,
    connected,
    unsyncedCount,
    uploading,
    downloading,
  ]);

  const connectionConfig = connecting
    ? { value: "Connecting…", color: warningColor, icon: undefined }
    : connected
      ? {
          value: "Connected",
          color: successColor,
          icon: "CloudCheckIcon" as IconName,
        }
      : {
          value: "Offline",
          color: dangerColor,
          icon: "CloudSlashIcon" as IconName,
        };

  const activityConfig = uploading
    ? {
        value: "Uploading…",
        color: accentColor,
        icon: "CloudArrowUpIcon" as IconName,
      }
    : downloading
      ? {
          value: "Downloading…",
          color: accentColor,
          icon: "CloudArrowDownIcon" as IconName,
        }
      : unsyncedCount > 0
        ? {
            value: `${unsyncedCount} pending`,
            color: warningColor,
            icon: "WarningCircleIcon" as IconName,
          }
        : {
            value: "All synced",
            color: successColor,
            icon: "CheckCircleIcon" as IconName,
          };

  return (
    <View className="px-4 py-4">
      <AppText className="text-xs uppercase tracking-wider text-muted mb-2">
        Status
      </AppText>

      <View className="rounded-xl border border-border bg-surface p-3">
        <AppText className="text-sm text-foreground mb-2">{subtitle}</AppText>

        <StatusRow
          label="Connection"
          value={connectionConfig.value}
          icon={connectionConfig.icon}
          iconColor={connectionConfig.color}
          showSpinner={connecting}
        />
        <StatusRow
          label="Sync activity"
          value={activityConfig.value}
          icon={activityConfig.icon}
          iconColor={activityConfig.color}
          showSpinner={!!uploading || !!downloading}
        />
        <StatusRow label="Pending uploads" value={String(unsyncedCount)} />
        <StatusRow
          label="Attachments"
          value={
            attachments.total === 0
              ? "—"
              : `${attachments.synced} / ${attachments.total}`
          }
          icon={
            attachments.failed > 0
              ? "WarningCircleIcon"
              : attachments.isDownloading
                ? "CloudArrowDownIcon"
                : "CheckCircleIcon"
          }
          iconColor={
            attachments.failed > 0
              ? warningColor
              : attachments.isDownloading
                ? accentColor
                : successColor
          }
        />
        <StatusRow
          label="Last sync"
          value={
            lastSyncedAt
              ? formatRelative(lastSyncedAt)
              : SYNC_COPY.lastSyncedNever
          }
          iconColor={mutedColor}
        />
      </View>

      <View className="flex-row gap-2 mt-3">
        <ForceSyncButton />
      </View>
    </View>
  );
};

export default StatusSection;
