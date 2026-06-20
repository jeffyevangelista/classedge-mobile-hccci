import { useCallback, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import Screen from "@/components/screen";
import TabsHeader from "@/components/TabsHeader";
import { SectionHeader } from "@/components/SectionHeader";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import { useAnnouncementsWithEvents } from "@/features/announcements/announcements.hooks";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import CampusNewsSection from "@/features/campus-news/components/CampusNewsSection";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";

const HomeScreen = () => {
  const { authUser } = useStore();
  const announcements = useAnnouncementsWithEvents();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ stale: true }),
      announcements.refresh?.(),
    ]);
    setRefreshing(false);
  }, [announcements]);

  const isStudent = authUser?.role === "Student";

  return (
    <Screen>
      <TabsHeader />
      <ScreenScrollView
        showsVerticalScrollIndicator={false}
        className="w-full"
        scrollIndicatorInsets={{ right: 1 }}
        refreshControl={
          <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isStudent && (
          <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
            <SectionHeader title="My Schedule" iconName="CalendarIcon" />
            <ScheduleComponent />
          </View>
        )}

        <CampusNewsSection />

        <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
          <SectionHeader
            title="Announcements"
            iconName="MegaphoneIcon"
            actionLabel="See all"
            onAction={() => router.push("/announcement")}
          />
        </View>
        <AnnouncementList preview {...announcements} />
      </ScreenScrollView>
    </Screen>
  );
};

export default HomeScreen;
