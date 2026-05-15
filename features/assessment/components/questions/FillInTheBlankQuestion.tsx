import { TextInput } from "react-native";
import { useState, useEffect } from "react";
import { useThemeColor } from "heroui-native";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const FillInTheBlankQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);
  const borderColor = useThemeColor("border");
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
  };

  const handleBlur = () => {
    const trimmed = localAnswer.trim();
    if (trimmed !== localAnswer) {
      setLocalAnswer(trimmed);
      onAnswer(question.id, trimmed);
    }
  };

  return (
    <TextInput
      style={[
        styles.fillBlankInput,
        { borderColor, color: foregroundColor },
      ]}
      placeholder="Type your answer…"
      placeholderTextColor={mutedColor}
      autoCorrect={false}
      returnKeyType="done"
      value={localAnswer}
      onChangeText={handleChange}
      onBlur={handleBlur}
      editable={!disabled}
    />
  );
};

export default FillInTheBlankQuestion;
