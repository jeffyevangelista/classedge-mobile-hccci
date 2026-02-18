import { memo, useCallback } from "react";
import { View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { FlashList } from "@shopify/flash-list";
import { Card } from "heroui-native";
import { BookOpenIcon } from "phosphor-react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Screen from "@/components/screen";
import AnnouncementList from "@/features/home/components/AnnouncementList";
import SyncBanner from "@/features/sync/components/SyncBanner";
import { colors } from "@/utils/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Header from "@/features/home/components/Header";

// Move static types and data outside the component
type PendingAssessment = {
  id: string;
  assessmentName: string;
  dueDate: string;
};

const PENDING_ASSESSMENTS: PendingAssessment[] = [
  {
    id: "pa-001",
    assessmentName: "Quarterly Financial Audit",
    dueDate: "2026-01-15",
  },
  {
    id: "pa-002",
    assessmentName: "Security Compliance Review",
    dueDate: "2026-01-20",
  },
  {
    id: "pa-003",
    assessmentName: "User Experience Heuristic Evaluation",
    dueDate: "2026-02-05",
  },
  {
    id: "pa-004",
    assessmentName: "Mid-Year Performance Feedback",
    dueDate: "2025-12-30",
  },
  {
    id: "pa-005",
    assessmentName: "Accessibility Standards Checklist",
    dueDate: "2026-03-12",
  },
];

const AssessmentItem = memo(({ item }: { item: PendingAssessment }) => (
  <Card className="w-72 md:w-80 lg:w-96 mr-3">
    <Card.Body className="flex flex-row items-center gap-2.5">
      <View className="p-2 bg-emerald-100 rounded-full">
        <Icon as={BookOpenIcon} size={24} className="text-emerald-500" />
      </View>
      <View className="flex-1">
        <AppText numberOfLines={1} weight="semibold">
          {item.assessmentName}
        </AppText>
        <AppText className="text-gray-500 text-sm">{item.dueDate}</AppText>
      </View>
    </Card.Body>
  </Card>
));

const HomeScreen = () => {
  const renderAssessment = useCallback(
    ({ item }: { item: PendingAssessment }) => <AssessmentItem item={item} />,
    [],
  );

  const { top } = useSafeAreaInsets();

  return (
    <Screen>
      <ScrollView style={{ paddingTop: top }} removeClippedSubviews={true}>
        <View className="gap-6 w-full max-w-3xl mx-auto pt-2.5 pb-10">
          {/* Header Section */}
          <Header />
          <View className="px-5 gap-5">
            <SyncBanner />
            <Card
              className="w-full h-44 rounded-3xl"
              style={{ backgroundColor: colors.primary[500] }}
            />
          </View>

          {/* Pending Submissions - Optimized FlashList */}
          <View className="gap-3">
            <AppText weight="semibold" className="text-lg px-5">
              Pending Submissions
            </AppText>
            <View>
              <FlashList
                data={PENDING_ASSESSMENTS}
                keyExtractor={(item) => item.id}
                renderItem={renderAssessment}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              />
            </View>
          </View>

          {/* Courses & Announcements */}
          <View className="px-5 gap-5">
            <View className="gap-3">
              <AppText weight="semibold" className="text-lg">
                Announcements
              </AppText>
              <AnnouncementList />
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

export default HomeScreen;
