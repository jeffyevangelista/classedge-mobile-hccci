import { Pressable, ScrollView, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Avatar, Card, Separator, Skeleton, Surface } from "heroui-native";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import { useAnnouncementsWithEvents } from "../announcements.hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import { Event } from "@/powersync/schema";
import React, { useState } from "react";
import EventDetailModal from "@/features/calendar/components/EventDetailModal";
import { toTitleCase } from "@/utils/toTitleCase";

const AnnouncementList = () => {
  const { data, error, isLoading, refresh } = useAnnouncementsWithEvents();
  const [activeEventId, setActiveEventId] = useState<number | null>(null);

  if (isLoading) return <AnnouncementSkeleton />;
  if (error)
    return (
      <ErrorComponent message={getApiErrorMessage(error)} onRetry={refresh} />
    );

  return (
    <>
      <FlashList
        scrollEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="MegaphoneIcon"
            title="No announcements yet"
            description="Check back later for updates"
          />
        }
        data={data}
        renderItem={({ item }) => {
          const authorName = toTitleCase(
            `${item.createdById.firstName} ${item.createdById.lastName}`,
          );
          return (
            <View className="mb-3 max-w-3xl mx-auto w-full px-2.5">
              <Card className="shadow-none rounded-xl">
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

                    <View>
                      <AppText weight="semibold" className="text-base">
                        {authorName}
                      </AppText>
                      <AppText className="text-xs text-muted">
                        {formatDate(item.createdAt)}
                      </AppText>
                    </View>
                  </View>
                </Card.Header>
                <Separator className="my-2" />

                <Card.Body className="gap-2.5">
                  <AppText weight="semibold" className="text-lg">
                    {item.title}
                  </AppText>
                  <AppText className="text-xs leading-relaxed">
                    {item.description}
                  </AppText>
                  {item.events.length > 0 && (
                    <>
                      <AppText weight="semibold" className="text-base">
                        Associated Events
                      </AppText>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        {item.events.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event.event}
                            onPress={() => setActiveEventId(event.event.id)}
                          />
                        ))}
                      </ScrollView>
                    </>
                  )}
                </Card.Body>
              </Card>
            </View>
          );
        }}
      />
      <EventDetailModal
        isOpen={activeEventId !== null}
        setOpenChange={(open) => {
          if (!open) setActiveEventId(null);
        }}
        eventId={activeEventId ?? 0}
      />
    </>
  );
};

const EventCard = ({
  event,
  onPress,
}: {
  event: Event & {
    createdById?: { firstName: string; lastName: string };
  };
  onPress: () => void;
}) => {
  return (
    <Pressable onPress={onPress} className="mr-2 active:opacity-80">
      <Surface variant="secondary" className="max-w-sm rounded-xl p-3 gap-2.5">
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
              {formatDate(event.startDate)} - {formatTime(event.time)}
            </AppText>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
};

const AnnouncementSkeleton = () => {
  return (
    <FlashList
      scrollEnabled={false}
      data={[1, 2, 3]}
      renderItem={() => (
        <View className="mb-3 max-w-3xl mx-auto w-full px-2.5">
          <Card className="shadow-none rounded-xl">
            <Card.Header>
              <View className="flex-row items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <View className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </View>
              </View>
            </Card.Header>
            <Separator className="my-2" />
            <Card.Body className="gap-2.5">
              <Skeleton className="h-5 w-3/4 rounded" />
              <Skeleton className="h-4 w-full mb-1 rounded" />
              <Skeleton className="h-4 w-full mb-1 rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
              <View className="flex-row gap-2 mt-2">
                <Skeleton className="h-16 flex-1 rounded" />
                <Skeleton className="h-16 flex-1 rounded" />
              </View>
            </Card.Body>
          </Card>
        </View>
      )}
    />
  );
};

export default AnnouncementList;
