import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import { Avatar, Card, Skeleton } from "heroui-native";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useGetSubjects } from "../oversight.hooks";
import { SubjectType } from "../oversight.type";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";

const MIN_CARD_WIDTH = 280;

const SubjectsList = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useGetSubjects();

  if (isLoading) return <SubjectsListSkeleton numColumns={numColumns} />;
  if (isError)
    return <ErrorFallback message={error.message} onRefetch={refetch} />;

  const subjects = data?.pages.flatMap((page) => page.results) ?? [];

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
        data={subjects}
        className="p-1"
        contentContainerStyle={{ paddingBottom: 15 }}
        renderItem={({ item }) => (
          <Subject subject={item} numColumns={numColumns} />
        )}
      />
    </View>
  );
};

const SubjectsListSkeleton = ({ numColumns }: { numColumns: number }) => {
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
                      <View className="flex-row gap-2 items-center">
                        <Skeleton className="rounded-full w-8 h-8" />
                        <Skeleton className="h-3 w-24 rounded" />
                      </View>
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

const Subject = ({
  subject,
  numColumns,
}: {
  subject: SubjectType;
  numColumns: number;
}) => {
  return (
    <Link
      href={`/subject/${subject.id}`}
      style={{ flex: 1 / numColumns, padding: 10 / 2 }}
      asChild
    >
      <Pressable>
        <Card className="p-0 shadow-none rounded-xl">
          <Card.Body className="gap-2.5">
            <Image
              source={
                subject.subject_photo
                  ? { uri: subject.subject_photo }
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
                  {subject.subject_name}
                </AppText>
              </View>
              <AppText numberOfLines={1} className="text-xs text-gray-500">
                {subject.subject_code}
              </AppText>
              <View className="flex-row gap-2 items-center mt-2">
                <Avatar alt={subject.assign_teacher_name} size="sm">
                  <Avatar.Fallback>
                    {subject.assign_teacher_name?.[0][0]}
                  </Avatar.Fallback>
                  <Avatar.Image
                    source={{
                      uri: subject.teacher_photo,
                    }}
                  />
                </Avatar>
                <AppText className="text-xs text-gray-500">
                  {subject.assign_teacher_name}
                </AppText>
              </View>
            </View>
          </Card.Body>
        </Card>
      </Pressable>
    </Link>
  );
};

export default SubjectsList;
