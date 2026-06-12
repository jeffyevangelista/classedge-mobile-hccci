import { View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import {
  capitalize,
  formatPassingScore,
} from "@/features/assessment/formatters";

interface Props {
  passingScore: number;
  passingScoreType: string;
  maxScore: number;
  retakeMethod: string;
  isGraded: boolean;
  showScore: boolean;
  bestScore: number | null;
}

interface Row {
  key: string;
  icon: IconName;
  label: string;
  value: string;
}

const RowItem = ({ row, isLast }: { row: Row; isLast: boolean }) => {
  const mutedColor = useThemeColor("muted");
  return (
    <View
      accessibilityLabel={`${row.label}: ${row.value}`}
      className={`flex-row items-center justify-between py-3 ${
        isLast ? "" : "border-b border-border"
      }`}
    >
      <View className="flex-row items-center gap-3">
        <Icon name={row.icon} size={18} color={mutedColor} />
        <AppText className="text-sm text-muted">{row.label}</AppText>
      </View>
      <AppText weight="semibold" className="text-sm">
        {row.value}
      </AppText>
    </View>
  );
};

export const AssessmentInfoRows = ({
  passingScore,
  passingScoreType,
  maxScore,
  retakeMethod,
  isGraded,
  showScore,
  bestScore,
}: Props) => {
  const rows: Row[] = [];

  rows.push({
    key: "passing",
    icon: "Target",
    label: "Passing score",
    value: formatPassingScore(passingScore, passingScoreType, maxScore),
  });

  if (bestScore !== null && showScore) {
    rows.push({
      key: "best",
      icon: "Trophy",
      label: "Best score",
      value: `${bestScore} / ${maxScore}`,
    });
  }

  rows.push({
    key: "retake-method",
    icon: "ArrowsClockwise",
    label: "Retake method",
    value: capitalize(retakeMethod),
  });

  rows.push({
    key: "graded",
    icon: "PencilLine",
    label: "Graded",
    value: isGraded ? "Graded" : "Practice",
  });

  rows.push({
    key: "score-visibility",
    icon: "Eye",
    label: "Score visibility",
    value: showScore ? "Shown after submission" : "Hidden",
  });

  return (
    <View className="rounded-xl bg-default border border-border px-4">
      {rows.map((r, idx) => (
        <RowItem key={r.key} row={r} isLast={idx === rows.length - 1} />
      ))}
    </View>
  );
};
