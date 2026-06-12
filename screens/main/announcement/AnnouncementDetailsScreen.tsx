import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar, Separator, Skeleton, Surface } from "heroui-native";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import NoDataFallback from "@/components/NoDataFallback";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useAnnouncement } from "@/features/announcements/announcements.hooks";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import HydrationDebugPill from "@/features/notifications/HydrationDebugPill";
import { makeEntityKey } from "@/features/notifications/pushPayloadCache";
import { useEntityFromPushOrSync } from "@/features/notifications/useEntityFromPushOrSync";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const AnnouncementDetailsScreen = () => {
  const { announcementId } = useLocalSearchParams<{ announcementId: string }>();
  const numericId = Number(announcementId);
  const router = useRouter();

  const watch = useAnnouncement(numericId);
  const localAnnouncement = watch.data?.[0] ?? null;

  const announcementEntityKey = makeEntityKey("announcement", numericId);
  const {
    data: announcement,
    source, // [push-hydrate verify]
    isResolving,
    isMissing,
    error,
    retry,
  } = useEntityFromPushOrSync({
    entityKey: announcementEntityKey,
    localData: localAnnouncement,
    localIsLoading: watch.isLoading,
    // apiFetch intentionally omitted: no REST endpoint exists for a
    // single announcement today. Payload + watch are sufficient.
  });

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <NoDataFallback
        icon="MegaphoneIcon"
        title="Announcement not found"
        description="The announcement you're looking for doesn't exist"
      />
    );
  }

  if (!announcement && isResolving) return <AnnouncementDetailsSkeleton />;

  // Show the error fallback only when we have no data to render. If
  // payload or REST is already populating `announcement`, swallow a
  // transient watch error rather than disrupting the user.
  if (!announcement && (watch.error ?? error)) {
    return (
      <ErrorFallback
        message={getApiErrorMessage(watch.error ?? error)}
        onRefetch={() => {
          watch.refresh?.();
          retry();
        }}
      />
    );
  }

  if (!announcement && isMissing) {
    return (
      <NoDataFallback
        icon="MegaphoneIcon"
        title="Announcement not found"
        description="This announcement may have been removed"
      />
    );
  }

  if (!announcement) return null;

  const authorName = toTitleCase(
    `${announcement.createdById.firstName} ${announcement.createdById.lastName}`,
  );

  return (
    <ScreenScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-3xl mx-auto px-5 pt-2 gap-4">
        {/* [push-hydrate verify] */}
        <HydrationDebugPill
          entityKey={announcementEntityKey}
          source={source}
          isResolving={isResolving}
          isMissing={isMissing}
        />
        <View className="flex-row items-center gap-2">
          <Avatar alt={authorName} size="sm" className="border border-border">
            <AttachmentAvatarImage
              path={announcement.createdById.studentPhoto}
            />
            <AvatarFallbackImage />
          </Avatar>
          <View>
            <AppText weight="semibold" className="text-base">
              {authorName}
            </AppText>
            <AppText className="text-xs text-muted">
              {formatDate(announcement.createdAt)}
            </AppText>
          </View>
        </View>

        <Separator />

        <AppText weight="bold" className="text-2xl text-foreground">
          {announcement.title}
        </AppText>

        <AppText className="text-sm leading-relaxed text-foreground">
          {announcement.description}
        </AppText>

        {(() => {
          // Defensive filter: in-flight push payloads from older server
          // builds shipped `events: [number]` (flat IDs) instead of
          // `[{ event: {...} }]`, which crashed the map below. Filter out
          // any entries missing the nested event before rendering — they
          // hydrate correctly once PowerSync catches up.
          const validEvents = announcement.events.filter(
            (eventLink) => eventLink?.event?.id != null,
          );
          if (validEvents.length === 0) return null;
          return (
            <>
              <AppText weight="semibold" className="text-base mt-2">
                Associated Events
              </AppText>
              <View className="gap-2">
                {validEvents.map((eventLink) => (
                  <EventCard
                    key={eventLink.event.id}
                    event={eventLink.event}
                    onPress={() => router.push(`/event/${eventLink.event.id}`)}
                  />
                ))}
              </View>
            </>
          );
        })()}
      </View>
    </ScreenScrollView>
  );
};

type EventCardProps = {
  event: {
    id: number;
    title: string;
    location: string | null;
    startDate: string;
    time: string | null;
    createdById?: { firstName: string; lastName: string } | null;
  };
  onPress: () => void;
};

const EventCard = ({ event, onPress }: EventCardProps) => (
  <Pressable onPress={onPress} className="active:opacity-80">
    <Surface variant="secondary" className="rounded-xl p-3 gap-2.5">
      <AppText weight="semibold" className="text-base">
        {event.title}
      </AppText>
      {event.createdById ? (
        <AppText className="text-xs text-muted">
          By{" "}
          {toTitleCase(
            `${event.createdById.firstName} ${event.createdById.lastName}`,
          )}
        </AppText>
      ) : null}
      <View className="gap-1">
        {event.location ? (
          <View className="flex-row items-center gap-1">
            <Icon name="MapPinIcon" size={14} className="text-muted" />
            <AppText className="text-xs text-muted">{event.location}</AppText>
          </View>
        ) : null}
        <View className="flex-row items-center gap-1">
          <Icon name="ClockIcon" size={14} className="text-muted" />
          <AppText className="text-xs text-muted">
            {formatDate(event.startDate)}
            {event.time ? ` - ${formatTime(event.time)}` : ""}
          </AppText>
        </View>
      </View>
    </Surface>
  </Pressable>
);

const AnnouncementDetailsSkeleton = () => (
  <View className="w-full max-w-3xl mx-auto px-5 pt-2 gap-4">
    <View className="flex-row items-center gap-2">
      <Skeleton className="w-8 h-8 rounded-full" />
      <View className="flex-1 gap-1">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </View>
    </View>
    <Skeleton className="h-7 w-3/4 rounded" />
    <Skeleton className="h-4 w-full rounded" />
    <Skeleton className="h-4 w-full rounded" />
    <Skeleton className="h-4 w-2/3 rounded" />
    <Skeleton className="h-20 w-full rounded mt-2" />
  </View>
);

export default AnnouncementDetailsScreen;
