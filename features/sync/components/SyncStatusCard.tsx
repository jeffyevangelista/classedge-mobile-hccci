import { View } from "react-native";
import { Card, Spinner } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useSyncData } from "../useSyncData";
import { useAttachmentSyncStatus } from "@/features/attachments/hooks/useAttachmentSyncStatus";

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
      label: `${synced} of ${total} downloaded · ${inFlight} pending`,
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
    <AppText className="text-sm text-gray-500">{label}</AppText>
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
        className="text-sm"
        style={{ color: config?.color ?? "#374151" }}
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

  const attachments = useAttachmentSyncStatus();

  const connectionStatus = getConnectionStatus(!!connected, !!connecting);
  const syncActivity = getSyncActivity(
    !!uploading,
    !!downloading,
    !!hasSynced,
    unsyncedCount,
  );
  const attachmentStatus = getAttachmentStatus(attachments);

  return (
    <Card className="p-4 rounded-xl shadow-none">
      <AppText weight="semibold" className="text-base mb-3">
        Sync Status
      </AppText>

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
        <View
          style={{
            marginTop: 12,
            backgroundColor: "#FEF2F2",
            borderRadius: 8,
            padding: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="WarningIcon" size={16} color="#EF4444" />
            <AppText className="text-xs text-red-600">
              {downloadError
                ? `Download error: ${downloadError.message}`
                : `Upload error: ${uploadError?.message}`}
            </AppText>
          </View>
        </View>
      )}
    </Card>
  );
};

export default SyncStatusCard;
