import { AppText } from "@/components/AppText";
import Screen from "@/components/screen";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import ScheduleComponent from "@/features/announcements/components/ScheduleComponent";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import useStore from "@/lib/store";
import { queryClient } from "@/providers/QueryProvider";
import { useSafeBottomInset } from "@/hooks/useSafeBottomInset";
import { RefreshIndicator } from "@/components/RefreshIndicator";

const HomeScreen = () => {
  const { authUser } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const safeBottom = useSafeBottomInset();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ stale: true });
    setRefreshing(false);
  }, []);

  return (
    <Screen>
      <ScrollView
        className="w-full"
        scrollIndicatorInsets={{ right: 1 }}
        contentContainerStyle={{ paddingBottom: safeBottom + 20 }}
        refreshControl={
          <RefreshIndicator
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {authUser?.role === "Student" && (
          <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
            <SectionHeader title="My Schedule" />
            <ScheduleComponent />
          </View>
        )}

        <View className="w-full max-w-3xl mx-auto px-2.5 mt-5">
          <SectionHeader title="Announcements" />
        </View>
        <AnnouncementList />
      </ScrollView>
    </Screen>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <AppText weight="semibold" className="text-lg mb-3">
    {title}
  </AppText>
);

export default HomeScreen;
