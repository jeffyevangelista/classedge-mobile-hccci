import { useLocalSearchParams } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import React, { useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/AppText";
import ErrorFallback from "@/components/ErrorFallback";
import { Icon } from "@/components/Icon";
import { LinkCard } from "@/components/LinkCard";
import NoDataFallback from "@/components/NoDataFallback";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import Screen from "@/components/screen";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { RemoteAttachmentFile } from "@/features/attachments/components/RemoteAttachmentFile";
import { useAssessment } from "@/features/oversight/oversight.hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import { AssessmentHeroCard } from "@/screens/main/courses/course/assessment/details/AssessmentHeroCard";
import { CollapsibleDescription } from "@/components/CollapsibleDescription";

// Cap visible materials so a long attachment list doesn't dominate the
// screen; expand-to-see-all matches the AssessmentMaterials behavior.
const DEFAULT_VISIBLE_MATERIALS = 3;

const ActivityScreen = () => {
  const { activityId } = useLocalSearchParams();
  const { width: windowWidth } = useWindowDimensions();
  const { isLoading, isError, error, data, refetch, isRefetching, isFetching } =
    useAssessment(activityId as string);

  // Skeleton during the initial fetch AND during a retry from the
  // error state — see features/classroom/components/LessonList for the
  // full rationale.
  if (isLoading || (isFetching && !data)) return <ActivityScreenSkeleton />;

  if (isError)
    return (
      <ErrorFallback message={getApiErrorMessage(error)} onRefetch={refetch} />
    );

  if (!data)
    return (
      <NoDataFallback
        title="Activity not found"
        description="The activity you're looking for doesn't exist"
        onRefetch={() => refetch()}
      />
    );

  // Phone vs tablet: the hero card has a compact mode that folds the
  // rules into the subtitle, matching the student-side screen.
  const isPhone = windowWidth < 768;

  return (
    <Screen className="max-w-3xl mx-auto w-full">
      <ScreenScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View className="px-3 pt-3 gap-4">
          <AssessmentHeroCard
            activityName={data.activityName}
            endTime={data.endTime}
            // Teacher payload doesn't carry per-student progress data, so
            // we hide the status pill and swap the two student-context
            // stat tiles for configuration metrics (max score, max
            // retakes) that are actually present in the API response.
            questionCount={undefined}
            timeDurationMinutes={data.timeDuration}
            attemptsUsed={undefined}
            maxRetake={data.maxRetake}
            passingScore={data.passingScore}
            passingScoreType={data.passingScoreType}
            maxScore={data.maxScore}
            retakeMethod={data.retakeMethod}
            classroomMode={!!data.classroomMode}
            isInProgress={false}
            compact={isPhone}
            hideStatusPill
            // Suppress the rules line — "Highest of 5 attempts" would
            // double up with the Max retakes stat tile below.
            hideRules
            primaryStat={{
              icon: "TrophyIcon",
              value: String(data.maxScore),
              label: data.maxScore === 1 ? "Max point" : "Max points",
            }}
            trailingStat={{
              icon: "ArrowsClockwiseIcon",
              value: String(data.maxRetake),
              label: data.maxRetake === 1 ? "Max retake" : "Max retakes",
            }}
          />

          <ActivityInstructionsSection
            text={data.activityInstruction}
            filePath={data.activityFileInstruction ?? undefined}
          />

          <ActivityMaterialsSection lessonUrls={data.lessonUrls} />
        </View>
      </ScreenScrollView>
    </Screen>
  );
};

const getFilenameFromUrl = (path: string): string => {
  const cleaned = path.split("?")[0].split("#")[0];
  const last = cleaned.split("/").pop() ?? "attachment";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

// Teacher-side instructions block — mirrors the student-side
// AssessmentInstructions layout (uppercase section label +
// collapsible description + attached file) but routes the attached
// file through `RemoteAttachmentFile` because the teacher payload
// surfaces it as a raw REST URL, not a PowerSync attachment path.
const ActivityInstructionsSection = ({
  text,
  filePath,
}: {
  text: string | undefined;
  filePath: string | undefined;
}) => {
  const trimmedText = text?.trim() ?? "";
  const hasText = trimmedText.length > 0;
  const cleanedFilePath = filePath?.trim() ?? "";
  const hasFile = cleanedFilePath.length > 0;

  if (!hasText && !hasFile) return null;

  return (
    <View>
      <AppText
        weight="semibold"
        className="text-xs uppercase tracking-wider text-muted mb-2"
      >
        Instructions
      </AppText>
      <View className="gap-3">
        {hasText ? (
          <CollapsibleDescription
            text={trimmedText}
            textClassName="text-sm leading-relaxed"
            noun="instructions"
          />
        ) : null}
        {hasFile ? (
          <RemoteAttachmentFile
            url={cleanedFilePath}
            fileName={getFilenameFromUrl(cleanedFilePath)}
          />
        ) : null}
      </View>
    </View>
  );
};

interface ActivityMaterial {
  id: number;
  lessonName?: string;
  lessonUrl: string | null;
  lessonFile: string | null;
}

const ActivityMaterialsSection = ({
  lessonUrls,
}: {
  lessonUrls: ActivityMaterial[];
}) => {
  const accentColor = useThemeColor("accent");
  const [expanded, setExpanded] = useState(false);
  const total = lessonUrls?.length ?? 0;
  if (total === 0) return null;

  const canCollapse = total > DEFAULT_VISIBLE_MATERIALS;
  const visible =
    expanded || !canCollapse ? lessonUrls : lessonUrls.slice(0, DEFAULT_VISIBLE_MATERIALS);
  const hiddenCount = total - DEFAULT_VISIBLE_MATERIALS;

  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <AppText
          weight="semibold"
          className="text-xs uppercase tracking-wider text-muted"
        >
          Materials
        </AppText>
        {canCollapse ? (
          <AppText className="text-xs text-muted">{total} total</AppText>
        ) : null}
      </View>

      <View className="gap-2">
        {visible.map((m) => (
          <ActivityMaterialTile key={m.id} material={m} />
        ))}
      </View>

      {canCollapse ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Show fewer materials" : `Show all ${total} materials`
          }
          hitSlop={6}
          className="mt-2 self-start active:opacity-70"
        >
          <View className="flex-row items-center gap-1">
            <AppText weight="semibold" className="text-sm text-accent">
              {expanded ? "Show less" : `Show all ${total} (+${hiddenCount})`}
            </AppText>
            <Icon
              name={expanded ? "CaretUpIcon" : "CaretDownIcon"}
              size={14}
              color={accentColor}
            />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
};

const ActivityMaterialTile = ({ material }: { material: ActivityMaterial }) => {
  if (material.lessonFile) {
    const fileName =
      material.lessonName ||
      material.lessonFile.split("/").pop() ||
      "File";
    return (
      <RemoteAttachmentFile url={material.lessonFile} fileName={fileName} />
    );
  }
  if (material.lessonUrl) {
    return <LinkCard url={material.lessonUrl} label={material.lessonName} />;
  }
  return null;
};

const ActivityScreenSkeleton = () => (
  <Screen className="max-w-3xl mx-auto w-full">
    <View className="px-3 pt-3 gap-4">
      {/* Hero card */}
      <Skeleton className="h-44 w-full rounded-2xl" />
      {/* Instructions block */}
      <View className="gap-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-2/3 rounded-full" />
      </View>
      {/* Materials block */}
      <View className="gap-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </View>
    </View>
  </Screen>
);

export default ActivityScreen;
