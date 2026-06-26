import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import EmptyState from "@/components/EmptyState";
import ErrorFallback from "@/components/ErrorFallback";
import { BUCKET_ORDER, bucketize } from "@/features/timeline/bucketize";
import { TimelineFilterChips } from "@/features/timeline/components/TimelineFilterChips";
import { TimelineRow } from "@/features/timeline/components/TimelineRow";
import { TimelineSkeleton } from "@/features/timeline/components/TimelineSkeleton";
import type {
  BucketKey,
  Filter,
  TimelineItem,
  TimelineRowHighlight,
} from "@/features/timeline/types";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/utils/formatDate";
import { useCourseTimeline } from "../courses.hooks";

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

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: items.length,
      assessment: items.filter((i) => i.type === "assessment").length,
      material: items.filter((i) => i.type === "material").length,
    }),
    [items],
  );

  if (isLoading) return <TimelineSkeleton />;
  if (isError) return <ErrorFallback message={getApiErrorMessage(error)} />;

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <EmptyState
          icon="FolderOpenIcon"
          title="No content yet"
          description="No content found for this course"
        />
      </View>
    );
  }

  const visibleBuckets = BUCKET_ORDER.filter(
    ({ key }) => buckets[key].length > 0,
  );

  if (visibleBuckets.length === 0) {
    return (
      <View className="flex-1 mt-5">
        <TimelineFilterChips
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
        <View className="flex-1 items-center justify-center">
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
      </View>
    );
  }

  return (
    <View className="mt-5">
      <TimelineFilterChips
        value={filter}
        onChange={setFilter}
        counts={counts}
      />

      {visibleBuckets.map(({ key, label }) => (
        <View key={key} className="mb-4">
          <View className="w-full max-w-3xl mx-auto px-3 mb-1">
            <AppText
              weight="semibold"
              className="text-xs uppercase tracking-wider text-muted"
            >
              {label} · {buckets[key].length}
            </AppText>
          </View>
          {buckets[key].map((item) => (
            <StudentRow
              key={`${item.id}-${item.type}`}
              item={item}
              bucket={key}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

// Student-side row: composes the shared TimelineRow with submission-state
// badges, "due-soon" / "today" / "overdue" highlight rules, and the
// student routes (/material, /assessment).
const StudentRow = ({
  item,
  bucket,
}: {
  item: TimelineItem;
  bucket: BucketKey;
}) => {
  const router = useRouter();
  const isAssessment = item.type === "assessment";
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

  const dueSoon =
    bucket === "upcoming" &&
    isAssessment &&
    !item.hasSubmission &&
    !isClassroomActivity &&
    dayjs(item.startDate).diff(dayjs(), "day") <= 3;

  let highlightVariant: TimelineRowHighlight | undefined;
  if (isOverdue) highlightVariant = "overdue";
  else if (bucket === "today" || dueSoon) highlightVariant = "today";

  const badges = isClassroomActivity ? (
    <View className="px-2 py-0.5 rounded-full bg-accent-soft">
      <AppText weight="semibold" className="text-[10px] text-accent">
        {item.hasSubmission && item.showScore
          ? `In class · ${item.totalScore}/${item.maxScore}`
          : "In class"}
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
  ) : null;

  const handlePress = () => {
    router.push(
      isAssessment ? `/assessment/${item.id}` : `/material/${item.id}`,
    );
  };

  return (
    <TimelineRow
      item={item}
      onPress={handlePress}
      dateLabel={dateLabel}
      highlightVariant={highlightVariant}
      badges={badges}
    />
  );
};

export default CourseTimeline;
