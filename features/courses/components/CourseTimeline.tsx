import { FlatList, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText } from "@/components/AppText";
import { useCourseTimeline } from "../courses.hooks";
import { Card, Skeleton } from "heroui-native";
import { Icon } from "@/components/Icon";
import { useFormattedDate } from "@/hooks/userFormattedDate";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const CourseTimeline = () => {
  const { courseId } = useLocalSearchParams();
  const { data, isLoading, isError, error } = useCourseTimeline(
    courseId as string,
  );

  if (isLoading) return <CourseTimelineSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;

  return (
    <FlatList
      style={{ flex: 1 }}
      data={data}
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

const ListItem = ({ item }: { item: any }) => {
  const ListComponent =
    item.type === "material" ? MaterialCard : AssessmentCard;
  return <ListComponent item={item} />;
};

const AssessmentCard = ({ item }: { item: any }) => {
  const formattedDate = useFormattedDate(item.startDate);

  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/assessment/${item.id}`)}
      className="w-full max-w-3xl mx-auto"
    >
      <Card className="rounded-xl flex-row items-center gap-2 shadow-none mb-2">
        <View className="p-2 bg-orange-50 rounded-full">
          <Icon name="PencilLineIcon" size={24} className="text-orange-500" />
        </View>
        <View>
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.fileName}
          </AppText>
          <AppText className="text-xs text-gray-500">
            Posted {formattedDate}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
};

const MaterialCard = ({ item }: { item: any }) => {
  const formattedDate = useFormattedDate(item.startDate);
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/material/${item.id}`)}
      className="w-full max-w-3xl mx-auto"
    >
      <Card className="rounded-xl flex-row items-center gap-2 shadow-none mb-2">
        <View className="p-2 bg-emerald-50 rounded-full">
          <Icon
            name="BookOpenTextIcon"
            size={24}
            className="text-emerald-500"
          />
        </View>
        <View>
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.fileName}
          </AppText>
          <AppText className="text-xs text-gray-500">
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
            <Card className="rounded-xl flex-row items-center gap-2 shadow-none mb-2">
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
