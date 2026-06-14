import { FlashList } from "@shopify/flash-list";
import { useThemeColor } from "heroui-native";
import { useCallback } from "react";
import { Pressable, Share, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { formatRelative } from "@/utils/getRelativeTime";
import { SYNC_COPY } from "../copy";
import type { SyncEventRow } from "../syncEvents";
import { useSyncEvents } from "../useSyncEvents";

const glyphFor = (status: SyncEventRow["status"]): string =>
  status === "ok" ? "✓" : status === "fail" ? "✗" : "•";

const EventRow = ({ event }: { event: SyncEventRow }) => {
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");
  const mutedColor = useThemeColor("muted");

  const color =
    event.status === "ok"
      ? successColor
      : event.status === "fail"
        ? dangerColor
        : mutedColor;

  return (
    <View className="flex-row items-start px-3 py-1.5 border-b border-border">
      <AppText
        className="text-[10px] text-muted w-16"
        style={{ fontFamily: "monospace" }}
      >
        {formatRelative(new Date(event.ts))}
      </AppText>
      <AppText
        className="text-[11px] w-4 text-center"
        style={{ color, fontFamily: "monospace" }}
      >
        {glyphFor(event.status)}
      </AppText>
      <View className="flex-1 ml-1">
        <AppText
          className="text-[11px] text-foreground"
          style={{ fontFamily: "monospace" }}
          numberOfLines={1}
        >
          {event.kind} {event.target ?? ""}
        </AppText>
        {(event.http_status != null || event.message) && (
          <AppText
            className="text-[10px] text-muted"
            style={{ fontFamily: "monospace" }}
            numberOfLines={1}
          >
            {event.http_status != null ? `HTTP ${event.http_status}` : ""}
            {event.http_status != null && event.message ? " · " : ""}
            {event.message ?? ""}
          </AppText>
        )}
      </View>
      {event.duration_ms != null && (
        <AppText
          className="text-[10px] text-muted ml-2"
          style={{ fontFamily: "monospace" }}
        >
          {event.duration_ms} ms
        </AppText>
      )}
    </View>
  );
};

const EventsSection = () => {
  const { data: events = [] } = useSyncEvents();
  const accentColor = useThemeColor("accent");

  const handleExport = useCallback(async () => {
    try {
      await Share.share({
        title: "Sync log",
        message: JSON.stringify(events, null, 2),
      });
    } catch (err) {
      console.warn("[EventsSection] export failed", err);
    }
  }, [events]);

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <AppText className="text-xs uppercase tracking-wider text-muted">
          {SYNC_COPY.events.heading}
        </AppText>
        <Pressable
          onPress={handleExport}
          accessibilityRole="button"
          accessibilityLabel={SYNC_COPY.events.export}
        >
          <AppText
            weight="semibold"
            className="text-xs text-accent"
            style={{ color: accentColor }}
          >
            {SYNC_COPY.events.export}
          </AppText>
        </Pressable>
      </View>

      {events.length === 0 ? (
        <View className="rounded-xl border border-border bg-surface p-4 items-center">
          <Icon name="ClockIcon" size={24} color={accentColor} />
          <AppText className="text-sm text-foreground mt-2">
            {SYNC_COPY.events.empty}
          </AppText>
        </View>
      ) : (
        <View
          className="rounded-xl border border-border bg-surface overflow-hidden"
          style={{ height: Math.min(events.length * 40, 320) }}
        >
          <FlashList
            data={events}
            keyExtractor={(e) => e.id}
            renderItem={({ item }) => <EventRow event={item} />}
          />
        </View>
      )}
    </View>
  );
};

export default EventsSection;
