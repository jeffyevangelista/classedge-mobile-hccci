import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Link } from "expo-router";
import { Avatar, Skeleton } from "heroui-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon, type IconName } from "@/components/Icon";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenList } from "@/components/ScreenList";
import { AttachmentAvatarImage } from "@/features/attachments/components/AttachmentAvatarImage";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { SectionView } from "@/features/sync/components/SectionView";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { track } from "@/lib/activity-tracker";
import { getApiErrorMessage } from "@/lib/api-error";
import useStore from "@/lib/store";
import type { Notification } from "@/powersync/schema";
import { toTitleCase } from "@/utils/toTitleCase";
import { useNotifications } from "../notifications.hooks";
import {
  getNotificationHref,
  readAllNotifications,
  readNotification,
} from "../notifications.service";

dayjs.extend(relativeTime);

const ENTITY_ICON: Record<string, IconName> = {
  announcement: "MegaphoneIcon",
  event: "CalendarBlankIcon",
  lesson: "BookOpenIcon",
  module: "BookOpenIcon",
  assessment: "ClipboardTextIcon",
};

const getEntityIcon = (entityType: string): IconName =>
  ENTITY_ICON[entityType] ?? "InfoIcon";

const NotificationList = () => {
  const { authUser } = useStore();
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useNotifications();

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  const items = data ?? [];
  const hasUnread = useMemo(() => items.some((n) => n.isRead === 0), [items]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const handleMarkAllRead = async () => {
    if (!authUser?.id || isMarkingAllRead) return;
    setIsMarkingAllRead(true);
    try {
      await readAllNotifications(authUser.id.toString());
    } catch (err: unknown) {
      console.warn(
        "[NotificationList] mark all as read failed",
        getApiErrorMessage(err),
      );
    } finally {
      setIsMarkingAllRead(false);
    }
  };

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
        <View className="max-w-3xl w-full mx-auto flex-1">
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
          ListHeaderComponent={
            hasUnread ? (
              <View className="bg-surface max-w-3xl w-full mx-auto px-4 py-1 flex-row justify-end">
                <Pressable
                  onPress={handleMarkAllRead}
                  disabled={isMarkingAllRead}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all notifications as read"
                  className={`active:opacity-60 ${
                    isMarkingAllRead ? "opacity-50" : ""
                  }`}
                >
                  <AppText weight="semibold" className="text-sm text-accent">
                    Mark all as read
                  </AppText>
                </Pressable>
              </View>
            ) : null
          }
          data={items}
          renderItem={({ item }) => (
            <View className="max-w-3xl w-full mx-auto">
              <NotificationItem {...item} />
            </View>
          )}
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
  const rawActor =
    `${createdById?.firstName ?? ""} ${createdById?.lastName ?? ""}`.trim();
  const hasActor = rawActor.length > 0;
  const actorName = hasActor ? toTitleCase(rawActor) : "System";

  const handleReadNotification = async () => {
    track("open_notification", {
      entityType,
      entityId: entityId != null ? String(entityId) : undefined,
    });
    if (isReadBool) return;
    try {
      await readNotification(id.toString());
    } catch (err: unknown) {
      console.warn(
        "[NotificationItem] failed to update notification",
        getApiErrorMessage(err),
      );
    }
  };

  const categoryIcon = getEntityIcon(entityType);

  return (
    <Link href={getNotificationHref(entityType, entityId)} asChild>
      <Pressable
        onPress={handleReadNotification}
        accessibilityRole="button"
        accessibilityLabel={`${message}. From ${actorName}, ${formattedTime}.`}
        android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
        className={`flex-row items-start p-4 border-b border-border active:opacity-80 ${
          isReadBool ? "bg-transparent" : "bg-accent-soft"
        }`}
      >
        <View>
          {hasActor ? (
            <Avatar alt={actorName} size="sm">
              <AttachmentAvatarImage path={createdById?.studentPhoto} />
              <AvatarFallbackImage />
            </Avatar>
          ) : (
            <View className="w-8 h-8 rounded-full bg-accent-soft items-center justify-center">
              <Icon
                name={categoryIcon}
                size={16}
                className={isReadBool ? "text-muted" : "text-accent"}
              />
            </View>
          )}
          {hasActor && (
            <View className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface border border-border items-center justify-center">
              <Icon
                name={categoryIcon}
                size={10}
                className={isReadBool ? "text-muted" : "text-accent"}
              />
            </View>
          )}
        </View>

        <View className="flex-1 ml-3">
          <AppText
            weight={isReadBool ? "regular" : "semibold"}
            className={`text-sm ${isReadBool ? "text-muted" : "text-foreground"}`}
            numberOfLines={2}
          >
            {message}
          </AppText>
          <AppText className="text-xs text-muted mt-1" numberOfLines={1}>
            {actorName} · {formattedTime}
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
      <View className="bg-surface max-w-3xl w-full mx-auto px-4 py-1.5 flex-row justify-end">
        <Skeleton className="h-4 w-32 rounded" />
      </View>
      {Array(8)
        .fill(0)
        .map((_, index) => (
          <View key={index} className="max-w-3xl w-full mx-auto">
            <View className="flex-row items-start p-4 border-b border-border">
              <Skeleton className="w-8 h-8 rounded-full" />
              <View className="flex-1 ml-3 gap-1.5">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-32 rounded mt-1" />
              </View>
            </View>
          </View>
        ))}
    </View>
  );
};

export default NotificationList;
