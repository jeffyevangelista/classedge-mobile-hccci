import {
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import React from "react";
import Screen from "@/components/screen";
import { useTeachingCourses } from "@/features/teaching/teaching.hooks";
import { AppText } from "@/components/AppText";
import { FlashList } from "@shopify/flash-list";
import { Card, Skeleton } from "heroui-native";
import { Link } from "expo-router";
import Image from "@/components/Image";
import { env } from "@/utils/env";
import EmptyState from "@/components/EmptyState";
import { Subject } from "@/powersync/schema";

const MIN_CARD_WIDTH = 280;

const TeachingScreen = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { isLoading, isError, error, data, refetch, isRefetching } =
    useTeachingCourses();

  if (isLoading) return <TeachingListSkeleton numColumns={numColumns} />;
  if (isError) return <AppText>{error.message}</AppText>;

  return (
    <Screen className="px-2.5">
      <View className="w-full max-w-6xl mx-auto flex-1">
        <FlashList
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="BookOpenIcon"
              title="No courses found"
              description="You have no assigned courses yet"
            />
          }
          key={numColumns}
          numColumns={numColumns}
          data={data}
          className="p-1"
          contentContainerStyle={{ paddingBottom: 15 }}
          renderItem={({ item }) => (
            <TeachingCourse item={item} numColumns={numColumns} />
          )}
        />
      </View>
    </Screen>
  );
};

const TeachingCourse = ({
  item,
  numColumns,
}: {
  item: Subject;
  numColumns: number;
}) => {
  return (
    <Link
      href={`/classroom/${item.id}`}
      style={{ flex: 1 / numColumns, padding: 10 / 2 }}
      asChild
    >
      <Pressable>
        <Card className="p-0 shadow-none rounded-xl">
          <Card.Body className="gap-2.5">
            <Image
              source={
                item.subjectPhoto
                  ? {
                      uri: `${env.EXPO_PUBLIC_API_BASE_URL}/media/${item.subjectPhoto}`,
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
                  {item.subjectName}
                </AppText>
              </View>
              <AppText numberOfLines={1} className="text-xs text-gray-500">
                {item.roomNumber} · {item.subjectCode}
              </AppText>
            </View>
          </Card.Body>
        </Card>
      </Pressable>
    </Link>
  );
};

const TeachingListSkeleton = ({ numColumns }: { numColumns: number }) => {
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
                    <Skeleton className="rounded-t-lg w-full aspect-video" />
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

export default TeachingScreen;
