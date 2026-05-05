import { View, TouchableOpacity } from "react-native";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const TrueFalseQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const handleSelect = (value: string) => {
    if (disabled) return;
    onAnswer(question.id, value);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <View style={styles.trueFalseContainer}>
        <TouchableOpacity
          style={[
            styles.trueFalseButton,
            currentAnswer === "True" && styles.selectedOption,
          ]}
          onPress={() => handleSelect("True")}
          disabled={disabled}
        >
          <AppText
            style={
              currentAnswer === "True" ? styles.selectedOptionText : undefined
            }
          >
            True
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.trueFalseButton,
            currentAnswer === "False" && styles.selectedOption,
          ]}
          onPress={() => handleSelect("False")}
          disabled={disabled}
        >
          <AppText
            style={
              currentAnswer === "False" ? styles.selectedOptionText : undefined
            }
          >
            False
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TrueFalseQuestion;
