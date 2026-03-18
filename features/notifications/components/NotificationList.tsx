import {
  View,
  Text,
  Pressable,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { useNotifications } from "../notifications.hooks";
import { FlashList } from "@shopify/flash-list";
import { AppText } from "@/components/AppText";
import { Avatar, Card, SkeletonGroup } from "heroui-native";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Notification } from "@/powersync/schema";
import { Link } from "expo-router";
import { readNotification } from "../notifications.service";
import { Icon } from "@/components/Icon";

const NotificationList = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useNotifications();
  if (isLoading) {
    return (
      <SkeletonGroup className="flex-row items-center gap-3 px-4">
        <SkeletonGroup.Item className="h-12 w-12 rounded-full" />
        <View className="flex-1 gap-1.5">
          <SkeletonGroup.Item className="h-4 w-full rounded-md" />
          <SkeletonGroup.Item className="h-3 w-1/8 rounded-md" />
        </View>
      </SkeletonGroup>
    );
  }

  if (isError)
    return <Text className="dark:text-white">Error: {error.message}</Text>;

  return (
    <FlashList
      refreshControl={
        <RefreshControl
          refreshing={isRefetching} // Visual spinner shows while refetching
          onRefresh={refetch} // Triggered on pull
        />
      }
      ListEmptyComponent={
        <View className="items-center justify-center py-10 gap-5">
          <View className="p-5 rounded-full bg-blue-100 dark:bg-blue-900">
            <Icon
              name="BellSlashIcon"
              size={100}
              className="text-blue-600 dark:text-blue-400"
            />
          </View>
          <AppText className="text-center text-xl dark:text-white">
            You have no notifications yet
          </AppText>
        </View>
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
      console.log("failed to update notification", error.message);
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
            className={`text-xs ${isReadBool ? "text-slate-500 dark:text-slate-400" : "text-slate-700: dark:text-slate-200"}`}
            numberOfLines={2}
          >
            {createdById.firstName} {createdById.lastName} added {message}
          </AppText>
          <AppText
            className={`text-[8px] mt-1 uppercase font-medium ${isReadBool ? "text-slate-400 dark:text-slate-500" : "text-blue-100"}`}
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

export default NotificationList;
