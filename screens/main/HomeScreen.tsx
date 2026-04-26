import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import { powersync } from "@/powersync/system";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";

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
    <Screen>
      <ScrollView
        className="w-full pb-5"
        scrollIndicatorInsets={{ right: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {authUser?.role === "Student" && (
          <View className="px-2.5 mt-5 max-w-3xl mx-auto w-full">
            <AppText weight="semibold" className="text-lg mb-3">
              My Schedule
            </AppText>
            <ScheduleComponent />
          </View>
        )}

        <View className="w-full max-w-3xl mx-auto">
          <AppText weight="semibold" className="text-lg px-2.5 mt-5 mb-3 ">
            Announcements
          </AppText>
        </View>
        <AnnouncementList />
      </ScrollView>
    </Screen>
  );
};

export default HomeScreen;
