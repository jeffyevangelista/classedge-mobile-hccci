import { View, TextInput } from "react-native";
import { useState, useEffect } from "react";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const FillInTheBlankQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  return (
    <View style={styles.questionContainer}>
      <AppText style={styles.questionText}>{question.questionText}</AppText>
      <AppText style={styles.scoreText}>Score: {question.score}</AppText>
      <TextInput
        style={styles.fillBlankInput}
        placeholder="Fill in the blank..."
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
    </View>
  );
};

export default FillInTheBlankQuestion;
