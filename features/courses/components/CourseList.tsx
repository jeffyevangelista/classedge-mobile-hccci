import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import { Card, Skeleton } from "heroui-native";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { env } from "@/utils/env";
import { useStudentCourses } from "../courses.hooks";
import { StudentEnrolledCourses } from "../courses.types";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const MIN_CARD_WIDTH = 280;

const CourseList = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useStudentCourses();

  if (isLoading) return <CourseListSkeleton numColumns={numColumns} />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <View className="w-full max-w-6xl mx-auto flex-1">
      <FlashList
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="BookOpenIcon"
            title="No courses found"
            description="You are not enrolled in any courses yet"
          />
        }
        key={numColumns}
        numColumns={numColumns}
        data={data}
        className="p-1"
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
              className="rounded-t-xl w-full aspect-video"
              contentFit="cover"
              cachePolicy="disk"
            />
            <View className="px-4 pb-4">
              <View className="md:h-14">
                <AppText
                  numberOfLines={2}
                  weight="semibold"
                  className="text-lg md:text-md leading-6"
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

const CourseListSkeleton = ({ numColumns }: { numColumns: number }) => {
  return (
    <View className="w-full max-w-6xl mx-auto flex-1 px-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 15 }}>
        <View className="flex-row flex-wrap">
          {Array(6)
            .fill(0)
            .map((_, index) => (
              <View
                key={index}
                style={{ width: `${100 / numColumns}%`, padding: 10 / 2 }}
              >
                <Card className="p-0 shadow-none rounded-xl">
                  <Card.Body className="gap-2.5">
                    <Skeleton className="rounded-t-xl w-full aspect-video" />
                    <View className="px-4 pb-4 gap-2">
                      <Skeleton className="h-5 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                    </View>
                  </Card.Body>
                </Card>
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default CourseList;
