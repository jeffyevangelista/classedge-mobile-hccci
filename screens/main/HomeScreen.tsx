import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import HomeTabHeader from "@/components/HomeTabHeader";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { SectionHeader } from "@/components/SectionHeader";
import Screen from "@/components/screen";
import { useAnnouncementsWithEvents } from "@/features/announcements/announcements.hooks";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import CampusNewsSection from "@/features/campus-news/components/CampusNewsSection";
import GreetingBand from "@/features/home/components/GreetingBand";
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";

const HomeScreen = () => {
  const { authUser } = useStore();
  const announcements = useAnnouncementsWithEvents();
  const [refreshing, setRefreshing] = useState(false);
  const bottomInset = useScrollBottomInset();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ stale: true }),
        announcements.refresh?.(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [announcements]);

  const refreshControl = useMemo(
    () => <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />,
    [refreshing, onRefresh],
  );

  const isStudent = authUser?.role === "Student";

  return (
    <Screen>
      <ScrollView
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        className="w-full"
        scrollIndicatorInsets={{ right: 1 }}
        style={{ marginBottom: bottomInset }}
      >
        <HomeTabHeader />
        <GreetingBand />

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
      </ScrollView>
    </Screen>
  );
};

export default HomeScreen;
