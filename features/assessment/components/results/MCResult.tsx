import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import { resolveMcCorrectChoiceId } from "./correctness";
import type { ResultProps } from "./types";

const letterFor = (i: number) => String.fromCharCode(65 + i);

type RowState = "correct" | "wrong-pick" | "missed" | "neutral" | "your-pick";

const rowStyles: Record<RowState, { container: string; letter: string }> = {
  correct: {
    container: "border-2 border-success bg-success-soft",
    letter: "text-success",
  },
  "wrong-pick": {
    container: "border-2 border-warning bg-warning-soft",
    letter: "text-warning",
  },
  missed: {
    container: "border border-border bg-surface",
    letter: "text-muted",
  },
  "your-pick": {
    container: "border-2 border-accent bg-accent/10",
    letter: "text-accent",
  },
  neutral: {
    container: "border border-border bg-surface",
    letter: "text-muted",
  },
};

const badgeFor = (state: RowState, isCorrect: boolean): string | null => {
  if (state === "correct" && isCorrect) return "Your pick · Correct";
  if (state === "correct") return "Correct";
  if (state === "wrong-pick") return "Your pick";
  if (state === "your-pick") return "Your pick";
  return null;
};

export const MCResult = ({
  question,
  studentAnswer,
  isRevealed,
  choices,
}: ResultProps) => {
  // Render choices in id-ascending order — the backend's correctAnswer is
  // an index into this sorted array, so any other ordering would put A/B/C
  // letters on the wrong rows relative to the stored answer key. A valid
  // choice has either text OR an image (image-only choices are
  // intentional); rows with neither are dropped.
  const questionChoices = choices
    .filter((c) => {
      if (Number(c.questionId) !== Number(question.id)) return false;
      const hasText =
        typeof c.choiceText === "string" && c.choiceText.trim().length > 0;
      const hasImage =
        typeof c.choiceImage === "string" && c.choiceImage.trim().length > 0;
      return hasText || hasImage;
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
  const studentChoiceId = studentAnswer.trim();
  const correctChoiceId = resolveMcCorrectChoiceId(question, choices);
  const isCorrect = correctChoiceId != null && studentChoiceId === correctChoiceId;

  return (
    <View className="gap-1.5">
      {questionChoices.map((choice, index) => {
        const letter = letterFor(index);
        const isStudent = String(choice.id) === studentChoiceId;
        const isAnswer =
          correctChoiceId != null && String(choice.id) === correctChoiceId;

        let state: RowState;
        if (!isRevealed) {
          state = isStudent ? "your-pick" : "neutral";
        } else if (isAnswer && isStudent) {
          state = "correct";
        } else if (isAnswer) {
          state = "correct";
        } else if (isStudent) {
          state = "wrong-pick";
        } else {
          state = "missed";
        }

        const styles = rowStyles[state];
        const badge = badgeFor(state, isCorrect);
        const badgeBg =
          state === "correct"
            ? "bg-success"
            : state === "wrong-pick"
              ? "bg-warning"
              : "bg-accent";

        return (
          <View
            key={choice.id}
            className={`px-3 py-3 rounded-xl ${styles.container}`}
          >
            <View className="flex-row items-center gap-2">
              <AppText
                weight="bold"
                className={`text-xs w-5 ${styles.letter}`}
              >
                {letter}.
              </AppText>
              {typeof choice.choiceText === "string" &&
              choice.choiceText.trim().length > 0 ? (
                <AppText className="flex-1 text-sm text-foreground">
                  {choice.choiceText}
                </AppText>
              ) : (
                <View className="flex-1" />
              )}
              {badge ? (
                <View
                  className={`px-2 py-0.5 rounded-md ${badgeBg}`}
                >
                  <AppText
                    weight="bold"
                    className="text-[10px] text-accent-foreground"
                  >
                    {badge}
                  </AppText>
                </View>
              ) : null}
            </View>
            {choice.choiceImage ? (
              <View className="mt-2 rounded-lg overflow-hidden bg-default">
                <AttachmentImage
                  path={choice.choiceImage}
                  style={{ width: "100%", height: 140 }}
                  contentFit="contain"
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};
