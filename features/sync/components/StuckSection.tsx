import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, useThemeColor, useToast } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useStuckCrudOps, type StuckCrudOp } from "../useStuckCrudOps";
import { resetCrudMeta } from "../crudMeta";
import { humanizeSyncError } from "../humanizeSyncError";
import { SYNC_COPY } from "../copy";
import { formatRelative } from "@/utils/getRelativeTime";

const StuckRow = ({ row }: { row: StuckCrudOp }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const humanized = humanizeSyncError({
    status: row.last_http_status,
    message: row.last_error ?? "",
  });

  const handleRetry = useCallback(async () => {
    // `resetCrudMeta` swallows DB errors internally — the call is fire-and-forget
    // from the UI's perspective. PowerSync will re-attempt the op on its next cycle.
    await resetCrudMeta(row.op_id);
    toast.show({
      variant: "success",
      label: "Retry queued",
      description: "We'll try this again on the next sync cycle.",
    });
  }, [row.op_id, toast]);

  return (
    <View className="rounded-xl border border-danger bg-danger-soft p-3 mb-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <AppText weight="semibold" className="text-sm text-danger">
            ⚠ {humanized.message}
          </AppText>
          {humanized.hint && (
            <AppText className="text-xs text-danger mt-0.5 opacity-80">
              {humanized.hint}
            </AppText>
          )}
          <AppText className="text-xs text-muted mt-1">
            {SYNC_COPY.stuck.attempts(row.attempt_count)}
            {row.first_failed_at &&
              ` · ${SYNC_COPY.stuck.firstFailed(formatRelative(new Date(row.first_failed_at)))}`}
          </AppText>
        </View>
        <Button variant="danger" size="sm" onPress={handleRetry}>
          <Button.Label>{SYNC_COPY.stuck.retry}</Button.Label>
        </Button>
      </View>

      <Pressable
        onPress={() => setShowDetails((v) => !v)}
        className="mt-2"
        accessibilityRole="button"
        accessibilityLabel={
          showDetails ? SYNC_COPY.stuck.hideDetails : SYNC_COPY.stuck.showDetails
        }
      >
        <AppText className="text-xs text-danger underline">
          {showDetails ? SYNC_COPY.stuck.hideDetails : SYNC_COPY.stuck.showDetails}
        </AppText>
      </Pressable>

      {showDetails && (
        <View className="mt-2 bg-surface rounded-md p-2">
          <AppText
            className="text-[10px] text-foreground"
            style={{ fontFamily: "monospace" }}
          >
            op_id: {row.op_id}
            {"\n"}HTTP: {row.last_http_status ?? "—"}
            {"\n"}error: {row.last_error ?? "(no message)"}
            {"\n"}payload: {row.data}
          </AppText>
        </View>
      )}
    </View>
  );
};

const StuckSection = () => {
  const { data: rows = [] } = useStuckCrudOps();
  const accentColor = useThemeColor("accent");

  if (rows.length === 0) {
    return (
      <View className="px-4 py-4">
        <AppText className="text-xs uppercase tracking-wider text-muted mb-2">
          {SYNC_COPY.stuck.heading}
        </AppText>
        <View className="rounded-xl border border-border bg-surface p-4 items-center">
          <Icon name="CheckCircleIcon" size={24} color={accentColor} />
          <AppText weight="semibold" className="text-sm text-foreground mt-2">
            {SYNC_COPY.stuck.empty}
          </AppText>
          <AppText className="text-xs text-muted mt-1 text-center">
            {SYNC_COPY.stuck.emptySubtitle}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.stuck.heading} · {rows.length}
        </AppText>
        <AppText className="text-xs text-danger">
          {SYNC_COPY.stuck.needsAttention}
        </AppText>
      </View>
      {rows.map((row) => (
        <StuckRow key={row.op_id} row={row} />
      ))}
    </View>
  );
};

export default StuckSection;
