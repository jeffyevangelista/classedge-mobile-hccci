import {
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTeachingCourses } from "@/features/teaching/teaching.hooks";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { SectionView } from "@/features/sync/components/SectionView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import SyncCenter from "@/features/sync/components/SyncCenter";
import { AppText } from "@/components/AppText";
import { FlashList } from "@shopify/flash-list";
import {
  Card,
  InputGroup,
  Skeleton,
  useThemeColor,
} from "heroui-native";
import { Link, useNavigation } from "expo-router";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import Image from "@/components/Image";
import { Icon } from "@/components/Icon";

import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { Subject } from "@/powersync/schema";
import { getApiErrorMessage } from "@/lib/api-error";

const MIN_CARD_WIDTH = 280;

type TeachingCourseListProps = {
  query?: ReturnType<typeof useTeachingCourses>;
};

const TeachingCourseList = ({ query }: TeachingCourseListProps = {}) => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const fallbackQuery = useTeachingCourses();
  const { isLoading, isError, error, data, refetch, isRefetching } =
    query ?? fallbackQuery;
  const navigation = useNavigation();
  const accentColor = useThemeColor("accent");
  const foregroundColor = useThemeColor("foreground");

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const closeSearch = useCallback(() => {
    setSearch("");
    setSearchOpen(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) setSearch("");
      return !open;
    });
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View className="flex-row items-center gap-1 pr-1">
          <Pressable
            onPress={toggleSearch}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? "Close search" : "Open search"}
            accessibilityState={{ expanded: searchOpen }}
            hitSlop={6}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          >
            <Icon
              name="MagnifyingGlassIcon"
              size={22}
              color={searchOpen ? accentColor : foregroundColor}
            />
          </Pressable>
          <SyncCenter />
        </View>
      ),
    });
  }, [navigation, toggleSearch, searchOpen, accentColor, foregroundColor]);

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
    <SectionView status={status}>
      <SectionView.Loading>
        <TeachingListSkeleton numColumns={numColumns} />
      </SectionView.Loading>
      <SectionView.Empty>
        <View className="w-full max-w-6xl mx-auto flex-1">
          <CollapsibleSearch
            open={searchOpen}
            search={search}
            onSearchChange={setSearch}
            onClose={closeSearch}
          />
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
          <CollapsibleSearch
            open={searchOpen}
            search={search}
            onSearchChange={setSearch}
            onClose={closeSearch}
          />
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
  );
};

const CollapsibleSearch = ({
  open,
  search,
  onSearchChange,
  onClose,
}: {
  open: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
}) => {
  const mutedColor = useThemeColor("muted");
  if (!open) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutUp.duration(140)}
      className="flex-row items-center gap-2 px-2 pt-2 pb-1"
    >
      <InputGroup className="flex-1 shadow-none">
        <InputGroup.Prefix>
          <Icon name="MagnifyingGlassIcon" size={18} color={mutedColor} />
        </InputGroup.Prefix>
        <InputGroup.Input
          autoFocus
          placeholder="Search courses"
          value={search}
          onChangeText={onSearchChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <InputGroup.Suffix>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={search ? "Clear and close search" : "Close search"}
            hitSlop={6}
          >
            <Icon name="XIcon" size={18} color={mutedColor} />
          </Pressable>
        </InputGroup.Suffix>
      </InputGroup>
    </Animated.View>
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

export default TeachingCourseList;
