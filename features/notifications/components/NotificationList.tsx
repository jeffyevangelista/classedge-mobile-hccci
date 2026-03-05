import { View, Text, Pressable, RefreshControl } from "react-native";
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
import { BellSlashIcon } from "phosphor-react-native";

const NotificationList = () => {
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

  if (isError) return <Text>Error: {error.message}</Text>;

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
          <View className="p-5 rounded-full bg-blue-100">
            <Icon name="BellSlashIcon" size={100} className="text-blue-600" />
          </View>
          <AppText className="text-center text-xl">
            You have no notifications yet
          </AppText>
        </View>
      }
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
      className={`rounded ${isReadBool ? "border-b border-gray-200" : "mb-1"}`}
      href={
        entityType === "lesson"
          ? `/material/${entityId}`
          : `/assessment/${entityId}`
      }
      asChild
    >
      <Pressable
        onPress={handleReadNotification}
        className={`
        flex-row items-start p-4 rounded
        ${isReadBool ? "bg-white" : "bg-[#EBF5FF] "}
      `}
      >
        <Avatar alt="avatar">
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
            weight={isReadBool ? "regular" : "bold"}
            className={`text-sm ${isReadBool ? "text-slate-500" : "text-slate-900"}`}
            numberOfLines={2}
          >
            {createdById.firstName} {createdById.lastName} added {message}
          </AppText>
          <AppText className="text-[11px] text-slate-400 mt-1 uppercase font-medium">
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
