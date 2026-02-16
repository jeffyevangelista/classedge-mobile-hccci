import { AppText } from "@/components/AppText";
import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import { Avatar, Button, Spinner, useToast } from "heroui-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useNotifications, useReadNotification } from "../notifications.hooks";
import { Notification } from "../notifications.types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { queryClient } from "@/providers/QueryProvider";
import { useCallback, useEffect } from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import useStore from "@/lib/store";

const NotificationList = () => {
  const netInfo = useNetInfo();
  const { toast } = useToast();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useNotifications();

  const loadMore = useCallback(async () => {
    // Only attempt to fetch more if online
    if (netInfo.isConnected && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [netInfo.isConnected, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (isError) {
      console.log("Sync error:", error);
      toast.show({
        variant: "danger",
        label: "Error",
        description: "Could not update notifications.",
      });
    }
  }, [isError, error]);

  const notifications = data?.pages.flatMap((page) => page.results) ?? [];

  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.center}>
        <Spinner size="lg" />
      </View>
    );
  }

  if (isError && notifications.length === 0) {
    return (
      <View style={styles.center}>
        <AppText>Error loading notifications.</AppText>
        <Button onPress={() => refetch()}>
          <Button.Label>Retry</Button.Label>
        </Button>
      </View>
    );
  }

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <Spinner style={{ padding: 20 }} />;
    }

    if (hasNextPage && !netInfo.isConnected) {
      return (
        <View style={styles.footerInfo}>
          <AppText style={styles.footerText}>
            You are offline. Cannot load more notifications.
          </AppText>
        </View>
      );
    }

    return null;
  };

  return (
    <FlashList
      className="mx-auto w-full max-w-3xl"
      keyExtractor={(item) => item.id.toString()}
      data={notifications}
      ListEmptyComponent={
        <AppText className="text-center">No notifications</AppText>
      }
      renderItem={({ item }) => <NotificationItem {...item} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      // --- Pull to Refresh ---
      onRefresh={refetch}
      refreshing={isRefetching}
    />
  );
};

const NotificationItem = ({
  entity_type,
  is_read,
  entity_id,
  message,
  created_at,
  id,
  created_by_photo,
}: Notification) => {
  const { mutateAsync: readNotification, isPending } = useReadNotification();

  dayjs.extend(relativeTime);

  const formattedTime = dayjs(created_at).fromNow();
  const isReadBool = is_read === true;

  const handleReadNotification = async () => {
    try {
      await readNotification(id);
      queryClient.invalidateQueries({
        queryKey: ["notifications", "notifications-count"],
      });
      console.log("Notification read successfully");
    } catch (error: any) {
      console.log("failed to update notification", error.message);
    }
  };

  return (
    <Link
      className={`rounded ${isReadBool ? "border-b border-gray-200" : "mb-1"}`}
      href={
        entity_type === "lesson"
          ? `/material/${entity_id}`
          : `/assessment/${entity_id}`
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
              created_by_photo
                ? { uri: created_by_photo }
                : require("@/assets/placeholder/avatar-placeholder.png")
            }
          />
          <Avatar.Fallback>UN</Avatar.Fallback>
        </Avatar>

        {/* Content Section */}
        <View className="flex-1 ml-3">
          <AppText
            weight={isReadBool ? "regular" : "bold"}
            className={`text-sm ${isReadBool ? "text-slate-500" : "text-slate-900"}`}
            numberOfLines={2}
          >
            {message}
          </AppText>
          <AppText className="text-[11px] text-slate-400 mt-1 uppercase font-medium">
            {formattedTime}
          </AppText>
        </View>

        {/* Dot Indicator */}
        {!isReadBool && (
          <View className="w-2.5 h-2.5 rounded-full bg-blue-600 self-center ml-2" />
        )}
      </Pressable>
    </Link>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    marginBottom: 12,
  },
  cardBody: {
    gap: 12,
  },
  header: {
    gap: 4,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  teacherName: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  separator: {
    marginVertical: 4,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    minWidth: 50,
  },
  value: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  dayChip: {
    marginRight: 0,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  footerInfo: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    color: "gray",
    textAlign: "center",
  },
});
export default NotificationList;
