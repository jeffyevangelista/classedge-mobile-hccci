import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Link } from "expo-router";
import { Avatar, Skeleton } from "heroui-native";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenList } from "@/components/ScreenList";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { getApiErrorMessage } from "@/lib/api-error";
import type { Notification } from "@/powersync/schema";
import { toTitleCase } from "@/utils/toTitleCase";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { useNotifications } from "../notifications.hooks";
import {
  getNotificationHref,
  readNotification,
} from "../notifications.service";

dayjs.extend(relativeTime);

const NotificationList = () => {
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useNotifications();

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <SectionView status={status}>
      <SectionView.Loading>
        <NotificationListSkeleton />
      </SectionView.Loading>
      <SectionView.Empty>
        <View className="max-w-3xl w-full mx-auto">
          <EmptyState
            icon="BellSlashIcon"
            title="You have no notifications yet"
          />
        </View>
      </SectionView.Empty>
      <SectionView.OfflineEmpty>
        <OfflineEmpty section="notifications" />
      </SectionView.OfflineEmpty>
      <SectionView.Ready>
        <ScreenList
          refreshControl={
            <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
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
          data={data ?? []}
        />
      </SectionView.Ready>
    </SectionView>
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
