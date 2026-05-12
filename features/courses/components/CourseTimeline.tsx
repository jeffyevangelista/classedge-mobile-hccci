import { FlatList, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText } from "@/components/AppText";
import { useCourseTimeline } from "../courses.hooks";
import { Card, Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/utils/formatDate";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";

type TimelineItem = {
  id: string;
  fileName: string;
  startDate: string;
  type: "material" | "assessment";
};

const CourseTimeline = () => {
  const { courseId } = useLocalSearchParams();

  const { data, isLoading, isError, error } = useCourseTimeline(
    courseId as string,
  );

  if (isLoading) return <CourseTimelineSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;

  return (
    <FlatList<TimelineItem>
      style={{ flex: 1 }}
      data={data as TimelineItem[] | undefined}
      scrollEnabled={false}
      ListEmptyComponent={
        <EmptyState
          icon="FolderOpenIcon"
          title="No content yet"
          description="No content found for this course"
        />
      }
      renderItem={({ item }) => <ListItem item={item} />}
      keyExtractor={(item) => `#${item.id}-${item.type}`}
      className="mt-5"
    />
  );
};

const ASSESSMENT_ICON_COLOR = "#f97316";
const MATERIAL_ICON_COLOR = "#10b981";

const ListItem = ({ item }: { item: TimelineItem }) => {
  const router = useRouter();
  const formattedDate = formatDate(item.startDate);

  const isAssessment = item.type === "assessment";
  const iconName = isAssessment ? "PencilLineIcon" : "BookOpenTextIcon";
  const iconColor = isAssessment ? ASSESSMENT_ICON_COLOR : MATERIAL_ICON_COLOR;
  const iconBgClass = isAssessment
    ? "bg-orange-100 dark:bg-orange-900/50"
    : "bg-emerald-100 dark:bg-emerald-900/50";
  const accessibilityLabel = `Open ${isAssessment ? "assessment" : "material"}: ${item.fileName}`;

  const handlePress = () => {
    if (isAssessment) {
      router.push(`/assessment/${item.id}`);
    } else {
      router.push(`/material/${item.id}`);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className="w-full max-w-3xl mx-auto"
    >
      <Card className="rounded-xl flex-row items-center gap-3 shadow-none mb-2">
        <View className={`p-2 rounded-full ${iconBgClass}`}>
          <Icon name={iconName} size={24} color={iconColor} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.fileName}
          </AppText>
          <AppText className="text-xs text-muted">
            Posted {formattedDate}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
};

const CourseTimelineSkeleton = () => {
  return (
    <View className="mt-5">
      {Array(5)
        .fill(0)
        .map((_, index) => (
          <View key={index} className="w-full max-w-3xl mx-auto">
            <Card className="rounded-xl flex-row items-center gap-3 shadow-none mb-2">
              <Skeleton className="w-10 h-10 rounded-full" />
              <View className="flex-1 gap-1.5">
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </View>
            </Card>
          </View>
        ))}
    </View>
  );
};

export default CourseTimeline;
