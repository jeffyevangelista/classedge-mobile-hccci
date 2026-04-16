import { Pressable, ScrollView, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Avatar, Card, Separator, Skeleton, Surface } from "heroui-native";
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

const AnnouncementList = () => {
  const { data, isError, error, isLoading, refetch, isRefetching } =
    useAnnouncementsWithEvents();

  if (isLoading) return <AnnouncementSkeleton />;
  if (isError)
    return (
      <ErrorComponent message={getApiErrorMessage(error)} onRetry={refetch} />
    );

  return (
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
      onRefresh={refetch}
      refreshing={isRefetching}
      renderItem={({ item }) => (
        <View className="mb-2 max-w-3xl sm:mx-auto w-full px-2.5">
          <Card className="shadow-none rounded-xl">
            <Card.Header>
              <View className="flex-row items-center gap-2">
                <Avatar alt="" size="sm" className="border border-accent">
                  <Avatar.Image
                    source={
                      item.createdById.studentPhoto
                        ? { uri: item.createdById.studentPhoto }
                        : require("@/assets/placeholder/avatar-placeholder.png")
                    }
                  />
                  <Avatar.Fallback>
                    {item.createdById.firstName.charAt(0)}
                  </Avatar.Fallback>
                </Avatar>

                <View>
                  <AppText weight="semibold" className="text-md">
                    {item.createdById.firstName +
                      " " +
                      item.createdById.lastName}
                  </AppText>
                  <AppText className="text-xs text-gray-500">
                    {formatDate(item.createdAt)}
                  </AppText>
                </View>
              </View>
            </Card.Header>
            <Separator className="my-2 bg-gray-300" />

            <Card.Body className="gap-2.5">
              <AppText weight="semibold" className="text-lg">
                {item.title}
              </AppText>
              <AppText className="text-xs text-justify leading-relaxed">
                {item.description}
              </AppText>
              {item.events.length > 0 && (
                <AppText weight="semibold" className="text-md">
                  Associated Events
                </AppText>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {item.events.map((event) => (
                  <EventCard key={event.id} event={event.event} />
                ))}
              </ScrollView>
            </Card.Body>
          </Card>
        </View>
      )}
    />
  );
};

const EventCard = ({ event }: { event: Event }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setIsOpen(true)}>
        <Surface
          variant="secondary"
          key={event.id}
          className="mr-2 max-w-sm rounded-xl"
        >
          <Card.Body className="gap-2.5">
            <AppText weight="semibold" className="text-md">
              {event.title}
            </AppText>
            <AppText
              className="text-xs text-gray-500 overflow-hidden"
              numberOfLines={2}
            >
              {event.description}
            </AppText>
            <View>
              <View className="flex-row items-center gap-1">
                <Icon
                  name="MapPinIcon"
                  size={16}
                  className="text-blue-600 dark:text-blue-400"
                />
                <AppText>{event.location}</AppText>
              </View>
              <View className="flex-row items-center gap-1">
                <Icon
                  name="ClockIcon"
                  size={16}
                  className="text-blue-600 dark:text-blue-400"
                />
                <AppText className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(event.startDate)} -{formatTime(event.time)}
                </AppText>
              </View>
            </View>
          </Card.Body>
        </Surface>
      </Pressable>
      <EventDetailModal
        isOpen={isOpen}
        setOpenChange={setIsOpen}
        eventId={event.id}
      />
    </>
  );
};

const AnnouncementSkeleton = () => {
  return (
    <FlashList
      scrollEnabled={false}
      data={[1, 2, 3]}
      renderItem={() => (
        <View className="mb-2 max-w-3xl sm:mx-auto w-full px-2.5">
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
            <Separator className="my-2 bg-gray-300" />
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
