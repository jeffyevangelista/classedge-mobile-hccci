import { Spinner } from "heroui-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { useSyncData } from "../useSyncData";

type StatusConfig = {
  label: string;
  color: string;
  icon: string;
};

const getConnectionStatus = (
  connected: boolean,
  connecting: boolean,
): StatusConfig => {
  if (connecting) {
    return {
      label: "Connecting...",
      color: "#F59E0B",
      icon: "ArrowsClockwiseIcon",
    };
  }
  if (connected) {
    return { label: "Connected", color: "#10B981", icon: "CloudCheckIcon" };
  }
  return { label: "Disconnected", color: "#EF4444", icon: "CloudSlashIcon" };
};

const getSyncActivity = (
  uploading: boolean,
  downloading: boolean,
  hasSynced: boolean,
  unsyncedCount: number,
): StatusConfig => {
  if (uploading) {
    return {
      label: "Uploading changes...",
      color: "#3B82F6",
      icon: "CloudArrowUpIcon",
    };
  }
  if (downloading) {
    return {
      label: "Downloading data...",
      color: "#3B82F6",
      icon: "CloudArrowDownIcon",
    };
  }
  if (unsyncedCount > 0) {
    return {
      label: `${unsyncedCount} pending change${unsyncedCount > 1 ? "s" : ""}`,
      color: "#F59E0B",
      icon: "WarningCircleIcon",
    };
  }
  if (hasSynced) {
    return {
      label: "All data synced",
      color: "#10B981",
      icon: "CheckCircleIcon",
    };
  }
  return {
    label: "Waiting for first sync",
    color: "#6B7280",
    icon: "ClockIcon",
  };
};

const getAttachmentStatus = (status: {
  total: number;
  synced: number;
  inFlight: number;
  failed: number;
}): StatusConfig => {
  const { total, synced, inFlight, failed } = status;

  if (total === 0) {
    return {
      label: "No attachments",
      color: "#6B7280",
      icon: "ImageSquareIcon",
    };
  }
  if (inFlight > 0) {
    return {
      label: `${synced} of ${total} downloaded `,
      color: "#3B82F6",
      icon: "CloudArrowDownIcon",
    };
  }
  if (failed > 0) {
    return {
      label: `${failed} failed · ${synced} of ${total} downloaded`,
      color: "#F59E0B",
      icon: "WarningCircleIcon",
    };
  }
  return {
    label: `All ${total} downloaded`,
    color: "#10B981",
    icon: "CheckCircleIcon",
  };
};

const StatusRow = ({
  label,
  value,
  config,
  showSpinner,
}: {
  label: string;
  value?: string;
  config?: StatusConfig;
  showSpinner?: boolean;
}) => (
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    }}
  >
    <AppText className="text-sm text-muted">{label}</AppText>
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexShrink: 1,
      }}
    >
      {showSpinner ? (
        <Spinner size="sm" />
      ) : config ? (
        <Icon name={config.icon as any} size={16} color={config.color} />
      ) : null}
      <AppText
        className="text-sm text-foreground"
        style={config?.color ? { color: config.color } : undefined}
        numberOfLines={1}
      >
        {config?.label ?? value ?? "—"}
      </AppText>
    </View>
  </View>
);

const SyncStatusCard = () => {
  const {
    hasSynced,
    unsyncedCount,
    lastSyncedAt,
    uploading,
    downloading,
    connected,
    connecting,
    downloadError,
    uploadError,
  } = useSyncData();

  const attachments = useAttachmentStatus();

  const connectionStatus = getConnectionStatus(!!connected, !!connecting);
  const syncActivity = getSyncActivity(
    !!uploading,
    !!downloading,
    !!hasSynced,
    unsyncedCount,
  );
  const attachmentStatus = getAttachmentStatus(attachments);

  return (
    <View className="mt-3">
      <View style={{ gap: 2 }}>
        <StatusRow
          label="Connection"
          config={connectionStatus}
          showSpinner={connecting}
        />
        <StatusRow
          label="Sync Activity"
          config={syncActivity}
          showSpinner={!!uploading || !!downloading}
        />
        <StatusRow
          label="Attachments"
          config={attachmentStatus}
          showSpinner={attachments.inFlight > 0}
        />
        <StatusRow
          label="Last Synced"
          value={lastSyncedAt ? lastSyncedAt.toLocaleString() : "Never"}
        />
        <StatusRow label="Pending Changes" value={String(unsyncedCount)} />
      </View>

      {(downloadError || uploadError) && (
        <View className="mt-3 p-3 rounded-lg bg-danger-soft flex-row items-center gap-1.5">
          <Icon name="WarningIcon" size={16} color="#EF4444" />
          <AppText className="text-xs text-danger flex-1">
            {downloadError
              ? `Download error: ${downloadError.message}`
              : `Upload error: ${uploadError?.message}`}
          </AppText>
        </View>
      )}
    </View>
  );
};

export default SyncStatusCard;
