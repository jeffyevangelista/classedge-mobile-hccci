import { useMemo } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { AttachmentFile } from "@/features/attachments/components/AttachmentFile";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion";
import EssayQuestion from "./EssayQuestion";
import TrueFalseQuestion from "./TrueFalseQuestion";
import FillInTheBlankQuestion from "./FillInTheBlankQuestion";
import MatchingQuestion from "./MatchingQuestion";
import NumericQuestion from "./NumericQuestion";
import ImageBasedQuestion from "./ImageBasedQuestion";
import { questionStyles as styles } from "./styles";
import { useQuestionTypes } from "../../assessment.hooks";
import type { Choice, QuestionComponentProps } from "./types";

export type { Choice, Question, QuestionComponentProps } from "./types";

interface QuestionRendererProps extends QuestionComponentProps {
  choices: Choice[];
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

// Derive a user-facing filename from the stored instruction path. Strips
// query string and parent directories; falls back to "instruction" when
// the path has no usable basename (e.g. trailing slash).
const instructionFileName = (path: string): string => {
  const clean = path.split("?")[0]?.split("#")[0] ?? path;
  const segments = clean.split("/").filter(Boolean);
  return segments[segments.length - 1] || "instruction";
};

const renderQuestion = (
  typeKey: string | null,
  props: QuestionComponentProps & { choices: Choice[] },
) => {
  const {
    question,
    currentAnswer,
    onAnswer,
    disabled,
    choices,
    currentUpload,
    onUpload,
  } = props;
  switch (typeKey) {
    case "multiple_choice":
      return (
        <MultipleChoiceQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
          choices={choices}
        />
      );
    case "essay":
      return (
        <EssayQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case "true_false":
      return (
        <TrueFalseQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case "fill_in_the_blank":
      return (
        <FillInTheBlankQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case "matching_type":
      return (
        <MatchingQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
          choices={choices}
        />
      );
    case "calculated_numeric":
      return (
        <NumericQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case "document":
      return (
        <ImageBasedQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
          currentUpload={currentUpload}
          onUpload={onUpload}
        />
      );
    default:
      return <AppText>Unknown question type</AppText>;
  }
};

export const QuestionRenderer = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
  choices,
  currentUpload,
  onUpload,
}: QuestionRendererProps) => {
  const { data: types } = useQuestionTypes();

  const typeRow = useMemo(
    () =>
      types?.find((t) => Number(t.id) === Number(question.quizTypeId)) ?? null,
    [types, question.quizTypeId],
  );
  const typeKey = typeRow ? normalize(typeRow.name) : null;
  const displayName = typeRow?.name ?? "Unknown";

  return (
    <View
      style={styles.questionContainer}
      className="bg-surface border-border"
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="px-2 py-1 rounded-full bg-accent-soft">
          <AppText className="text-xs text-accent">{displayName}</AppText>
        </View>
        <AppText
          className="text-muted"
          style={[styles.scoreText, { marginBottom: 0 }]}
        >
          {question.score} Points
        </AppText>
      </View>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      {typeof question.questionInstruction === "string" &&
      question.questionInstruction.trim().length > 0 ? (
        <View className="mt-2 mb-3">
          <AttachmentFile
            file={question.questionInstruction}
            fileName={instructionFileName(question.questionInstruction)}
          />
        </View>
      ) : null}
      {renderQuestion(typeKey, {
        question,
        currentAnswer,
        onAnswer,
        disabled,
        choices,
        currentUpload,
        onUpload,
      })}
    </View>
  );
};
