import { FlatList, Pressable, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/AppText";
import { useGetSubjects } from "../oversight.hooks";
import { Avatar, Card, Skeleton } from "heroui-native";
import { Link } from "expo-router";
import Image from "@/components/Image";
import { SubjectType } from "../oversight.type";
import EmptyState from "@/components/EmptyState";

const MIN_CARD_WIDTH = 280;

const SubjectsList = () => {
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useGetSubjects();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  if (isLoading) return <LoadingComponent />;

  if (isError) return <AppText>{error.message}</AppText>;

  const subjects = data?.pages.flatMap((page) => page.results) ?? [];

  return (
    <View className="w-full max-w-6xl mx-auto flex-1  ">
      <FlatList
        ListEmptyComponent={
          <EmptyState
            icon="BookOpenIcon"
            title="No courses found"
            description="You are not enrolled in any courses yet"
          />
        }
        className="p-1"
        data={subjects}
        renderItem={({ item }) => (
          <Subject subject={item} key={item.id} numColumns={numColumns} />
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        key={numColumns}
        numColumns={numColumns}
        contentContainerStyle={{ paddingBottom: 15 }}
      />
    </View>
  );
};

const LoadingComponent = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));

  return (
    <View className="w-full max-w-6xl mx-auto flex-1">
      <FlatList
        className="p-1"
        data={Array.from({ length: 6 })}
        renderItem={() => (
          <View style={{ flex: 1 / numColumns, padding: 10 / 2 }}>
            <Card className="shadow-none mb-5 rounded-xl p-0 overflow-hidden">
              <View className="relative h-40 w-full">
                <Skeleton className="object-cover w-full h-full" />
              </View>
              <View className="p-2 gap-1">
                <View>
                  <Skeleton className="rounded-full h-5 w-full" />
                  <Skeleton className="rounded-full h-3 w-24 mt-1" />
                </View>
                <View className="flex-row gap-2">
                  <Skeleton className="rounded-full w-8 h-8" />
                  <Skeleton className="rounded-full h-3 w-24 my-auto" />
                </View>
              </View>
            </Card>
          </View>
        )}
        keyExtractor={(_, index) => index.toString()}
        key={numColumns}
        numColumns={numColumns}
        contentContainerStyle={{ paddingBottom: 15 }}
      />
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
        <Card className="shadow-none mb-5 rounded-xl p-0 overflow-hidden ">
          <View className="relative h-40 w-full">
            <Image
              source={
                subject.subject_photo
                  ? { uri: subject.subject_photo }
                  : require("@/assets/placeholder/bg-placeholder.png")
              }
              alt={subject.subject_name}
              className="object-cover w-full h-full"
            />
          </View>
          <View className="p-2 gap-1">
            <View className="">
              <AppText
                className={"text-slate-900 font-semibold"}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {subject.subject_name}
              </AppText>
              <AppText className="text-typography-500">
                {subject.subject_code}
              </AppText>
            </View>

            <View className="flex-row gap-2">
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
              <AppText className="my-auto">
                {subject.assign_teacher_name}
              </AppText>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
};

export default SubjectsList;
