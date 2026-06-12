import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";
import { AppText } from "@/components/AppText";
import { useCourseTimeline } from "../courses.hooks";
import { Card, Skeleton, useThemeColor } from "heroui-native";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/utils/formatDate";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { getApiErrorMessage } from "@/lib/api-error";

type TimelineItem = {
  id: string;
  fileName: string;
  startDate: string;
  type: "material" | "assessment";
  hasSubmission: number;
  showScore: number;
  maxScore: number;
  totalScore: number;
  classroomMode: number;
};

type Filter = "all" | "assessment" | "material";

type BucketKey = "upcoming" | "today" | "thisWeek" | "earlier";

const BUCKET_ORDER: { key: BucketKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This Week" },
  { key: "earlier", label: "Earlier" },
];

const bucketize = (items: TimelineItem[]) => {
  const today = dayjs().startOf("day");
  const weekCutoff = today.subtract(6, "day");
  const buckets: Record<BucketKey, TimelineItem[]> = {
    upcoming: [],
    today: [],
    thisWeek: [],
    earlier: [],
  };
  for (const item of items) {
    const d = dayjs(item.startDate).startOf("day");
    if (d.isAfter(today)) buckets.upcoming.push(item);
    else if (d.isSame(today)) buckets.today.push(item);
    else if (!d.isBefore(weekCutoff)) buckets.thisWeek.push(item);
    else buckets.earlier.push(item);
  }
  // Sort each bucket — upcoming ascending (soonest first), the rest descending
  // (most recent first).
  buckets.upcoming.sort(
    (a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  for (const k of ["today", "thisWeek", "earlier"] as const) {
    buckets[k].sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );
  }
  return buckets;
};

const CourseTimeline = () => {
  const { courseId } = useLocalSearchParams();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, isError, error } = useCourseTimeline(
    courseId as string,
  );

  const items = (data as TimelineItem[] | undefined) ?? [];

  const filtered = useMemo(
    () =>
      filter === "all" ? items : items.filter((item) => item.type === filter),
    [items, filter],
  );

  const buckets = useMemo(() => bucketize(filtered), [filtered]);

  const counts = useMemo(
    () => ({
      all: items.length,
      assessment: items.filter((i) => i.type === "assessment").length,
      material: items.filter((i) => i.type === "material").length,
    }),
    [items],
  );

  if (isLoading) return <CourseTimelineSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="FolderOpenIcon"
        title="No content yet"
        description="No content found for this course"
      />
    );
  }

  const visibleBuckets = BUCKET_ORDER.filter(
    ({ key }) => buckets[key].length > 0,
  );

  return (
    <View className="mt-5">
      <FilterChips value={filter} onChange={setFilter} counts={counts} />

      {visibleBuckets.length === 0 ? (
        <View className="items-center">
          <EmptyState
            icon="FolderOpenIcon"
            title="No matching content"
            description="Try a different filter"
          />
          <Pressable
            onPress={() => setFilter("all")}
            accessibilityRole="button"
            accessibilityLabel="Show all items"
            className="mt-2 px-4 py-2 rounded-full bg-accent-soft active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-accent">
              Show all
            </AppText>
          </Pressable>
        </View>
      ) : (
        visibleBuckets.map(({ key, label }) => (
          <View key={key} className="mb-4">
            <View className="w-full max-w-3xl mx-auto px-3 mb-2">
              <AppText
                weight="semibold"
                className="text-xs uppercase tracking-wider text-muted"
              >
                {label} · {buckets[key].length}
              </AppText>
            </View>
            {buckets[key].map((item) => (
              <ListItem
                key={`${item.id}-${item.type}`}
                item={item}
                bucket={key}
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
};

const FilterChips = ({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (next: Filter) => void;
  counts: Record<Filter, number>;
}) => {
  const options: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "assessment", label: "Assessments" },
    { key: "material", label: "Materials" },
  ];
  return (
    <View className="w-full max-w-3xl mx-auto px-2 mb-3 flex-row gap-2">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${opt.label}, ${counts[opt.key]} items`}
            accessibilityState={{ selected: active }}
            android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
            className={`px-3 py-1.5 rounded-full active:opacity-80 ${
              active
                ? "bg-accent"
                : "bg-surface-secondary border border-border"
            }`}
          >
            <AppText
              weight="semibold"
              className={`text-xs ${
                active ? "text-accent-foreground" : "text-foreground"
              }`}
            >
              {opt.label} · {counts[opt.key]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
};

const ListItem = ({
  item,
  bucket,
}: {
  item: TimelineItem;
  bucket: BucketKey;
}) => {
  const router = useRouter();
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");
  const isAssessment = item.type === "assessment";
  // Show the time alongside the date for assessments so students know
  // the exact cutoff (the timeline maps activity.end_time → startDate).
  // Materials use the date alone — no cutoff applies.
  const formattedDate = formatDate(item.startDate, isAssessment);
  const dateLabel = isAssessment
    ? `Due ${formattedDate}`
    : `Posted ${formattedDate}`;
  const isClassroomActivity = isAssessment && !!item.classroomMode;
  const isOverdue =
    isAssessment &&
    !isClassroomActivity &&
    !item.hasSubmission &&
    new Date(item.startDate).getTime() < Date.now();

  const iconName = isAssessment ? "PencilLineIcon" : "BookOpenTextIcon";
  const iconColor = isAssessment ? accentColor : mutedColor;
  const iconBgClass = isAssessment ? "bg-accent-soft" : "bg-surface-secondary";

  // Highlight items in the Today bucket plus upcoming assessments due within
  // three days. Overdue items keep their own treatment.
  const dueSoon =
    bucket === "upcoming" &&
    isAssessment &&
    !item.hasSubmission &&
    !isClassroomActivity &&
    dayjs(item.startDate).diff(dayjs(), "day") <= 3;
  const highlight = (bucket === "today" || dueSoon) && !isOverdue;
  const borderClass = highlight ? "border-accent" : "border-border";

  const accessibilityLabel = `Open ${
    isAssessment ? "assessment" : "material"
  }: ${item.fileName}${isOverdue ? " (overdue)" : ""}`;

  const handlePress = () => {
    router.push(
      isAssessment ? `/assessment/${item.id}` : `/material/${item.id}`,
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="w-full max-w-3xl mx-auto active:opacity-80 rounded-xl overflow-hidden mb-2"
    >
      <Card
        className={`rounded-xl flex-row items-center gap-3 shadow-none border ${borderClass}`}
      >
        <View className={`p-2 rounded-full ${iconBgClass}`}>
          <Icon name={iconName} size={24} color={iconColor} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.fileName}
          </AppText>
          <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
            <AppText className="text-xs text-muted">{dateLabel}</AppText>
            {isClassroomActivity ? (
              <View className="px-2 py-0.5 rounded-full bg-accent-soft">
                <AppText
                  weight="semibold"
                  className="text-[10px] text-accent"
                >
                  In class
                </AppText>
              </View>
            ) : item.hasSubmission ? (
              <View className="px-2 py-0.5 rounded-full bg-accent-soft">
                <AppText weight="semibold" className="text-[10px] text-accent">
                  {item.showScore
                    ? `Submitted · ${item.totalScore}/${item.maxScore}`
                    : "Submitted"}
                </AppText>
              </View>
            ) : isOverdue ? (
              <View className="px-2 py-0.5 rounded-full bg-danger-soft">
                <AppText weight="semibold" className="text-[10px] text-danger">
                  Overdue
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
};

const CourseTimelineSkeleton = () => {
  return (
    <View className="mt-5">
      <View className="w-full max-w-3xl mx-auto px-2 mb-3 flex-row gap-2">
        <Skeleton className="h-7 w-12 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </View>
      <View className="w-full max-w-3xl mx-auto px-3 mb-2">
        <Skeleton className="h-3 w-20 rounded" />
      </View>
      {Array(5)
        .fill(0)
        .map((_, index) => (
          <View key={index} className="w-full max-w-3xl mx-auto">
            <Card className="rounded-xl flex-row items-center gap-3 shadow-none border border-border mb-2">
              <Skeleton className="w-10 h-10 rounded-full" />
              <View className="flex-1 gap-1.5">
                <Skeleton className="h-5 w-3/4 rounded" />
                <View className="flex-row items-center gap-1.5">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </View>
              </View>
            </Card>
          </View>
        ))}
    </View>
  );
};

export default CourseTimeline;
