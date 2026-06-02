import { useCallback, useState } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import Screen from "@/components/screen";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import CampusNewsSection from "@/features/campus-news/components/CampusNewsSection";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";

const HomeScreen = () => {
  const { authUser } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ stale: true });
    setRefreshing(false);
  }, []);

  const isStudent = authUser?.role === "Student";

  return (
    <Screen>
      <ScreenScrollView
        className="w-full"
        scrollIndicatorInsets={{ right: 1 }}
        refreshControl={
          <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isStudent && (
          <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
            <SectionHeader title="My Schedule" />
            <ScheduleComponent />
          </View>
        )}

        <CampusNewsSection />

        <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
          <SectionHeader title="Announcements" />
        </View>
        <AnnouncementList />
      </ScreenScrollView>
    </Screen>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <AppText weight="semibold" className="text-lg mb-3">
    {title}
  </AppText>
);

export default HomeScreen;
