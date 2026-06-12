import { useCallback, useState } from "react";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import Screen from "@/components/screen";
import AnnouncementList from "@/features/announcements/components/AnnouncementList";
import { useAnnouncementsWithEvents } from "@/features/announcements/announcements.hooks";

const AnnouncementsRoute = () => {
  const announcements = useAnnouncementsWithEvents();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await announcements.refresh?.();
    setRefreshing(false);
  }, [announcements]);

  return (
    <Screen>
      <ScreenScrollView
        className="w-full"
        scrollIndicatorInsets={{ right: 1 }}
        refreshControl={
          <RefreshIndicator refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <AnnouncementList {...announcements} />
      </ScreenScrollView>
    </Screen>
  );
};

export default AnnouncementsRoute;
