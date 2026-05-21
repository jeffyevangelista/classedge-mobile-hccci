import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";
import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import {
  Avatar,
  Card,
  InputGroup,
  Skeleton,
  useThemeColor,
} from "heroui-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import { useGetSubjects } from "../oversight.hooks";
import { SubjectType } from "../oversight.type";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";

const MIN_CARD_WIDTH = 280;

const SubjectsList = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useGetSubjects();

  const [search, setSearch] = useState("");

  const subjects = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) =>
      (s.subjectName ?? "").toLowerCase().includes(q),
    );
  }, [subjects, search]);

  if (isLoading) return <SubjectsListSkeleton numColumns={numColumns} />;
  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <View className="w-full max-w-6xl mx-auto flex-1">
      <SubjectsToolbar search={search} onSearchChange={setSearch} />
      <FlashList
        refreshControl={
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="BookOpenIcon"
            title={search ? "No matching courses" : "No courses found"}
            description={
              search
                ? "Try a different search term"
                : "You are not enrolled in any courses yet"
            }
          />
        }
        key={numColumns}
        numColumns={numColumns}
        data={visible}
        className="p-1"
        contentContainerStyle={{ paddingBottom: 15 }}
        renderItem={({ item }) => (
          <Subject subject={item} numColumns={numColumns} />
        )}
      />
    </View>
  );
};

const SubjectsToolbar = ({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) => {
  const mutedColor = useThemeColor("muted");
  return (
    <View className="flex-row items-center gap-2 px-2 pt-2 pb-1">
      <InputGroup className="flex-1 shadow-none">
        <InputGroup.Prefix>
          <Icon name="MagnifyingGlassIcon" size={18} color={mutedColor} />
        </InputGroup.Prefix>
        <InputGroup.Input
          placeholder="Search courses"
          value={search}
          onChangeText={onSearchChange}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </InputGroup>
    </View>
  );
};

const SubjectsListSkeleton = ({ numColumns }: { numColumns: number }) => {
  return (
    <View className="w-full max-w-6xl mx-auto flex-1 px-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 15 }}>
        <View className="px-2 pt-2 pb-1">
          <Skeleton className="h-10 w-full rounded-xl" />
        </View>
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
                subject.subjectPhoto
                  ? { uri: subject.subjectPhoto }
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
                  {subject.subjectName}
                </AppText>
              </View>
              <AppText numberOfLines={1} className="text-xs text-gray-500">
                {subject.subjectCode}
              </AppText>
              <View className="flex-row gap-2 items-center mt-2">
                <Avatar alt={subject.assignTeacherName} size="sm">
                  <Avatar.Image
                    source={{
                      uri: subject.teacherPhoto,
                    }}
                  />
                  <AvatarFallbackImage />
                </Avatar>
                <AppText className="text-xs text-gray-500">
                  {subject.assignTeacherName}
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
