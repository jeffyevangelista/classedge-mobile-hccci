import { View } from "react-native";
import { AppText } from "@/components/AppText";
import type { ResultProps } from "./types";

/**
 * Essay/text answers are manually graded. We surface the student's text in
 * a neutral card and let the parent QuestionResultCard render the
 * "Manually graded" pill in the header row.
 */
export const EssayResult = ({ studentAnswer }: ResultProps) => {
  const trimmed = (studentAnswer ?? "").trim();
  const hasAnswer = trimmed.length > 0;

  return (
    <View className="rounded-xl p-3 border border-border bg-default">
      <AppText
        weight="bold"
        className="text-[10px] uppercase tracking-widest text-muted mb-1"
      >
        Your answer
      </AppText>
      {hasAnswer ? (
        <AppText className="text-sm text-foreground leading-relaxed">
          {studentAnswer}
        </AppText>
      ) : (
        <AppText className="text-sm text-muted italic">
          No response submitted.
        </AppText>
      )}
    </View>
  );
};
