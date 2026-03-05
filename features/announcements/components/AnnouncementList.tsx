import { Pressable, ScrollView, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Avatar, Card, Separator, Spinner } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { ClockIcon, MapPinIcon } from "phosphor-react-native";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import { useAnnouncementsWithEvents } from "../announcements.hooks";
import { Event } from "@/powersync/schema";
import React, { useState } from "react";
import EventDetailModal from "@/features/calendar/components/EventDetailModal";

const AnnouncementList = () => {
  const { data, isError, error, isLoading, refetch, isRefetching } =
    useAnnouncementsWithEvents();

  if (isLoading) return <Spinner />;
  if (isError) return <AppText>{error.message}</AppText>;

  return (
    <FlashList
      scrollEnabled={false}
      ListEmptyComponent={<AppText>No Announcements</AppText>}
      data={data}
      onRefresh={refetch}
      refreshing={isRefetching}
      renderItem={({ item }) => (
        <View className="mb-2 max-w-3xl sm:mx-auto w-full px-5">
          <Card className="shadow-none">
            <Card.Header>
              <View className="flex-row items-center gap-2">
                <Avatar alt="" size="sm" className="border border-accent">
                  <Avatar.Image
                    source={{
                      uri: item.createdById.studentPhoto,
                    }}
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
              <AppText>{item.description}</AppText>
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
        <Card key={event.id} className="bg-gray-100 mr-2 max-w-sm">
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
                <Icon name="MapPinIcon" size={16} />
                <AppText>{event.location}</AppText>
              </View>
              <View className="flex-row items-center gap-1">
                <Icon name="ClockIcon" size={16} />
                <AppText className="text-xs text-gray-500">
                  {formatDate(event.startDate)} -{formatTime(event.time)}
                </AppText>
              </View>
            </View>
          </Card.Body>
        </Card>
      </Pressable>
      <EventDetailModal
        isOpen={isOpen}
        setOpenChange={setIsOpen}
        eventId={event.id}
      />
    </>
  );
};

export default AnnouncementList;
