import { View, Pressable, RefreshControl, useColorScheme } from "react-native";
import { useNotifications } from "../notifications.hooks";
import { FlashList } from "@shopify/flash-list";
import { AppText } from "@/components/AppText";
import { Avatar, Card, Skeleton } from "heroui-native";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Notification } from "@/powersync/schema";
import { Link } from "expo-router";
import { readNotification } from "../notifications.service";
import { Icon } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const NotificationList = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
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
        <RefreshControl
          refreshing={isRefetching} // Visual spinner shows while refetching
          onRefresh={refetch} // Triggered on pull
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon="BellSlashIcon"
          title="You have no notifications yet"
        />
      }
      ItemSeparatorComponent={() => (
        <View className="h-px bg-slate-200 dark:bg-slate-700" />
      )}
      renderItem={({ item }) => <NotificationItem {...item} />}
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
  dayjs.extend(relativeTime);

  const formattedTime = dayjs(createdAt).fromNow();
  const isReadBool = isRead === 1;

  const handleReadNotification = async () => {
    try {
      await readNotification(id.toString());
      console.log("Notification read successfully");
    } catch (error: any) {
      console.log("failed to update notification", getApiErrorMessage(error));
    }
  };

  return (
    <Link
      href={
        entityType === "lesson"
          ? `/material/${entityId}`
          : `/assessment/${entityId}`
      }
      asChild
    >
      <Pressable
        onPress={handleReadNotification}
        className={`flex-row items-start p-4 ${isReadBool ? "bg-transparent" : "bg-blue-400/15 dark:bg-blue-400/10"}`}
      >
        <Avatar alt="avatar" size="sm">
          <Avatar.Image
            source={
              createdById.studentPhoto
                ? { uri: createdById.studentPhoto }
                : require("@/assets/placeholder/avatar-placeholder.png")
            }
          />
          <Avatar.Fallback>{createdById.firstName.charAt(0)}</Avatar.Fallback>
        </Avatar>

        <View className="flex-1 ml-3">
          <AppText
            weight={isReadBool ? "regular" : "semibold"}
            className={`text-xs ${isReadBool ? "text-slate-500 dark:text-slate-400" : "text-slate-700 dark:text-slate-200"}`}
            numberOfLines={2}
          >
            {createdById.firstName} {createdById.lastName} added {message}
          </AppText>
          <AppText
            className={`text-[10px] mt-1 uppercase font-medium ${isReadBool ? "text-slate-400 dark:text-slate-500" : "text-blue-100"}`}
          >
            {formattedTime}
          </AppText>
        </View>

        {!isReadBool && (
          <View className="w-2.5 h-2.5 rounded-full bg-blue-600 self-center ml-2" />
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
          <View key={index}>
            <View className="flex-row items-start p-4">
              <Skeleton className="w-8 h-8 rounded-full" />
              <View className="flex-1 ml-3 gap-1.5">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </View>
            </View>
            <View className="h-px bg-slate-200 dark:bg-slate-700" />
          </View>
        ))}
    </View>
  );
};

export default NotificationList;
