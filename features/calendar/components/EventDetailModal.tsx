import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useEvent } from "../calendar.hooks";
import { AppText } from "@/components/AppText";
import { BottomSheet, Skeleton } from "heroui-native";
import { useWindowDimensions, View } from "react-native";
import { Icon } from "@/components/Icon";

import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
const BOTTOM_SHEET_MAX_WIDTH = 768;

type EventDetailModalProps = {
  isOpen: boolean;
  setOpenChange: (open: boolean) => void;
  eventId: number;
};
const EventDetailModal = ({
  isOpen,
  setOpenChange,
  eventId,
}: EventDetailModalProps) => {
  const isOpenRef = useRef(isOpen);
  const { width: screenWidth } = useWindowDimensions();

  const handleOpenChange = useCallback((open: boolean) => {
    setOpenChange(open);
  }, []);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 0,
      minHeight: 500, // Giving it a set height helps stability
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    }),
    [screenWidth],
  );

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["50%", "90%"]} style={contentStyle}>
          <BottomSheet.Close />
          <BottomSheetContent eventId={eventId} />
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

const BottomSheetContent = ({ eventId }: { eventId: number }) => {
  const { isLoading, isError, error, data } = useEvent(eventId);

  const event = data?.[0];

  if (isLoading) {
    return <EventDetailSkeleton />;
  }

  if (isError) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Icon name="CalendarIcon" size={48} className="text-destructive mb-4" />
        <AppText className="text-center text-destructive font-semibold mb-2">
          Error Loading Event
        </AppText>
        <AppText className="text-center text-muted-foreground">
          {error.message}
        </AppText>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Icon
          name="CalendarIcon"
          size={48}
          className="text-muted-foreground mb-4"
        />
        <AppText className="text-center text-muted-foreground">
          Event not found
        </AppText>
      </View>
    );
  }

  return (
    <View className="pt-5">
      {/* Header */}
      <View className="mb-6">
        <AppText className="text-2xl font-bold text-foreground mb-2">
          {event.title}
        </AppText>
        {event.description && (
          <AppText className=" text-muted-foreground leading-relaxed">
            {event.description}
          </AppText>
        )}
      </View>

      {/* Event Details */}
      <View className="gap-4">
        {/* Date & Time */}
        <View className="flex-row items-start">
          <View className="mr-3 mt-1">
            <Icon name="CalendarIcon" size={20} className="text-primary" />
          </View>
          <View className="flex-1">
            <AppText weight="semibold" className="text-foreground mb-1">
              Date & Time
            </AppText>
            <AppText className="text-muted-foreground">
              {formatDate(event.startDate)}
            </AppText>
            {event.time && (
              <AppText className="text-muted-foreground">
                {formatTime(event.time)}
              </AppText>
            )}
          </View>
        </View>

        {/* Location */}
        {event.location && (
          <View className="flex-row items-start">
            <View className="mr-3 mt-1">
              <Icon name="MapPinIcon" size={20} className="text-primary" />
            </View>
            <View className="flex-1">
              <AppText weight="semibold" className="text-foreground mb-1">
                Location
              </AppText>
              <AppText className="text-muted-foreground">
                {event.location}
              </AppText>
            </View>
          </View>
        )}

        {/* Created By */}
        {event.createdById && (
          <View className="flex-row items-start">
            <View className="mr-3 mt-1">
              <Icon name="UserIcon" size={20} className="text-primary" />
            </View>
            <View className="flex-1">
              <AppText weight="semibold" className="text-foreground mb-1">
                Created By
              </AppText>
              <AppText className="text-muted-foreground">
                {event.createdById.firstName} {event.createdById.lastName}
              </AppText>
            </View>
          </View>
        )}

        {/* Created At */}
        <View className="flex-row items-start">
          <View className="mr-3 mt-1">
            <Icon name="ClockIcon" size={20} className="text-primary" />
          </View>
          <View className="flex-1">
            <AppText weight="semibold" className="text-foreground mb-1">
              Created
            </AppText>
            <AppText className="text-muted-foreground">
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
      </View>
    </View>
  );
};

const EventDetailSkeleton = () => {
  return (
    <View className="pt-5">
      <View className="mb-6 gap-2">
        <Skeleton className="h-7 w-3/4 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </View>
      <View className="gap-4">
        <View className="flex-row items-start">
          <Skeleton className="w-5 h-5 rounded mr-3 mt-1" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
          </View>
        </View>
        <View className="flex-row items-start">
          <Skeleton className="w-5 h-5 rounded mr-3 mt-1" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </View>
        </View>
        <View className="flex-row items-start">
          <Skeleton className="w-5 h-5 rounded mr-3 mt-1" />
          <View className="flex-1 gap-1.5">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-36 rounded" />
          </View>
        </View>
      </View>
    </View>
  );
};

export default EventDetailModal;
