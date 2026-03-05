import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Screen from "@/components/screen";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import PendingAssessmentList from "@/features/courses/components/PendingAssessmentList";
import Header from "@/features/home/components/Header";
import SyncBanner from "@/features/sync/components/SyncBanner";

import { powersync } from "@/powersync/system";
import { WifiHighIcon, WifiSlashIcon } from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
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
      // queryKey: [
      //   "pending-assessments",
      //   "announcements-with-events",
      //   "user-details",
      // ],
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
          as={connected ? WifiHighIcon : WifiSlashIcon}
          color="black"
          size={20}
          style={{ padding: 5 }}
        />
      </Pressable> */}

      <ScrollView
        className=" w-full max-w-3xl mx-auto pt-15 pb-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Header />

        <View
          className="mt-5 px-5 gap-5"
          style={{ display: authUser?.role === "Student" ? "flex" : "none" }}
        >
          <SyncBanner />
          <ScheduleComponent />
        </View>

        <View
          className="mt-5 gap-3"
          style={{ display: authUser?.role === "Student" ? "flex" : "none" }}
        >
          <AppText weight="semibold" className="text-lg px-5">
            Pending Submissions
          </AppText>
          <PendingAssessmentList subjectId={""} horizontal />
        </View>
        <AppText weight="semibold" className="text-lg px-5 mt-5">
          Recent Announcements
        </AppText>
        <AnnouncementList />
      </ScrollView>
    </Screen>
  );
};

export default HomeScreen;
