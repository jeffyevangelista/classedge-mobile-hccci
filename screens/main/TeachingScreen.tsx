import {
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import React, { useMemo, useState } from "react";
import Screen from "@/components/screen";
import { useTeachingCourses } from "@/features/teaching/teaching.hooks";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { AppText } from "@/components/AppText";
import { FlashList } from "@shopify/flash-list";
import {
  Card,
  InputGroup,
  Skeleton,
  useThemeColor,
} from "heroui-native";
import { Link } from "expo-router";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";

import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { Subject } from "@/powersync/schema";
import { getApiErrorMessage } from "@/lib/api-error";

const MIN_CARD_WIDTH = 280;

const TeachingScreen = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { isLoading, isError, error, data, refetch, isRefetching } =
    useTeachingCourses();

  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const list = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      (c.subjectName ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const status = useSectionStatus({
    data: data ?? [],
    isEmpty: (d) => d.length === 0,
    isLoading,
  });

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  return (
    <Screen className="">
      <SectionView status={status}>
        <SectionView.Loading>
          <TeachingListSkeleton numColumns={numColumns} />
        </SectionView.Loading>
        <SectionView.Empty>
          <View className="w-full max-w-6xl mx-auto flex-1">
            <TeachingToolbar search={search} onSearchChange={setSearch} />
            <EmptyState
              icon="BookOpenIcon"
              title="No courses found"
              description="You have no assigned courses yet"
            />
          </View>
        </SectionView.Empty>
        <SectionView.OfflineEmpty>
          <OfflineEmpty section="teaching" />
        </SectionView.OfflineEmpty>
        <SectionView.Ready>
          <View className="w-full max-w-6xl mx-auto flex-1">
            <TeachingToolbar search={search} onSearchChange={setSearch} />
            <FlashList
              refreshControl={
                <RefreshIndicator
                  refreshing={isRefetching}
                  onRefresh={refetch}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  icon="BookOpenIcon"
                  title="No matching courses"
                  description="Try a different search term"
                />
              }
              key={numColumns}
              numColumns={numColumns}
              data={visible}
              className="p-1"
              contentContainerStyle={{ paddingBottom: 15 }}
              renderItem={({ item }) => (
                <TeachingCourse item={item} numColumns={numColumns} />
              )}
            />
          </View>
        </SectionView.Ready>
      </SectionView>
    </Screen>
  );
};

const TeachingToolbar = ({
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
            <AttachmentImage
              path={item.subjectPhoto}
              fallback={
                <Image
                  source={require("@/assets/placeholder/bg-placeholder.png")}
                  className="rounded-t-xl w-full aspect-video"
                  contentFit="cover"
                />
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
      <ScreenScrollView>
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
                    </View>
                  </Card.Body>
                </Card>
              </View>
            ))}
        </View>
      </ScreenScrollView>
    </View>
  );
};

export default TeachingScreen;
