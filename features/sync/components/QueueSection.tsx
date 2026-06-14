import { useThemeColor } from "heroui-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useAttachmentStatus } from "@/features/attachments/hooks/useAttachmentStatus";
import { SYNC_COPY } from "../copy";
import { useSyncData } from "../useSyncData";

const QueueSection = () => {
  const { pendingChanges } = useSyncData();
  const attachments = useAttachmentStatus();
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");

  const hasUploads = pendingChanges.length > 0;
  const hasDownloads = attachments.inFlight > 0;
  const empty = !hasUploads && !hasDownloads;

  if (empty) {
    return (
      <View className="px-4 py-4">
        <AppText className="text-xs uppercase tracking-wider text-muted mb-2">
          {SYNC_COPY.queue.heading}
        </AppText>
        <View className="rounded-xl border border-border bg-surface p-4 items-center">
          <Icon name="CheckCircleIcon" size={24} color={accentColor} />
          <AppText weight="semibold" className="text-sm text-foreground mt-2">
            {SYNC_COPY.queue.empty}
          </AppText>
          <AppText className="text-xs text-muted mt-1 text-center">
            {SYNC_COPY.queue.emptySubtitle}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.queue.heading}
        </AppText>
        <AppText className="text-xs text-muted">
          {pendingChanges.length + attachments.inFlight}
        </AppText>
      </View>

      <View className="rounded-xl border border-border bg-surface overflow-hidden">
        {pendingChanges.map((change) =>
          change == null ? null : (
            <View
              key={change.rowId}
              className="flex-row items-center justify-between px-3 py-2.5 border-b border-border"
            >
              <View className="flex-1">
                <AppText weight="semibold" className="text-sm text-foreground">
                  {SYNC_COPY.queue.uploadRow(change.table, change.operation)}
                </AppText>
                <AppText className="text-xs text-muted mt-0.5">
                  {change.recordId}
                </AppText>
              </View>
              <AppText
                className="text-xs text-muted"
                style={{ color: mutedColor }}
              >
                queued
              </AppText>
            </View>
          ),
        )}

        {attachments.inFlight > 0 && (
          <View className="flex-row items-center justify-between px-3 py-2.5">
            <View className="flex-1">
              <AppText weight="semibold" className="text-sm text-foreground">
                {SYNC_COPY.queue.downloadRow(`${attachments.inFlight} files`)}
              </AppText>
              <AppText className="text-xs text-muted mt-0.5">
                {attachments.synced} of {attachments.total} downloaded
              </AppText>
            </View>
            <View className="rounded-full bg-accent-soft px-2 py-0.5">
              <AppText weight="semibold" className="text-[10px] text-accent">
                {Math.round(attachments.progress * 100)}%
              </AppText>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default QueueSection;
