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
  Filter,
  TimelineItem,
  TimelineRowHighlight,
} from "@/features/timeline/types";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/utils/formatDate";
import { useSubjectTimeline } from "../oversight.hooks";

const SubjectTimeline = () => {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, isError, error } = useSubjectTimeline(
    subjectId ?? "",
  );

  const items = data?.results ?? [];

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
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
      <EmptyState
        icon="FolderOpenIcon"
        title="No content yet"
        description="No materials or activities published yet"
      />
    );
  }

  const visibleBuckets = BUCKET_ORDER.filter(
    ({ key }) => buckets[key].length > 0,
  );

  return (
    <View className="mt-5">
      <TimelineFilterChips
        value={filter}
        onChange={setFilter}
        counts={counts}
      />

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
            <View className="w-full max-w-3xl mx-auto px-3 mb-1">
              <AppText
                weight="semibold"
                className="text-xs uppercase tracking-wider text-muted"
              >
                {label} · {buckets[key].length}
              </AppText>
            </View>
            {buckets[key].map((item) => (
              <TeacherRow
                key={`${item.id}-${item.type}`}
                item={item}
                isToday={key === "today"}
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
};

// Teacher-side row: routes to /lesson or /activity, surfaces only the
// "In class" pill for classroomMode activities, and uses the "today"
// highlight when the bucket is "today". No per-student state.
const TeacherRow = ({
  item,
  isToday,
}: {
  item: TimelineItem;
  isToday: boolean;
}) => {
  const router = useRouter();
  const isAssessment = item.type === "assessment";
  const isClassroomActivity = isAssessment && !!item.classroomMode;
  const formattedDate = formatDate(item.startDate, isAssessment);
  const dateLabel = isAssessment
    ? `Due ${formattedDate}`
    : `Posted ${formattedDate}`;

  const highlightVariant: TimelineRowHighlight | undefined = isToday
    ? "today"
    : undefined;

  const badges = isClassroomActivity ? (
    <View className="px-2 py-0.5 rounded-full bg-accent-soft">
      <AppText weight="semibold" className="text-[10px] text-accent">
        In class
      </AppText>
    </View>
  ) : null;

  const handlePress = () => {
    router.push(isAssessment ? `/activity/${item.id}` : `/lesson/${item.id}`);
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

export default SubjectTimeline;
