import { Pressable, View } from "react-native";
import { useMemo } from "react";
import { useRouter } from "expo-router";
import { AppText } from "@/components/AppText";
import { useAttemptRecords } from "../assessment.hooks";
import { submitAttempt } from "../assessment.service";
import { Skeleton, Surface } from "heroui-native";
import { ErrorComponent } from "@/components/ErrorComponent";
import { formatShortDate } from "@/features/assessment/formatters";
import { useCountdown } from "@/hooks/useCountdown";
import { useExpiry } from "@/hooks/useExpiry";
import type { InferSelectModel } from "drizzle-orm";
import { attemptsTable } from "@/powersync/schema";

type AttemptRow = InferSelectModel<typeof attemptsTable>;

type AssessmentAttemptsProps = {
  studentActivityId: string;
  studentId: number;
  maxScore: number;
  showScore: boolean;
};

const AssessmentAttempts = ({
  studentActivityId,
  studentId,
  maxScore,
  showScore,
}: AssessmentAttemptsProps) => {
  const { data, isLoading, isError, error } = useAttemptRecords(
    studentActivityId,
    studentId,
  );

  const sorted = useMemo(
    () =>
      data
        ? [...data].sort((a, b) => b.retakeNumber - a.retakeNumber)
        : [],
    [data],
  );

  if (isLoading) return <AssessmentAttemptsSkeleton />;
  if (isError)
    return (
      <ErrorComponent message={error?.message ?? "Failed to load attempts"} />
    );

  if (sorted.length === 0) {
    return (
      <AppText className="text-sm text-muted">No attempts yet</AppText>
    );
  }

  return (
    <View className="gap-1.5">
      {sorted.map((item) => (
        <AttemptCard
          key={item.localId}
          item={item}
          maxScore={maxScore}
          showScore={showScore}
        />
      ))}
    </View>
  );
};

const statusText = (status: string): string => {
  switch (status) {
    case "ongoing":
      return "In progress";
    case "submitted":
      return "Completed";
    case "late":
      return "Late submission";
    default:
      return status.length > 0
        ? status.charAt(0).toUpperCase() + status.slice(1)
        : status;
  }
};

const AttemptCard = ({
  item,
  maxScore,
  showScore,
}: {
  item: AttemptRow;
  maxScore: number;
  showScore: boolean;
}) => {
  const router = useRouter();
  const isOngoing = item.status === "ongoing";
  const { remaining, formatted } = useCountdown(
    isOngoing ? item.willEndAt : undefined,
  );

  // Auto-finalize on the details screen: when the deadline passes while the
  // student is here (not inside AttemptScreen), submit it ourselves so the row
  // flips to "Completed" without requiring a round-trip.
  useExpiry(isOngoing ? item.willEndAt : undefined, () => {
    submitAttempt(item.localId).catch((err) =>
      console.error("[AttemptCard] auto-finalize failed:", err),
    );
  });

  const rightSide = isOngoing ? (
    <AppText
      weight="semibold"
      className={`text-sm ${remaining < 60 ? "text-danger" : "text-accent"}`}
    >
      {formatted} left
    </AppText>
  ) : showScore ? (
    <AppText weight="semibold" className="text-sm text-foreground">
      {item.score} / {maxScore}
    </AppText>
  ) : (
    <AppText className="text-sm text-muted">
      {formatShortDate(item.lastHeartbeatAt)}
    </AppText>
  );

  const card = (
    <Surface
      variant={isOngoing ? "default" : "tertiary"}
      className={`rounded-xl shadow-none flex-row items-center justify-between px-3 py-3 ${
        isOngoing ? "border-l-4 border-l-accent" : ""
      }`}
    >
      <AppText weight="semibold" className="text-sm">
        Attempt {item.retakeNumber} · {statusText(item.status)}
      </AppText>
      {rightSide}
    </Surface>
  );

  if (isOngoing) {
    return (
      <Pressable
        onPress={() => router.push(`/attempt/${item.localId}`)}
        accessibilityRole="button"
        accessibilityLabel={`Resume attempt ${item.retakeNumber}`}
      >
        {card}
      </Pressable>
    );
  }
  return card;
};

const AssessmentAttemptsSkeleton = () => {
  return (
    <View className="gap-1.5">
      {Array(3)
        .fill(0)
        .map((_, index) => (
          <Surface
            key={index}
            variant="tertiary"
            className="rounded-xl shadow-none flex-row items-center justify-between px-3 py-3"
          >
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </Surface>
        ))}
    </View>
  );
};

export default AssessmentAttempts;
