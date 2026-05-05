import { View } from "react-native";
import { AppText } from "@/components/AppText";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion";
import EssayQuestion from "./EssayQuestion";
import TrueFalseQuestion from "./TrueFalseQuestion";
import FillInTheBlankQuestion from "./FillInTheBlankQuestion";
import MatchingQuestion from "./MatchingQuestion";
import NumericQuestion from "./NumericQuestion";
import ImageBasedQuestion from "./ImageBasedQuestion";
import { questionStyles as styles } from "./styles";
import type { Choice, QuestionComponentProps } from "./types";

export type { Choice, Question, QuestionComponentProps } from "./types";

interface QuestionRendererProps extends QuestionComponentProps {
  choices: Choice[];
}

export const QuestionRenderer = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
  choices,
}: QuestionRendererProps) => {
  switch (question.quizTypeId) {
    case 1:
      return (
        <MultipleChoiceQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
          choices={choices}
        />
      );
    case 2:
      return (
        <EssayQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 3:
      return (
        <TrueFalseQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 4:
      return (
        <FillInTheBlankQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 5:
      return (
        <MatchingQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 6:
      return (
        <NumericQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case 7:
      return (
        <ImageBasedQuestion
          question={question}
          currentAnswer={currentAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    default:
      return (
        <View style={styles.questionContainer}>
          <AppText>Unknown question type</AppText>
        </View>
      );
  }
};
