import { View, TouchableOpacity } from "react-native";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { MultipleChoiceProps } from "./types";

const MultipleChoiceQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
  choices,
}: MultipleChoiceProps) => {
  const questionChoices = choices.filter((c) => c.questionId === question.id);

  if (questionChoices.length === 0) {
    return (
      <View style={styles.questionContainer}>
        <AppText style={styles.questionText}>{question.questionText}</AppText>
        <AppText style={styles.scoreText}>Score: {question.score}</AppText>
        <AppText style={styles.emptyChoices}>No choices configured</AppText>
      </View>
    );
  }

  const handleSelect = (choiceId: number) => {
    if (disabled) return;
    onAnswer(question.id, String(choiceId));
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      {questionChoices.map((choice) => {
        const selected = currentAnswer === String(choice.id);
        return (
          <TouchableOpacity
            key={choice.id}
            style={[styles.optionButton, selected && styles.selectedOption]}
            onPress={() => handleSelect(choice.id)}
            disabled={disabled}
          >
            <AppText style={selected ? styles.selectedOptionText : undefined}>
              {choice.choiceText}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default MultipleChoiceQuestion;
