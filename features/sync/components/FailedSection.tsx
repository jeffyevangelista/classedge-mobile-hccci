import { Button, useThemeColor, useToast } from "heroui-native";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { formatRelative } from "@/utils/getRelativeTime";
import { SYNC_COPY } from "../copy";
import { dismissFailedOp } from "../crudMeta";
import { humanizeSyncError } from "../humanizeSyncError";
import { featureLabelFromTarget } from "../syncLabels";
import { type FailedCrudOp, useFailedCrudOps } from "../useFailedCrudOps";

const FailedRow = ({ row }: { row: FailedCrudOp }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const humanized = humanizeSyncError({
    status: row.last_http_status,
    message: row.last_error ?? "",
  });
  const label = featureLabelFromTarget(row.target);
  const droppedRelative = formatRelative(new Date(row.dropped_at));

  const handleDismiss = useCallback(async () => {
    await dismissFailedOp(row.op_id);
    toast.show({
      variant: "default",
      label: "Dismissed",
      description: `${label} removed from the Failed list.`,
    });
  }, [row.op_id, label, toast]);

  return (
    <View className="rounded-xl border border-danger bg-danger-soft p-3 mb-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <AppText weight="semibold" className="text-sm text-danger">
            {label} · {humanized.message}
          </AppText>
          {humanized.hint && (
            <AppText className="text-xs text-danger mt-0.5 opacity-80">
              {humanized.hint}
            </AppText>
          )}
          <AppText className="text-xs text-muted mt-1">
            {SYNC_COPY.failed.httpLabel(row.last_http_status)} ·{" "}
            {SYNC_COPY.failed.droppedAt(droppedRelative)}
          </AppText>
        </View>
        <Button variant="ghost" size="sm" onPress={handleDismiss}>
          <Button.Label>{SYNC_COPY.failed.dismiss}</Button.Label>
        </Button>
      </View>

      <Pressable
        onPress={() => setShowDetails((v) => !v)}
        className="mt-2"
        accessibilityRole="button"
        accessibilityLabel={
          showDetails
            ? SYNC_COPY.failed.hideDetails
            : SYNC_COPY.failed.showDetails
        }
      >
        <AppText className="text-xs text-danger underline">
          {showDetails
            ? SYNC_COPY.failed.hideDetails
            : SYNC_COPY.failed.showDetails}
        </AppText>
      </Pressable>

      {showDetails && (
        <View className="mt-2 bg-surface rounded-md p-2">
          <AppText
            className="text-[10px] text-foreground"
            style={{ fontFamily: "monospace" }}
          >
            op_id: {row.op_id}
            {"\n"}target: {row.target ?? "(none)"}
            {"\n"}HTTP: {row.last_http_status ?? "—"}
            {"\n"}attempts: {row.attempt_count}
            {"\n"}error: {row.last_error ?? "(no message)"}
          </AppText>
        </View>
      )}
    </View>
  );
};

const FailedSection = () => {
  const { data: rows = [] } = useFailedCrudOps();
  const accentColor = useThemeColor("accent");

  if (rows.length === 0) {
    return (
      <View className="px-4 py-4">
        <AppText className="text-xs uppercase tracking-wider text-muted mb-2">
          {SYNC_COPY.failed.heading}
        </AppText>
        <View className="rounded-xl border border-border bg-surface p-4 items-center">
          <Icon name="CheckCircleIcon" size={24} color={accentColor} />
          <AppText weight="semibold" className="text-sm text-foreground mt-2">
            {SYNC_COPY.failed.empty}
          </AppText>
          <AppText className="text-xs text-muted mt-1 text-center">
            {SYNC_COPY.failed.emptySubtitle}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.failed.heading} · {rows.length}
        </AppText>
        <AppText className="text-xs text-danger">
          {SYNC_COPY.failed.needsAttention}
        </AppText>
      </View>
      {rows.map((row) => (
        <FailedRow key={row.op_id} row={row} />
      ))}
    </View>
  );
};

export default FailedSection;
