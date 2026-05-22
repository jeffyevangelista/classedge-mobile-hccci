import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import ErrorFallback from "@/components/ErrorFallback";
import NoDataFallback from "@/components/NoDataFallback";
import { useEvent } from "@/features/calendar/calendar.hooks";
import {
  formatDate,
  formatTime,
} from "@/features/calendar/components/date-formatter";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

const EventDetailsScreen = () => {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const numericId = Number(eventId);
  const accentColor = useThemeColor("accent");

  const { data, isLoading, isError, error, refetch } = useEvent(numericId);
  const event = data?.[0];

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <NoDataFallback
        icon="CalendarIcon"
        title="Event not found"
        description="The event you're looking for doesn't exist"
      />
    );
  }

  if (isLoading) return <EventDetailsSkeleton />;

  if (isError) {
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );
  }

  if (!event) {
    return (
      <NoDataFallback
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
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-3xl mx-auto px-5 pt-2">
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
              value={toTitleCase(
                `${event.createdById.firstName} ${event.createdById.lastName}`,
              )}
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
      </View>
    </ScrollView>
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

const EventDetailsSkeleton = () => (
  <View className="w-full max-w-3xl mx-auto px-5 pt-2">
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

export default EventDetailsScreen;
