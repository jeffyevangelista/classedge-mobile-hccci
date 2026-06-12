import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { isAnswerCorrect } from "./correctness";
import type { ResultProps } from "./types";

interface Props extends ResultProps {
  typeKey?: string | null;
  isNumeric?: boolean;
}

export const FillInBlankResult = ({
  question,
  studentAnswer,
  isRevealed,
  typeKey,
  isNumeric,
}: Props) => {
  const trimmed = (studentAnswer ?? "").trim();
  const hasAnswer = trimmed.length > 0;
  const correct = isAnswerCorrect(
    typeKey ?? (isNumeric ? "calculated_numeric" : "fill_in_the_blank"),
    question,
    studentAnswer,
  );

  // Card colors:
  //   pre-reveal → accent (showing "this is what you wrote")
  //   correct    → success
  //   wrong/blank → warning
  const yourBoxClass = !isRevealed
    ? "border-2 border-accent bg-accent/10"
    : correct
      ? "border-2 border-success bg-success-soft"
      : "border-2 border-warning bg-warning-soft";

  const yourLabelClass = !isRevealed
    ? "text-accent"
    : correct
      ? "text-success"
      : "text-warning";

  const valueAlign = isNumeric ? "text-right" : "";
  const valueSize = isNumeric ? "text-2xl" : "text-sm";
  const valueWeight = isNumeric ? "bold" : "regular";

  return (
    <View className="gap-2">
      <View className={`rounded-xl p-3 ${yourBoxClass}`}>
        <AppText
          weight="bold"
          className={`text-[10px] uppercase tracking-widest mb-1 ${yourLabelClass}`}
        >
          Your answer
        </AppText>
        {hasAnswer ? (
          <AppText
            weight={valueWeight}
            className={`${valueSize} text-foreground ${valueAlign}`}
            style={isNumeric ? { fontVariant: ["tabular-nums"] } : undefined}
          >
            {studentAnswer}
          </AppText>
        ) : (
          <AppText className="text-sm text-muted italic">
            No answer
          </AppText>
        )}
      </View>

      {isRevealed && correct === false ? (
        <View className="rounded-xl p-3 border-2 border-success bg-success-soft">
          <AppText
            weight="bold"
            className="text-[10px] uppercase tracking-widest mb-1 text-success"
          >
            Correct answer
          </AppText>
          <AppText
            weight={valueWeight}
            className={`${valueSize} text-foreground ${valueAlign}`}
            style={isNumeric ? { fontVariant: ["tabular-nums"] } : undefined}
          >
            {question.correctAnswer}
          </AppText>
        </View>
      ) : null}
    </View>
  );
};
