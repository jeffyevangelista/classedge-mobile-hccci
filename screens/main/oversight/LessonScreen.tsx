import { AppText } from "@/components/AppText";
import FileRenderer from "@/components/FileRenderer";
import Screen from "@/components/screen";
import { useLesson } from "@/features/oversight/oversight.hooks";
import { useFormattedDate } from "@/hooks/userFormattedDate";
import { useLocalSearchParams } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";

const LessonScreen = () => {
  const { lessonId } = useLocalSearchParams();
  const { isLoading, isError, error, data, isRefetching, refetch } = useLesson(
    lessonId as string,
  );

  if (isLoading) return <AppText>loading...</AppText>;
  if (isError) return <AppText>{error?.message}</AppText>;

  if (!data) return <AppText>No data foundd</AppText>;

  const formattedDate = data?.start_date
    ? useFormattedDate(data.start_date)
    : null;

  return (
    <Screen>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-10 w-full max-w-3xl mx-auto">
          <View>
            <AppText>{formattedDate || "Date not available"}</AppText>
            <AppText>{data.lesson_name}</AppText>
          </View>
          <AppText className="text-justify">{data.lesson_description}</AppText>

          <View className="gap-2">
            <AppText>Attachments</AppText>
            {(data.lesson_file || data.lesson_url) && (
              <FileRenderer url={data} />
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

export default LessonScreen;
