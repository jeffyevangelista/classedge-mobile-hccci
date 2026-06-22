import { useMemo } from "react";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { AttachmentFile } from "@/features/attachments/components/AttachmentFile";
import { useQuestionTypes } from "../../assessment.hooks";
import type { Choice, Question } from "../questions/types";
import { isAnswerCorrect, isAutoGraded } from "./correctness";
import { EssayResult } from "./EssayResult";
import { FillInBlankResult } from "./FillInBlankResult";
import { ImageBasedResult } from "./ImageBasedResult";
import { MatchingResult } from "./MatchingResult";
import { MCResult } from "./MCResult";
import { TrueFalseResult } from "./TrueFalseResult";

interface Props {
  index: number; // 1-based question position for the header
  question: Question;
  studentAnswer: string;
  uploadedFile?: string;
  isRevealed: boolean;
  choices: Choice[];
  // Per-answer score from the server. For manually graded items this is
  // the teacher's recorded score; gated behind `isAttemptGraded` so we
  // don't mistake a server-side default of 0 for "graded as zero".
  answerScore?: number | null;
  isAttemptGraded?: boolean;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const instructionFileName = (path: string): string => {
  const clean = path.split("?")[0]?.split("#")[0] ?? path;
  const segments = clean.split("/").filter(Boolean);
  return segments[segments.length - 1] || "instruction";
};

export const QuestionResultCard = ({
  index,
  question,
  studentAnswer,
  uploadedFile,
  isRevealed,
  choices,
  answerScore = null,
  isAttemptGraded = false,
}: Props) => {
  const { data: types } = useQuestionTypes();
  const typeRow = useMemo(
    () =>
      types?.find((t) => Number(t.id) === Number(question.quizTypeId)) ?? null,
    [types, question.quizTypeId],
  );
  const typeKey = typeRow ? normalize(typeRow.name) : null;
  const displayName = typeRow?.name ?? "Question";
  const autoGraded = isAutoGraded(typeKey);
  const correct = isAnswerCorrect(typeKey, question, studentAnswer, choices);

  // Right-side header: per-question score (auto-graded + revealed) or
  // teacher-recorded score (manually graded + revealed + attempt graded),
  // or "Manually graded" badge / raw max points otherwise.
  const scoreRow = (() => {
    if (!autoGraded) {
      // Only reveal the teacher's recorded score once the whole attempt
      // is graded — `answerScore` can be a server default of 0 before
      // grading, which would otherwise read as "graded as zero".
      if (isRevealed && isAttemptGraded && answerScore != null) {
        const full = answerScore >= question.score;
        const cls = full
          ? "text-success"
          : answerScore === 0
            ? "text-warning"
            : "text-foreground";
        return (
          <AppText
            weight="bold"
            className={`text-[11px] ${cls}`}
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {answerScore} / {question.score}
          </AppText>
        );
      }
      return (
        <View className="px-2 py-0.5 rounded-md bg-default border border-border">
          <AppText
            weight="bold"
            className="text-[10px] uppercase tracking-widest text-muted"
          >
            Manually graded
          </AppText>
        </View>
      );
    }
    if (!isRevealed) {
      return (
        <AppText
          weight="semibold"
          className="text-[11px] text-muted"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {question.score} {question.score === 1 ? "pt" : "pts"}
        </AppText>
      );
    }
    const earned = correct ? question.score : 0;
    const cls = correct ? "text-success" : "text-warning";
    return (
      <AppText
        weight="bold"
        className={`text-[11px] ${cls}`}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {earned} / {question.score}
      </AppText>
    );
  })();

  const renderResult = () => {
    switch (typeKey) {
      case "multiple_choice":
        return (
          <MCResult
            question={question}
            studentAnswer={studentAnswer}
            isRevealed={isRevealed}
            choices={choices}
          />
        );
      case "true_false":
        return (
          <TrueFalseResult
            question={question}
            studentAnswer={studentAnswer}
            isRevealed={isRevealed}
            choices={choices}
          />
        );
      case "fill_in_the_blank":
        return (
          <FillInBlankResult
            question={question}
            studentAnswer={studentAnswer}
            isRevealed={isRevealed}
            choices={choices}
            typeKey={typeKey}
          />
        );
      case "calculated_numeric":
        return (
          <FillInBlankResult
            question={question}
            studentAnswer={studentAnswer}
            isRevealed={isRevealed}
            choices={choices}
            typeKey={typeKey}
            isNumeric
          />
        );
      case "matching_type":
        return (
          <MatchingResult
            question={question}
            studentAnswer={studentAnswer}
            isRevealed={isRevealed}
            choices={choices}
          />
        );
      case "essay":
        return (
          <EssayResult
            question={question}
            studentAnswer={studentAnswer}
            isRevealed={isRevealed}
            choices={choices}
          />
        );
      case "document":
        return (
          <ImageBasedResult
            question={question}
            studentAnswer={studentAnswer}
            uploadedFile={uploadedFile}
            isRevealed={isRevealed}
            choices={choices}
          />
        );
      default:
        return (
          <AppText className="text-sm text-muted italic">
            Unknown question type
          </AppText>
        );
    }
  };

  return (
    <View className="bg-surface border border-border rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-1">
        <View className="px-2 py-1 rounded-full bg-accent-soft">
          <AppText weight="semibold" className="text-[10px] text-accent">
            {displayName}
          </AppText>
        </View>
        {scoreRow}
      </View>
      <AppText weight="semibold" className="text-sm text-foreground mb-3">
        {index}. {question.questionText}
      </AppText>
      {typeof question.questionInstruction === "string" &&
      question.questionInstruction.trim().length > 0 ? (
        <View className="mb-3">
          <AppText
            weight="bold"
            className="text-[10px] uppercase tracking-widest text-muted mb-1"
          >
            Reference file
          </AppText>
          <AttachmentFile
            file={question.questionInstruction}
            fileName={instructionFileName(question.questionInstruction)}
          />
        </View>
      ) : null}
      {renderResult()}
    </View>
  );
};
