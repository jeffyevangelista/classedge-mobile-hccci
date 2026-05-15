import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { formatDueDate, formatDuration } from "@/features/assessment/formatters";

interface Props {
  activityName: string;
  endTime: string;
  questionCount: number | undefined;
  timeDurationMinutes: number;
  attemptsUsed: number | undefined;
  maxRetake: number;
}

const Stat = ({ value, label }: { value: string; label: string }) => (
  <View className="flex-1">
    <AppText weight="bold" className="text-xl text-accent-foreground">
      {value}
    </AppText>
    <AppText className="text-[10px] tracking-widest uppercase text-accent-foreground/80 mt-1">
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
}: Props) => {
  const questionsStat = questionCount === undefined ? "—" : String(questionCount);
  const timeStat = formatDuration(timeDurationMinutes);
  const attemptsLeftStat =
    attemptsUsed === undefined
      ? "—"
      : String(Math.max(0, maxRetake - attemptsUsed));

  return (
    <View className="rounded-xl bg-accent p-4">
      <AppText className="text-[10px] tracking-widest uppercase text-accent-foreground/80">
        Quiz · Due {formatDueDate(endTime)}
      </AppText>
      <AppText
        weight="bold"
        className="text-lg text-accent-foreground mt-1"
        numberOfLines={2}
      >
        {activityName}
      </AppText>
      <View className="flex-row gap-3 mt-4">
        <Stat value={questionsStat} label="Questions" />
        <Stat value={timeStat} label="Time" />
        <Stat value={attemptsLeftStat} label="Attempts left" />
      </View>
    </View>
  );
};
