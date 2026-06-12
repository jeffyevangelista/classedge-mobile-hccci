import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import {
  capitalize,
  formatDueDate,
  formatDuration,
} from "@/features/assessment/formatters";

interface Props {
  activityName: string;
  endTime: string;
  questionCount: number | undefined;
  timeDurationMinutes: number;
  attemptsUsed: number | undefined;
  maxRetake: number;
  passingScore: number;
  passingScoreType: string;
  maxScore: number;
  retakeMethod: string;
  classroomMode?: boolean;
  isInProgress?: boolean;
  /**
   * Compact variant: folds the rules (passing + retake) into the subtitle
   * line and drops the standalone meta row at the bottom. Use on phone
   * widths where the tabs below need the vertical space; the inline tablet
   * layout leaves this off for a more expansive hero.
   */
  compact?: boolean;
  /**
   * Suppress the top-right status pill ("Due in 3 days" / "Overdue" /
   * etc.). Used by teacher-facing surfaces that show the activity's
   * configuration rather than the student's progress against it.
   */
  hideStatusPill?: boolean;
  /**
   * Override the first stat tile (default: Questions / questionCount).
   * Use when the consumer doesn't have a question count but wants to
   * surface a different configuration metric in its place.
   */
  primaryStat?: { icon?: IconName; value: string; label: string };
  /**
   * Override the third stat tile (default: Remaining / attempts left).
   * Use when the consumer doesn't have a per-student attempts figure
   * but wants to surface a different metric in its place.
   */
  trailingStat?: { icon?: IconName; value: string; label: string };
  /**
   * Drop the rules line (`Passing X · Method of N attempts`) from
   * both the compact subtitle and the non-compact bottom footer. Use
   * when those values are already represented by overridden stat
   * tiles to avoid surfacing the retake count twice.
   */
  hideRules?: boolean;
}

type HeroStatus =
  | { kind: "upcoming"; daysLeft: number }
  | { kind: "due-soon"; daysLeft: number }
  | { kind: "due-today" }
  | { kind: "overdue" }
  | { kind: "in-progress" }
  | { kind: "completed" }
  | { kind: "in-class" };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const computeStatus = (
  endTime: string,
  attemptsUsed: number | undefined,
  maxRetake: number,
  classroomMode: boolean,
  isInProgress: boolean,
): HeroStatus => {
  if (classroomMode) return { kind: "in-class" };
  if (isInProgress) return { kind: "in-progress" };
  if (attemptsUsed !== undefined && attemptsUsed >= maxRetake) {
    return { kind: "completed" };
  }
  const now = Date.now();
  const due = new Date(endTime).getTime();
  if (now > due) return { kind: "overdue" };
  const daysLeft = Math.ceil((due - now) / MS_PER_DAY);
  if (daysLeft <= 0) return { kind: "due-today" };
  if (daysLeft <= 2) return { kind: "due-soon", daysLeft };
  return { kind: "upcoming", daysLeft };
};

const statusText = (s: HeroStatus): string => {
  switch (s.kind) {
    case "in-class":
      return "In-class";
    case "in-progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "overdue":
      return "Overdue";
    case "due-today":
      return "Due today";
    case "due-soon":
      return s.daysLeft === 1 ? "Due tomorrow" : `Due in ${s.daysLeft} days`;
    case "upcoming":
      return `Due in ${s.daysLeft} days`;
  }
};

const isStatusUrgent = (s: HeroStatus): boolean =>
  s.kind === "in-progress" ||
  s.kind === "overdue" ||
  s.kind === "due-today" ||
  (s.kind === "due-soon" && s.daysLeft <= 1);

const StatTile = ({
  icon,
  value,
  label,
  compact,
}: {
  icon: IconName;
  value: string;
  label: string;
  compact?: boolean;
}) => (
  <View
    className={`flex-1 rounded-xl bg-white/15 border border-white/20 ${
      compact ? "p-2.5" : "p-3"
    }`}
  >
    {compact ? null : (
      <Icon name={icon} size={16} color="rgba(255,255,255,0.85)" />
    )}
    <AppText
      weight="bold"
      className={`text-xl text-accent-foreground ${compact ? "" : "mt-2"}`}
      numberOfLines={1}
    >
      {value}
    </AppText>
    <AppText className="text-[10px] tracking-widest uppercase text-accent-foreground/75 mt-1">
      {label}
    </AppText>
  </View>
);

export const AssessmentHeroCard = ({
  activityName,
  endTime,
  questionCount,
  timeDurationMinutes,
  attemptsUsed,
  maxRetake,
  passingScore,
  passingScoreType,
  maxScore,
  retakeMethod,
  classroomMode = false,
  isInProgress = false,
  compact = false,
  hideStatusPill = false,
  primaryStat,
  trailingStat,
  hideRules = false,
}: Props) => {
  const questionsStat =
    questionCount === undefined ? "—" : String(questionCount);
  const timeStat = formatDuration(timeDurationMinutes);
  const attemptsLeftStat =
    attemptsUsed === undefined
      ? "—"
      : String(Math.max(0, maxRetake - attemptsUsed));

  // Rules meta line — replaces the standalone Details section. We format
  // passing inline rather than via formatPassingScore so we can match the
  // canonical "percentage" value (the shared helper still checks the older
  // "percent" string).
  const passingFmt =
    passingScoreType === "percentage"
      ? `${passingScore}%`
      : `${passingScore} / ${maxScore}`;
  const retakeFmt = `${capitalize(retakeMethod)} of ${maxRetake} attempts`;

  const status = computeStatus(
    endTime,
    attemptsUsed,
    maxRetake,
    classroomMode,
    isInProgress,
  );
  const showLiveDot = isStatusUrgent(status);

  const [heroSize, setHeroSize] = useState({ width: 0, height: 0 });

  return (
    <LinearGradient
      colors={["#2563eb", "#1e40af", "#1e3a8a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 16,
        padding: compact ? 12 : 20,
        overflow: "hidden",
      }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== heroSize.width || height !== heroSize.height) {
          setHeroSize({ width, height });
        }
      }}
    >
      {/* Decorative SVG: soft radial glows + hand-placed dot grid anchored
          to the right edge. Uses measured pixel dimensions (heroSize) so
          percentage interpretation in react-native-svg can't cause the
          rightmost dot column to fall short of the right edge.
          pointerEvents="none" so taps pass through to children. */}
      {heroSize.width > 0 && (
        <Svg
          width={heroSize.width}
          height={heroSize.height}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id="heroGlowTR" cx="100%" cy="0%" rx="60%" ry="60%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="heroGlowBL" cx="0%" cy="100%" rx="55%" ry="55%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect
            width={heroSize.width}
            height={heroSize.height}
            fill="url(#heroGlowBL)"
          />
          <Rect
            width={heroSize.width}
            height={heroSize.height}
            fill="url(#heroGlowTR)"
          />
          {Array.from({ length: 4 }).flatMap((_, row) =>
            Array.from({ length: 7 }).map((__, col) => {
              // Rightmost column at heroSize.width — dot center on the right
              // edge, half the dot clipped beyond. Top row dots also clipped
              // by the LinearGradient's 16px borderRadius — intentional.
              const cx = heroSize.width - col * 14;
              const cy = 12 + row * 12;
              return (
                <Circle
                  key={`dot-${row}-${col}`}
                  cx={cx}
                  cy={cy}
                  r={1.5}
                  fill="#ffffff"
                  opacity={0.16}
                />
              );
            }),
          )}
        </Svg>
      )}

      {(() => {
        const pill = hideStatusPill ? null : (
          <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 border border-white/25">
            {showLiveDot ? (
              <View className="w-1.5 h-1.5 rounded-full bg-white" />
            ) : null}
            <AppText
              weight="semibold"
              className="text-[11px] text-white"
              // Tight lineHeight collapses the text box to the glyph, so
              // `items-center` aligns the dot to the optical center of
              // the label instead of the inflated box center.
              style={{ lineHeight: 13 }}
            >
              {statusText(status)}
            </AppText>
          </View>
        );
        // Compact: drop the QUIZ label row entirely; put the status pill
        // in the same row as the title (right-aligned) so the title is
        // the first thing the student sees. Saves ~28pt of vertical space.
        // Non-compact: keep the original QUIZ + pill header row above the
        // title.
        if (compact) {
          return (
            <View className="flex-row items-start justify-between gap-3">
              <AppText
                weight="bold"
                className="flex-1 text-xl text-accent-foreground leading-tight"
                numberOfLines={2}
              >
                {activityName}
              </AppText>
              {pill}
            </View>
          );
        }
        return (
          <>
            <View className="flex-row items-center justify-between mb-3">
              <AppText
                weight="semibold"
                className="text-[11px] tracking-widest uppercase text-accent-foreground/85"
              >
                Quiz
              </AppText>
              {pill}
            </View>
            <AppText
              weight="bold"
              className="text-2xl text-accent-foreground leading-tight"
              numberOfLines={2}
            >
              {activityName}
            </AppText>
          </>
        );
      })()}

      <AppText
        className={`text-xs text-accent-foreground/75 ${
          compact ? "mt-1 mb-3" : "mt-1.5 mb-4"
        }`}
      >
        Due {formatDueDate(endTime)}
        {compact && !hideRules ? ` · Passing ${passingFmt} · ${retakeFmt}` : ""}
      </AppText>

      <View className={`flex-row ${compact ? "gap-1.5" : "gap-2"}`}>
        <StatTile
          icon={primaryStat?.icon ?? "ClipboardTextIcon"}
          value={primaryStat?.value ?? questionsStat}
          label={primaryStat?.label ?? "Questions"}
          compact={compact}
        />
        <StatTile
          icon="ClockIcon"
          value={timeStat}
          label="Duration"
          compact={compact}
        />
        <StatTile
          icon={trailingStat?.icon ?? "ArrowsClockwiseIcon"}
          value={trailingStat?.value ?? attemptsLeftStat}
          label={trailingStat?.label ?? "Remaining"}
          compact={compact}
        />
      </View>

      {compact || hideRules ? null : (
        <View className="mt-4 pt-3 border-t border-white/15 flex-row items-center gap-2">
          <Icon name="TargetIcon" size={12} color="rgba(255,255,255,0.85)" />
          <AppText
            weight="semibold"
            className="text-[11px] text-accent-foreground/85"
          >
            Passing {passingFmt} · {retakeFmt}
          </AppText>
        </View>
      )}
    </LinearGradient>
  );
};
