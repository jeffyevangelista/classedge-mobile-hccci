import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useEvent } from "../calendar.hooks";
import { AppText } from "@/components/AppText";
import { BottomSheet, Skeleton, useThemeColor } from "heroui-native";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Icon } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { getApiErrorMessage } from "@/lib/api-error";

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
  const insets = useSafeAreaInsets();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpenChange(open);
    },
    [setOpenChange],
  );

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const contentStyle = useMemo(
    () => ({
      marginHorizontal:
        screenWidth > BOTTOM_SHEET_MAX_WIDTH
          ? (screenWidth - BOTTOM_SHEET_MAX_WIDTH) / 2
          : 0,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    }),
    [screenWidth],
  );

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["45%", "90%"]}
          enableDynamicSizing={false}
          topInset={Math.max(insets.top, 16)}
          style={contentStyle}
          className="bg-overlay"
        >
          <BottomSheetContent eventId={eventId} />
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

const BottomSheetContent = ({ eventId }: { eventId: number }) => {
  const { isLoading, isError, error, data } = useEvent(eventId);
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");

  const event = data?.[0];

  if (isLoading) {
    return <EventDetailSkeleton />;
  }

  if (isError) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Icon name="CalendarIcon" size={48} color={dangerColor} />
        <AppText
          weight="semibold"
          className="text-center text-danger mt-4 mb-2"
        >
          Error loading event
        </AppText>
        <AppText className="text-center text-muted">
          {getApiErrorMessage(error)}
        </AppText>
      </View>
    );
  }

  if (!event) {
    return (
      <EmptyState
        icon="CalendarIcon"
        title="Event not found"
        description="This event may have been removed"
      />
    );
  }

  const startDate = formatDate(event.startDate);
  const endDate = formatDate(event.endDate);
  const dateText =
    startDate === endDate ? startDate : `${startDate} – ${endDate}`;

  return (
    <BottomSheetScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 24,
      }}
    >
      <View className="mb-6">
        <AppText weight="bold" className="text-2xl text-foreground mb-2">
          {event.title}
        </AppText>
        {event.description ? (
          <AppText className="text-muted leading-relaxed">
            {event.description}
          </AppText>
        ) : null}
      </View>

      <View className="gap-4">
        <DetailRow
          iconName="CalendarIcon"
          iconColor={accentColor}
          label="Date"
          value={dateText}
          extra={event.time ? formatTime(event.time) : undefined}
        />

        {event.location ? (
          <DetailRow
            iconName="MapPinIcon"
            iconColor={accentColor}
            label="Location"
            value={event.location}
          />
        ) : null}

        {event.createdById ? (
          <DetailRow
            iconName="UserIcon"
            iconColor={accentColor}
            label="Created by"
            value={`${event.createdById.firstName} ${event.createdById.lastName}`}
          />
        ) : null}

        <DetailRow
          iconName="ClockIcon"
          iconColor={accentColor}
          label="Posted"
          value={new Date(event.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
      </View>
    </BottomSheetScrollView>
  );
};

const DetailRow = ({
  iconName,
  iconColor,
  label,
  value,
  extra,
}: {
  iconName: "CalendarIcon" | "MapPinIcon" | "UserIcon" | "ClockIcon";
  iconColor: string;
  label: string;
  value: string;
  extra?: string;
}) => (
  <View className="flex-row items-start gap-3">
    <View className="mt-1">
      <Icon name={iconName} size={20} color={iconColor} />
    </View>
    <View className="flex-1">
      <AppText weight="semibold" className="text-foreground mb-1">
        {label}
      </AppText>
      <AppText className="text-muted">{value}</AppText>
      {extra ? <AppText className="text-muted">{extra}</AppText> : null}
    </View>
  </View>
);

const EventDetailSkeleton = () => {
  return (
    <View className="px-5 pt-5">
      <View className="mb-6 gap-2">
        <Skeleton className="h-7 w-3/4 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </View>
      <View className="gap-4">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <View key={i} className="flex-row items-start">
              <Skeleton className="w-5 h-5 rounded mr-3 mt-1" />
              <View className="flex-1 gap-1.5">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-36 rounded" />
              </View>
            </View>
          ))}
      </View>
    </View>
  );
};

export default EventDetailModal;
