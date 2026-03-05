import { FlatList, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText } from "@/components/AppText";
import { useCourseTimeline } from "../courses.hooks";
import { Card } from "heroui-native";
import { Icon } from "@/components/Icon";
import { BookOpenTextIcon, PencilLineIcon } from "phosphor-react-native";
import { useFormattedDate } from "@/hooks/userFormattedDate";

const CourseTimeline = () => {
  const { courseId } = useLocalSearchParams();
  const { data, isLoading, isError, error } = useCourseTimeline(
    courseId as string,
  );

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>Error: {error.message}</AppText>;

  return (
    <FlatList
      style={{ flex: 1 }}
      data={data}
      scrollEnabled={false}
      ListEmptyComponent={
        <AppText className="text-center text-gray-500">
          No content found for this course.
        </AppText>
      }
      renderItem={({ item }) => <ListItem item={item} />}
      keyExtractor={(item) => `#${item.id}-${item.type}`}
      className="pt-5"
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
      <Card className="rounded-2xl flex-row items-center gap-2 shadow-none mb-2">
        <View className="p-2 bg-orange-50 rounded-full">
          <Icon as={PencilLineIcon} size={24} className="text-orange-500" />
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
          <AppText className="text-xs text-gray-500 ">
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
      <Card className="rounded-2xl flex-row items-center gap-2 shadow-none mb-2">
        <View className="p-2 bg-emerald-50 rounded-full">
          <Icon as={BookOpenTextIcon} size={24} className="text-emerald-500" />
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
          <AppText className="text-xs text-gray-500 ">
            Posted {formattedDate}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
};

export default CourseTimeline;
