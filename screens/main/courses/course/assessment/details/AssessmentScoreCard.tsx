import { View } from "react-native";
import { AppText } from "@/components/AppText";

interface Props {
  score: number;
  maxScore: number;
  passingScore: number;
  passingScoreType: string;
}

export const AssessmentScoreCard = ({
  score,
  maxScore,
  passingScore,
  passingScoreType,
}: Props) => {
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed =
    passingScoreType === "percentage"
      ? percent >= passingScore
      : score >= passingScore;

  const chipBgClass = passed
    ? "bg-emerald-100 dark:bg-emerald-900/50"
    : "bg-orange-100 dark:bg-orange-900/50";
  const chipColor = passed ? "#10b981" : "#f97316";

  return (
    <View className="rounded-xl border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between mb-3">
        <AppText weight="semibold" className="text-sm text-muted">
          Your best score
        </AppText>
        <View className={`px-2 py-0.5 rounded-full ${chipBgClass}`}>
          <AppText
            weight="semibold"
            className="text-[10px]"
            style={{ color: chipColor }}
          >
            {passed ? "Passed" : "Did not pass"}
          </AppText>
        </View>
      </View>
      <View className="flex-row items-baseline gap-2">
        <AppText weight="bold" className="text-3xl text-foreground">
          {score}
        </AppText>
        <AppText className="text-base text-muted">/ {maxScore}</AppText>
        <AppText className="ml-auto text-sm text-muted">{percent}%</AppText>
      </View>
    </View>
  );
};
