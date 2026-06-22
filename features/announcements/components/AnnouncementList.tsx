import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { router } from "expo-router";
import { Avatar, Card, Separator, Skeleton, Surface } from "heroui-native";
import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import EmptyState from "@/components/EmptyState";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon } from "@/components/Icon";
import { ScreenList } from "@/components/ScreenList";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { getApiErrorMessage } from "@/lib/api-error";
import type { Event } from "@/powersync/schema";
import { toTitleCase } from "@/utils/toTitleCase";
import type { useAnnouncementsWithEvents } from "../announcements.hooks";

dayjs.extend(relativeTime);

const PREVIEW_LIMIT = 5;

const formatRelativeOrDate = (createdAt: string) => {
  const days = dayjs().diff(createdAt, "day");
  return days >= 7 ? formatDate(createdAt) : dayjs(createdAt).fromNow();
};

type AnnouncementsQuery = ReturnType<typeof useAnnouncementsWithEvents>;

type AnnouncementListProps = Pick<
  AnnouncementsQuery,
  "data" | "error" | "isLoading" | "refresh"
> & {
  preview?: boolean;
};

const AnnouncementList = ({
  data,
  error,
  isLoading,
  refresh,
  preview = false,
}: AnnouncementListProps) => {
  const items = React.useMemo(() => {
    if (!data) return data;
    return preview ? data.slice(0, PREVIEW_LIMIT) : data;
  }, [data, preview]);

  const status = useSectionStatus({
    data: items ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (error)
    return (
      <ErrorComponent message={getApiErrorMessage(error)} onRetry={refresh} />
    );

  if (status.phase === "loading") return <AnnouncementSkeleton />;
  if (status.phase === "offline-empty")
    return <OfflineEmpty section="announcements" />;
  if (status.phase === "empty")
    return (
      <EmptyState
        icon="MegaphoneIcon"
        title="No announcements yet"
        description="Check back later for updates"
      />
    );

  return (
    <ScreenList
      scrollEnabled={false}
      data={items}
      renderItem={({ item }) => {
        const authorName = toTitleCase(
          `${item.createdById.firstName} ${item.createdById.lastName}`,
        );
        const timeLabel = formatRelativeOrDate(item.createdAt);
        return (
          <View className="mb-3 max-w-3xl mx-auto w-full px-2.5">
            <Pressable
              onPress={() => router.push(`/announcement/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Announcement: ${item.title}, by ${authorName}, ${timeLabel}`}
              android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
              className="active:opacity-80 rounded-xl overflow-hidden"
            >
              <Card className="shadow-none rounded-xl border border-border">
                <Card.Header>
                  <View className="flex-row items-center gap-2">
                    <Avatar
                      alt={authorName}
                      size="sm"
                      className="border border-border"
                    >
                      <AttachmentAvatarImage
                        path={item.createdById.studentPhoto}
                      />
                      <AvatarFallbackImage />
                    </Avatar>

                    <View className="flex-1">
                      <AppText
                        weight="semibold"
                        numberOfLines={1}
                        className="text-base"
                      >
                        {authorName}
                      </AppText>
                      <AppText className="text-xs text-muted">
                        {timeLabel}
                      </AppText>
                    </View>

                    <Icon
                      name="CaretRightIcon"
                      size={16}
                      className="text-foreground/60"
                    />
                  </View>
                </Card.Header>
                <Separator className="my-2" />

                <Card.Body className="gap-2.5">
                  <AppText
                    weight="semibold"
                    numberOfLines={2}
                    className="text-lg"
                  >
                    {item.title}
                  </AppText>
                  <AppText
                    numberOfLines={3}
                    className="text-sm leading-relaxed"
                  >
                    {item.description}
                  </AppText>
                  {item.events.length > 0 &&
                    (preview ? (
                      <View className="flex-row items-center gap-1.5 self-start rounded-full bg-secondary px-2.5 py-1">
                        <Icon
                          name="CalendarIcon"
                          size={14}
                          className="text-muted"
                        />
                        <AppText className="text-xs text-muted">
                          {item.events.length}{" "}
                          {item.events.length === 1 ? "event" : "events"}
                        </AppText>
                      </View>
                    ) : (
                      <>
                        <AppText weight="semibold" className="text-base">
                          Associated Events
                        </AppText>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                        >
                          {item.events.map((event) => (
                            <EventCard key={event.id} event={event.event} />
                          ))}
                        </ScrollView>
                      </>
                    ))}
                </Card.Body>
              </Card>
            </Pressable>
          </View>
        );
      }}
    />
  );
};

const EventCard = ({
  event,
}: {
  event: Event & {
    createdById?: { firstName: string; lastName: string };
  };
}) => {
  return (
    <Surface
      variant="secondary"
      className="mr-2 max-w-sm rounded-xl p-3 gap-2.5"
    >
      <AppText weight="semibold" className="text-base">
        {event.title}
      </AppText>

      {event.createdById && (
        <AppText className="text-xs text-muted">
          By{" "}
          {toTitleCase(
            `${event.createdById.firstName} ${event.createdById.lastName}`,
          )}
        </AppText>
      )}
      <View className="gap-1">
        <View className="flex-row items-center gap-1">
          <Icon name="MapPinIcon" size={14} className="text-muted" />
          <AppText className="text-xs text-muted">{event.location}</AppText>
        </View>
        <View className="flex-row items-center gap-1">
          <Icon name="ClockIcon" size={14} className="text-muted" />
          <AppText className="text-xs text-muted">
            {formatDate(event.startDate)}
            {event.time ? ` - ${formatTime(event.time)}` : ""}
          </AppText>
        </View>
      </View>
    </Surface>
  );
};

const AnnouncementSkeleton = () => {
  return (
    <ScreenList
      scrollEnabled={false}
      data={[1, 2, 3]}
      renderItem={() => (
        <View className="mb-3 max-w-3xl mx-auto w-full px-2.5">
          <Card className="shadow-none rounded-xl border border-border">
            <Card.Header>
              <View className="flex-row items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <View className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </View>
                <Skeleton className="h-4 w-4 rounded" />
              </View>
            </Card.Header>
            <Separator className="my-2" />
            <Card.Body className="gap-2.5">
              <Skeleton className="h-5 w-3/4 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
              <Skeleton className="h-6 w-24 rounded-full mt-1" />
            </Card.Body>
          </Card>
        </View>
      )}
    />
  );
};

export default AnnouncementList;
