import { Link, useNavigation } from "expo-router";
import {
  Avatar,
  Card,
  InputGroup,
  Skeleton,
  useThemeColor,
} from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { AppText } from "@/components/AppText";
import { AvatarFallbackImage } from "@/components/AvatarFallbackImage";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { ScreenList } from "@/components/ScreenList";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { OfflineEmpty } from "@/features/sync/components/OfflineEmpty";
import { SectionView } from "@/features/sync/components/SectionView";
import SyncCenter from "@/features/sync/components/SyncCenter";
import { useSectionStatus } from "@/features/sync/useSectionStatus";
import { getApiErrorMessage } from "@/lib/api-error";
import { toTitleCase } from "@/utils/toTitleCase";
import { useGetSubjects } from "../oversight.hooks";
import type { SubjectType } from "../oversight.type";

const MIN_CARD_WIDTH = 280;

const SubjectsList = () => {
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useGetSubjects();
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

  const status = useSectionStatus({
    data: subjects,
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
        <SubjectsListSkeleton numColumns={numColumns} />
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
            description="You are not enrolled in any courses yet"
          />
        </View>
      </SectionView.Empty>
      <SectionView.OfflineEmpty>
        <OfflineEmpty section="oversight" />
      </SectionView.OfflineEmpty>
      <SectionView.Ready>
        <View className="w-full max-w-6xl mx-auto flex-1">
          <CollapsibleSearch
            open={searchOpen}
            search={search}
            onSearchChange={setSearch}
            onClose={closeSearch}
          />
          <ScreenList
            refreshControl={
              <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
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
            renderItem={({ item }) => (
              <Subject subject={item} numColumns={numColumns} />
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
      className="flex-row items-center gap-2 px-2 pt-2"
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
            accessibilityLabel={
              search ? "Clear and close search" : "Close search"
            }
            hitSlop={6}
          >
            <Icon name="XIcon" size={18} color={mutedColor} />
          </Pressable>
        </InputGroup.Suffix>
      </InputGroup>
    </Animated.View>
  );
};

const SubjectsListSkeleton = ({ numColumns }: { numColumns: number }) => {
  return (
    <View className="w-full max-w-6xl mx-auto flex-1 px-1">
      <ScreenScrollView>
        <View className="px-2 pt-2">
          <Skeleton className="h-10 w-full rounded-xl" />
        </View>
        <View className="flex-row flex-wrap">
          {Array(6)
            .fill(0)
            .map((_, index) => (
              <View
                key={index}
                style={{ width: `${100 / numColumns}%`, padding: 4 }}
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
      </ScreenScrollView>
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
      style={{ flex: 1 / numColumns, padding: 4 }}
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
                <Avatar alt={toTitleCase(subject.assignTeacherName)} size="sm">
                  <Avatar.Image
                    source={
                      subject.teacherPhoto
                        ? { uri: subject.teacherPhoto }
                        : require("@/assets/placeholder/avatar-placeholder.png")
                    }
                  />
                  <AvatarFallbackImage />
                </Avatar>
                <AppText className="text-xs text-gray-500">
                  {toTitleCase(subject.assignTeacherName)}
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
