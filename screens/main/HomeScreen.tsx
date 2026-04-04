import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import PendingAssessmentList from "@/features/courses/components/PendingAssessmentList";
import SyncBanner from "@/features/sync/components/SyncBanner";
import { powersync } from "@/powersync/system";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";
import { Button } from "heroui-native";

const HomeScreen = () => {
  const { authUser } = useStore();
  const [connected, setConnected] = useState(powersync.connected);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    return powersync.registerListener({
      statusChanged: (status) => {
        setConnected(status.connected);
      },
    });
  }, [powersync]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({
      stale: true,
    });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <Screen className="">
      {/* <Pressable
        onPress={() => {
          Alert.alert(
            "Status",
            `${connected ? "Connected" : "Disconnected"}. \nLast Synced at ${
              powersync.currentStatus?.lastSyncedAt?.toISOString() ?? "-"
            }\nVersion: ${powersync.sdkVersion}`,
          );
        }}
      >
        <Icon
          name={connected ? WifiHighIcon : WifiSlashIcon}
          color="black"
          size={20}
          style={{ padding: 5 }}
        />
      </Pressable> */}

      <ScrollView
        className=" w-full max-w-3xl mx-auto  pb-5 "
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <AppText weight="semibold" className="text-lg px-2.5 mt-5">
          Announcements
        </AppText>
        <AnnouncementList />
      </ScrollView>
    </Screen>
  );
};

export default HomeScreen;
