import dayjs from "dayjs";
import { useLocalSearchParams } from "expo-router";
import { Skeleton } from "heroui-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { EntityTypePill } from "@/components/EntityTypePill";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import NoDataFallback from "@/components/NoDataFallback";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useEvent } from "@/features/calendar/calendar.hooks";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import HydrationDebugPill from "@/features/notifications/HydrationDebugPill";
import { makeEntityKey } from "@/features/notifications/pushPayloadCache";
import { useEntityFromPushOrSync } from "@/features/notifications/useEntityFromPushOrSync";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const EventDetailsScreen = () => {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const numericId = Number(eventId);

  const watch = useEvent(numericId);
  const localEvent = watch.data?.[0] ?? null;

  const eventEntityKey = makeEntityKey("event", numericId);
  const {
    data: event,
    source, // [push-hydrate verify]
    isResolving,
    isMissing,
    error,
    retry,
  } = useEntityFromPushOrSync({
    entityKey: eventEntityKey,
    localData: localEvent,
    localIsLoading: watch.isLoading,
    // apiFetch intentionally omitted: no REST endpoint exists for a
    // single event today. Payload + watch are sufficient.
  });

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <NoDataFallback
        icon="CalendarIcon"
        title="Event not found"
        description="The event you're looking for doesn't exist"
      />
    );
  }

  if (!event && isResolving) return <EventDetailsSkeleton />;

  // Show the error fallback only when we have no data to render. If
  // payload or REST is already populating `event`, swallow a
  // transient watch error rather than disrupting the user.
  if (!event && (watch.error ?? error)) {
    return (
      <ErrorFallback
        message={getApiErrorMessage(watch.error ?? error)}
        onRefetch={() => {
          watch.refetch?.();
          retry();
        }}
      />
    );
  }

  if (!event && isMissing) {
    return (
      <NoDataFallback
        icon="CalendarIcon"
        title="Event not found"
        description="This event may have been removed"
      />
    );
  }

  // Unreachable per the hook's isResolving / isMissing invariant when
  // apiFetch is absent; kept as a type-narrowing guard for `event`.
  if (!event) return null;

  const start = dayjs(event.startDate);
  const endsDifferentDay =
    event.endDate && !dayjs(event.endDate).isSame(start, "day");

  return (
    <ScreenScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-3xl mx-auto px-5 pt-2">
        {/* [push-hydrate verify] */}
        <HydrationDebugPill
          entityKey={eventEntityKey}
          source={source}
          isResolving={isResolving}
          isMissing={isMissing}
        />

        <View className="mt-2 mb-3">
          <EntityTypePill type="event" />
        </View>

        {/* Date hero card */}
        <View className="flex-row items-center gap-3 bg-surface border border-accent/30 rounded-2xl px-4 py-3 mb-4">
          <View className="w-16 py-2 rounded-xl bg-accent items-center justify-center">
            <AppText
              weight="bold"
              className="text-[10px] tracking-widest uppercase text-accent-foreground opacity-90"
            >
              {start.format("MMM")}
            </AppText>
            <AppText
              weight="bold"
              className="text-[26px] leading-7 text-accent-foreground"
            >
              {start.format("D")}
            </AppText>
          </View>
          <View className="flex-1">
            <AppText weight="semibold" className="text-foreground">
              {start.format("dddd")}
            </AppText>
            {event.time ? (
              <AppText className="text-xs text-muted">
                {formatTime(event.time)}
              </AppText>
            ) : null}
            {endsDifferentDay ? (
              <AppText className="text-xs text-muted mt-0.5">
                to {formatDate(event.endDate)}
              </AppText>
            ) : null}
          </View>
        </View>

        {/* Title + description */}
        <AppText
          weight="bold"
          className="text-2xl text-foreground mb-4"
        >
          {event.title}
        </AppText>
        {event.description ? (
          <AppText className="text-muted leading-relaxed mb-4">
            {event.description}
          </AppText>
        ) : null}

        {/* Location card — only when present */}
        {event.location ? (
          <View className="flex-row items-start gap-3 bg-surface border border-border rounded-xl px-4 py-3 mb-4">
            <View className="mt-0.5">
              <Icon name="MapPinIcon" size={18} className="text-accent" />
            </View>
            <View className="flex-1">
              <AppText
                weight="semibold"
                className="text-[11px] tracking-wider uppercase text-muted mb-0.5"
              >
                Location
              </AppText>
              <AppText className="text-foreground">{event.location}</AppText>
            </View>
          </View>
        ) : null}

        {/* Footer metadata */}
        <View className="mt-4 pt-3 border-t border-border gap-1">
          {event.createdById ? (
            <AppText className="text-xs text-muted">
              Created by{" "}
              {toTitleCase(
                `${event.createdById.firstName} ${event.createdById.lastName}`,
              )}
            </AppText>
          ) : null}
          <AppText className="text-xs text-muted">
            Posted{" "}
            {new Date(event.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </AppText>
        </View>
      </View>
    </ScreenScrollView>
  );
};

const EventDetailsSkeleton = () => (
  <View className="w-full max-w-3xl mx-auto px-5 pt-2">
    {/* pill */}
    <Skeleton className="h-5 w-20 rounded-full mt-2 mb-3" />
    {/* date hero */}
    <View className="flex-row items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 mb-4">
      <Skeleton className="w-16 h-14 rounded-xl" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </View>
    </View>
    {/* title + description */}
    <View className="mb-4 gap-2">
      <Skeleton className="h-7 w-3/4 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
    </View>
    {/* location card */}
    <View className="flex-row items-start gap-3 bg-surface border border-border rounded-xl px-4 py-3 mb-4">
      <Skeleton className="w-5 h-5 rounded mt-0.5" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
      </View>
    </View>
    {/* footer */}
    <View className="mt-4 pt-3 border-t border-border gap-1">
      <Skeleton className="h-3 w-40 rounded" />
      <Skeleton className="h-3 w-52 rounded" />
    </View>
  </View>
);

export default EventDetailsScreen;
