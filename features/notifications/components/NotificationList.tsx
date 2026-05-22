import { View, Pressable } from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { useNotifications } from "../notifications.hooks";
import { FlashList } from "@shopify/flash-list";
import { AppText } from "@/components/AppText";
import { Avatar, Skeleton } from "heroui-native";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Notification } from "@/powersync/schema";
import { Link } from "expo-router";
import { getNotificationHref, readNotification } from "../notifications.service";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";

dayjs.extend(relativeTime);

const NotificationList = () => {
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useNotifications();
  if (isLoading) {
    return <NotificationListSkeleton />;
  }

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <FlashList
      refreshControl={
        <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
      }
      ListEmptyComponent={
        <View className="max-w-3xl w-full mx-auto">
          <EmptyState
            icon="BellSlashIcon"
            title="You have no notifications yet"
          />
        </View>
      }
      ItemSeparatorComponent={() => (
        <View className="max-w-3xl w-full mx-auto">
          <View className="h-px bg-border" />
        </View>
      )}
      renderItem={({ item }) => (
        <View className="max-w-3xl w-full mx-auto">
          <NotificationItem {...item} />
        </View>
      )}
      data={data}
    />
  );
};

const NotificationItem = ({
  createdAt,
  isRead,
  id,
  message,
  createdById,
  entityType,
  entityId,
}: Notification) => {
  const formattedTime = dayjs(createdAt).fromNow();
  const isReadBool = isRead === 1;
  const actorName = toTitleCase(
    `${createdById.firstName} ${createdById.lastName}`,
  );

  const handleReadNotification = async () => {
    try {
      await readNotification(id.toString());
    } catch (err: unknown) {
      console.warn(
        "[NotificationItem] failed to update notification",
        getApiErrorMessage(err),
      );
    }
  };

  return (
    <Link href={getNotificationHref(entityType, entityId)} asChild>
      <Pressable
        onPress={handleReadNotification}
        accessibilityRole="button"
        accessibilityLabel={`${actorName}. ${message}`}
        className={`flex-row items-start p-4 ${isReadBool ? "bg-transparent" : "bg-accent-soft"}`}
      >
        <Avatar alt={actorName} size="sm">
          <AttachmentAvatarImage path={createdById.studentPhoto} />
          <AvatarFallbackImage />
        </Avatar>

        <View className="flex-1 ml-3">
          <AppText
            weight={isReadBool ? "regular" : "semibold"}
            className={`text-sm ${isReadBool ? "text-muted" : "text-foreground"}`}
            numberOfLines={1}
          >
            {actorName}
          </AppText>
          <AppText
            className={`text-xs mt-0.5 ${isReadBool ? "text-muted" : "text-foreground"}`}
            numberOfLines={2}
          >
            {message}
          </AppText>
          <AppText
            className={`text-[10px] mt-1 uppercase font-medium ${
              isReadBool ? "text-muted" : "text-accent"
            }`}
          >
            {formattedTime}
          </AppText>
        </View>

        {!isReadBool && (
          <View className="w-2.5 h-2.5 rounded-full bg-accent self-center ml-2" />
        )}
      </Pressable>
    </Link>
  );
};

const NotificationListSkeleton = () => {
  return (
    <View>
      {Array(8)
        .fill(0)
        .map((_, index) => (
          <View key={index} className="max-w-3xl w-full mx-auto">
            <View className="flex-row items-start p-4">
              <Skeleton className="w-8 h-8 rounded-full" />
              <View className="flex-1 ml-3 gap-1.5">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </View>
            </View>
            <View className="h-px bg-border" />
          </View>
        ))}
    </View>
  );
};

export default NotificationList;
