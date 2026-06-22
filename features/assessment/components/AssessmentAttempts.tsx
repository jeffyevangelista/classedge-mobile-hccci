import type { InferSelectModel } from "drizzle-orm";
import { useRouter } from "expo-router";
import { Skeleton } from "heroui-native";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { ErrorComponent } from "@/components/ErrorComponent";
import { Icon, type IconName } from "@/components/Icon";
import { formatShortDate } from "@/features/assessment/formatters";
import { useCountdown } from "@/hooks/useCountdown";
import { useExpiry } from "@/hooks/useExpiry";
import type { attemptsTable } from "@/powersync/schema";
import { useAttemptRecords } from "../assessment.hooks";
import { submitAttempt } from "../assessment.service";

type AttemptRow = InferSelectModel<typeof attemptsTable>;

type AssessmentAttemptsProps = {
  studentActivityId: string;
  studentId: number;
  maxScore: number;
  showScore: boolean;
  passingScore?: number;
  passingScoreType?: string;
};

type AttemptVisualStatus =
  | "passed"
  | "failed"
  | "in-progress"
  | "completed"
  | "pending";

const judgeAttempt = (
  item: AttemptRow,
  maxScore: number,
  showScore: boolean,
  passingScore?: number,
  passingScoreType?: string,
): AttemptVisualStatus => {
  if (item.status === "ongoing") return "in-progress";
  // Submitted but the server hasn't graded yet — don't judge pass/fail
  // against a stale 0 score; surface a neutral "pending" state instead.
  if (!item.gradedAt) return "pending";
  // Without `showScore` we don't reveal pass/fail — render as neutral
  // "completed" so the row doesn't accidentally surface a score the student
  // shouldn't see yet.
  if (!showScore || passingScore === undefined) return "completed";
  const score = item.score ?? 0;
  const passed =
    passingScoreType === "percentage"
      ? maxScore > 0 && (score / maxScore) * 100 >= passingScore
      : score >= passingScore;
  return passed ? "passed" : "failed";
};

const statusLabel = (status: AttemptRow["status"]): string => {
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

const ICON_BY_STATUS: Record<AttemptVisualStatus, IconName> = {
  passed: "CheckCircleIcon",
  failed: "WarningCircleIcon",
  "in-progress": "ClockIcon",
  completed: "CheckCircleIcon",
  pending: "ClockIcon",
};

const ACCENT_STRIP_CLASS: Record<AttemptVisualStatus, string> = {
  passed: "border-l-4 border-l-emerald-500",
  failed: "border-l-4 border-l-amber-500",
  "in-progress": "border-l-4 border-l-accent",
  // Neutral "completed" (score hidden / unjudged) — no accent. Adding a
  // gray strip here would dilute the meaning of the colored strips above:
  // a row of identical gray strips trains the eye to ignore color
  // altogether, weakening the green/amber signal where it matters.
  completed: "",
  // Pending matches "completed" (no strip) — the eye should rest on the
  // "Pending" label, not on a coloured edge.
  pending: "",
};

const ICON_BG_CLASS: Record<AttemptVisualStatus, string> = {
  passed: "bg-emerald-100 dark:bg-emerald-900/40",
  failed: "bg-amber-100 dark:bg-amber-900/40",
  "in-progress": "bg-accent-soft",
  completed: "bg-default",
  pending: "bg-default",
};

const ICON_COLOR: Record<AttemptVisualStatus, string> = {
  passed: "#059669",
  failed: "#d97706",
  "in-progress": "#2563eb",
  completed: "#64748b",
  pending: "#64748b",
};

const SCORE_TEXT_CLASS: Record<AttemptVisualStatus, string> = {
  passed: "text-emerald-600 dark:text-emerald-400",
  failed: "text-amber-600 dark:text-amber-500",
  "in-progress": "text-accent",
  completed: "text-foreground",
  pending: "text-muted",
};

const AssessmentAttempts = ({
  studentActivityId,
  studentId,
  maxScore,
  showScore,
  passingScore,
  passingScoreType,
}: AssessmentAttemptsProps) => {
  const { data, isLoading, isError, error } = useAttemptRecords(
    studentActivityId,
    studentId,
  );

  const sorted = useMemo(
    () =>
      data ? [...data].sort((a, b) => b.retakeNumber - a.retakeNumber) : [],
    [data],
  );

  if (isLoading) return <AssessmentAttemptsSkeleton />;
  if (isError)
    return (
      <ErrorComponent message={error?.message ?? "Failed to load attempts"} />
    );

  if (sorted.length === 0) {
    return <AppText className="text-sm text-muted">No attempts yet</AppText>;
  }

  return (
    <View className="gap-2">
      {sorted.map((item) => (
        <AttemptCard
          key={item.localId}
          item={item}
          maxScore={maxScore}
          showScore={showScore}
          passingScore={passingScore}
          passingScoreType={passingScoreType}
        />
      ))}
    </View>
  );
};

const AttemptCard = ({
  item,
  maxScore,
  showScore,
  passingScore,
  passingScoreType,
}: {
  item: AttemptRow;
  maxScore: number;
  showScore: boolean;
  passingScore?: number;
  passingScoreType?: string;
}) => {
  const router = useRouter();
  const isOngoing = item.status === "ongoing";
  const { remaining, formatted } = useCountdown(
    isOngoing ? item.willEndAt : undefined,
  );

  // Auto-finalize on the details screen: when the deadline passes while the
  // student is here (not inside AttemptScreen), submit it ourselves so the
  // row flips to "Completed" without requiring a round-trip.
  useExpiry(isOngoing ? item.willEndAt : undefined, () => {
    submitAttempt(item.localId).catch((err) =>
      console.error("[AttemptCard] auto-finalize failed:", err),
    );
  });

  const status = judgeAttempt(
    item,
    maxScore,
    showScore,
    passingScore,
    passingScoreType,
  );
  const isLate = item.status === "late";

  // When late, the standalone "Late" chip in the title row is the canonical
  // signal — collapse the meta label to plain "Completed" so we don't
  // duplicate "Late submission" alongside the chip.
  const metaLabel = isOngoing
    ? "In progress"
    : isLate
      ? "Completed"
      : statusLabel(item.status);

  const card = (
    <View
      className={`bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3 ${ACCENT_STRIP_CLASS[status]}`}
    >
      <View
        className={`w-10 h-10 rounded-xl items-center justify-center ${ICON_BG_CLASS[status]}`}
      >
        <Icon
          name={ICON_BY_STATUS[status]}
          size={18}
          color={ICON_COLOR[status]}
        />
      </View>

      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-2">
          <AppText
            weight="bold"
            className="text-[15px] text-foreground"
            numberOfLines={1}
          >
            Attempt {item.retakeNumber}
          </AppText>
          {isLate ? (
            <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Icon name="WarningCircleIcon" size={10} color="#d97706" />
              <AppText
                weight="semibold"
                className="text-[10px] text-amber-700 dark:text-amber-400"
              >
                Late
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText className="text-xs text-muted mt-0.5" numberOfLines={1}>
          {metaLabel}
          {item.lastHeartbeatAt
            ? ` · ${formatShortDate(item.lastHeartbeatAt)}`
            : ""}
        </AppText>
      </View>

      <View className="items-end" style={{ minWidth: 72 }}>
        {isOngoing ? (
          <>
            <AppText
              weight="bold"
              className={`text-base ${
                remaining < 60 ? "text-danger" : "text-accent"
              }`}
            >
              {formatted}
            </AppText>
            <AppText className="text-[11px] text-muted mt-0.5">left</AppText>
          </>
        ) : status === "pending" ? (
          <>
            <AppText
              weight="bold"
              className={`text-sm ${SCORE_TEXT_CLASS.pending}`}
            >
              Pending
            </AppText>
            <AppText className="text-[11px] text-muted mt-0.5">Grading</AppText>
          </>
        ) : showScore ? (
          <>
            <AppText
              weight="bold"
              className={`text-base ${SCORE_TEXT_CLASS[status]}`}
            >
              {item.score} / {maxScore}
            </AppText>
            <AppText className="text-[11px] text-muted mt-0.5">
              {maxScore > 0
                ? `${Math.round(((item.score ?? 0) / maxScore) * 100)}%`
                : ""}
            </AppText>
          </>
        ) : (
          <AppText className="text-xs text-muted">
            {formatShortDate(item.lastHeartbeatAt)}
          </AppText>
        )}
      </View>
    </View>
  );

  if (isOngoing) {
    return (
      <Pressable
        onPress={() => router.push(`/attempt/${item.localId}`)}
        accessibilityRole="button"
        accessibilityLabel={`Resume attempt ${item.retakeNumber}, ${formatted} remaining`}
        android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
        className="rounded-2xl overflow-hidden active:opacity-80"
      >
        {card}
      </Pressable>
    );
  }
  // Completed (submitted/late) attempts open the Review screen on tap.
  // Reveal of correct answers is gated server-side via the activity's
  // showScore + endTime — the Review screen handles that logic.
  return (
    <Pressable
      onPress={() => router.push(`/attempt/${item.localId}/review`)}
      accessibilityRole="button"
      accessibilityLabel={`Review attempt ${item.retakeNumber}`}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="rounded-2xl overflow-hidden active:opacity-80"
    >
      {card}
    </Pressable>
  );
};

const AssessmentAttemptsSkeleton = () => {
  return (
    <View className="gap-2">
      {Array(3)
        .fill(0)
        .map((_, index) => (
          <View
            key={index}
            className="bg-surface border border-border rounded-2xl flex-row items-center gap-3 p-3"
          >
            <Skeleton className="w-10 h-10 rounded-xl" />
            <View className="flex-1 gap-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </View>
            <View className="items-end gap-1.5">
              <Skeleton className="h-4 w-16 rounded" />
            </View>
          </View>
        ))}
    </View>
  );
};

export default AssessmentAttempts;
