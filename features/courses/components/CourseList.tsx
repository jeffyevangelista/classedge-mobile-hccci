import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import { Card } from "heroui-native";
import { Pressable, useWindowDimensions, View } from "react-native";
import { env } from "@/utils/env";
import { useStudentCourses } from "../courses.hooks";
import { StudentEnrolledCourses } from "../courses.types";

const MIN_CARD_WIDTH = 280;

const CourseList = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { data, isLoading, isError, error } = useStudentCourses();

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>{error.message}</AppText>;

  return (
    <View className="w-full max-w-6xl mx-auto flex-1  ">
      <FlashList
        ListEmptyComponent={<AppText>No Courses Found</AppText>}
        key={numColumns}
        numColumns={numColumns}
        data={data}
        className="px-1"
        contentContainerStyle={{ paddingBottom: 15 }}
        renderItem={({ item }) => (
          <Course item={item} numColumns={numColumns} />
        )}
      />
    </View>
  );
};

const Course = ({
  item,
  numColumns,
}: {
  item: StudentEnrolledCourses;
  numColumns: number;
}) => {
  return (
    <Link
      href={`/course/${item.id}`}
      style={{ flex: 1 / numColumns, padding: 10 / 2 }}
      asChild
    >
      <Pressable>
        <Card className="p-0 shadow-none rounded-xl">
          <Card.Body className="gap-2.5">
            <Image
              source={
                item.subjectId.subjectPhoto
                  ? {
                      uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${item.subjectId.subjectPhoto}`,
                    }
                  : require("@/assets/placeholder/bg-placeholder.png")
              }
              className="rounded-t-lg w-full aspect-video"
              contentFit="cover"
              cachePolicy="disk"
            />
            <View className="px-4 pb-4">
              <View className="md:h-14">
                <AppText
                  numberOfLines={2}
                  className="font-semibold text-lg md:text-md leading-6"
                >
                  {item.subjectId.subjectName}
                </AppText>
              </View>
              <AppText numberOfLines={1} className="text-xs text-gray-500">
                {item.subjectId.roomNumber} ·{" "}
                {item.subjectId.assignTeacherId?.firstName}{" "}
                {item.subjectId.assignTeacherId?.lastName}
              </AppText>
            </View>
          </Card.Body>
        </Card>
      </Pressable>
    </Link>
  );
};

export default CourseList;
