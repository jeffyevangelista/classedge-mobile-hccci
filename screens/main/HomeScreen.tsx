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
      <ScrollView
        className="w-full max-w-3xl mx-auto pb-5"
        scrollIndicatorInsets={{ right: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {authUser?.role === "Student" && (
          <View className="px-2.5 mt-5">
            <AppText weight="semibold" className="text-lg mb-3">
              My Schedule
            </AppText>
            <ScheduleComponent />
          </View>
        )}

        <AppText weight="semibold" className="text-lg px-2.5 mt-5">
          Announcements
        </AppText>
        <AnnouncementList />
      </ScrollView>
    </Screen>
  );
};

export default HomeScreen;
