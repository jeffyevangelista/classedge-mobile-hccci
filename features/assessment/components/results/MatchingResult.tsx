import { View } from "react-native";
import { AppText } from "@/components/AppText";
import {
  isAnswerCorrect,
  resolveMatchingCorrectPairings,
} from "./correctness";
import type { ResultProps } from "./types";

const letterFor = (i: number) => String.fromCharCode(65 + i);
const numberFor = (i: number) => String(i + 1);

const parsePairings = (raw: string): Record<number, number> => {
  if (!raw || raw.trim().length === 0) return {};
  const result: Record<number, number> = {};
  for (const part of raw.split(",")) {
    const [l, r] = part.split("->").map((s) => s.trim());
    const lid = Number(l);
    const rid = Number(r);
    if (Number.isFinite(lid) && Number.isFinite(rid)) {
      result[lid] = rid;
    }
  }
  return result;
};

interface PairRow {
  leftId: number;
  leftLabel: string;
  leftText: string;
  rightLabel: string | null;
  rightText: string | null;
  state: "correct" | "wrong" | "blank" | "neutral" | "your-pick";
}

export const MatchingResult = ({
  question,
  studentAnswer,
  isRevealed,
  choices,
}: ResultProps) => {
  const questionChoices = choices.filter(
    (c) =>
      Number(c.questionId) === Number(question.id) &&
      typeof c.choiceText === "string" &&
      c.choiceText.trim().length > 0,
  );
  const leftItems = questionChoices.filter((c) => c.isLeftSide);
  const rightItems = questionChoices.filter((c) => !c.isLeftSide);

  const leftLabelById: Record<number, string> = {};
  const leftTextById: Record<number, string> = {};
  leftItems.forEach((c, i) => {
    leftLabelById[c.id] = letterFor(i);
    leftTextById[c.id] = c.choiceText;
  });
  const rightLabelById: Record<number, string> = {};
  const rightTextById: Record<number, string> = {};
  rightItems.forEach((c, i) => {
    rightLabelById[c.id] = numberFor(i);
    rightTextById[c.id] = c.choiceText;
  });

  const studentPairings = parsePairings(studentAnswer);
  // Correct answer is stored as "<leftText> -> <rightText>" pairs; resolve
  // those to choice-id pairs using the question's choices so per-row
  // correctness checks below can compare apples-to-apples.
  const correctPairings = resolveMatchingCorrectPairings(question, choices);
  const overallCorrect = isAnswerCorrect(
    "matching_type",
    question,
    studentAnswer,
    choices,
  );

  const rows: PairRow[] = leftItems.map((l) => {
    const studentRight = studentPairings[l.id];
    const correctRight = correctPairings[l.id];

    let state: PairRow["state"];
    if (!isRevealed) {
      state = studentRight != null ? "your-pick" : "neutral";
    } else if (studentRight == null) {
      state = "blank";
    } else if (studentRight === correctRight) {
      state = "correct";
    } else {
      state = "wrong";
    }

    return {
      leftId: l.id,
      leftLabel: leftLabelById[l.id],
      leftText: l.choiceText,
      rightLabel: studentRight != null ? (rightLabelById[studentRight] ?? "?") : null,
      rightText:
        studentRight != null ? (rightTextById[studentRight] ?? "—") : null,
      state,
    };
  });

  return (
    <View className="gap-2">
      {rows.map((row) => {
        const containerClass =
          row.state === "correct"
            ? "border-2 border-success bg-success-soft"
            : row.state === "wrong"
              ? "border-2 border-warning bg-warning-soft"
              : row.state === "your-pick"
                ? "border-2 border-accent bg-accent/10"
                : "border border-border bg-surface";

        return (
          <View key={row.leftId} className={`rounded-xl p-3 ${containerClass}`}>
            {/* Label chips (A/1) are decorative in review — the text on
                each side carries the meaning. Each side gets flex-1 so
                short phrases sit compactly while long ones wrap. */}
            <View className="flex-row items-center gap-2">
              <AppText
                weight="semibold"
                className="flex-1 text-sm text-foreground"
                numberOfLines={2}
              >
                {row.leftText}
              </AppText>
              <AppText weight="bold" className="text-[11px] text-muted">
                →
              </AppText>
              {row.rightLabel ? (
                <AppText
                  weight="semibold"
                  className="flex-1 text-sm text-foreground"
                  numberOfLines={2}
                >
                  {row.rightText ?? "—"}
                </AppText>
              ) : (
                <AppText className="flex-1 text-[11px] text-muted italic">
                  No match
                </AppText>
              )}
            </View>
            {isRevealed && row.state === "wrong" ? (
              <View className="mt-2 pt-2 border-t border-warning/30 flex-row items-center gap-2">
                <AppText
                  weight="bold"
                  className="text-[10px] uppercase tracking-widest text-success"
                >
                  Correct →
                </AppText>
                <AppText
                  weight="semibold"
                  className="flex-1 text-sm text-foreground"
                  numberOfLines={2}
                >
                  {rightTextById[correctPairings[row.leftId]] ?? "—"}
                </AppText>
              </View>
            ) : null}
          </View>
        );
      })}
      {/* Suppress unused warning */}
      {overallCorrect === null ? null : null}
    </View>
  );
};
