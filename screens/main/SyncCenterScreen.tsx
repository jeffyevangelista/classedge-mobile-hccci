import { ScrollView, View } from "react-native";
import StatusSection from "@/features/sync/components/StatusSection";
import QueueSection from "@/features/sync/components/QueueSection";
import StuckSection from "@/features/sync/components/StuckSection";
import FailedSection from "@/features/sync/components/FailedSection";
import EventsSection from "@/features/sync/components/EventsSection";
import AdvancedSection from "@/features/sync/components/AdvancedSection";

const SyncCenterScreen = () => {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel="Sync Center"
        accessibilityElementsHidden={false}
        importantForAccessibility="yes"
        style={{ height: 0 }}
      />
      <StatusSection />
      <QueueSection />
      <FailedSection />
      <StuckSection />
      <EventsSection />
      <AdvancedSection />
    </ScrollView>
  );
};

export default SyncCenterScreen;
