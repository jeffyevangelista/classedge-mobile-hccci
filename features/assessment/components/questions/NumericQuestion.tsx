import { TextInput } from "react-native";
import { useState, useEffect } from "react";
import { useThemeColor } from "heroui-native";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const sanitizeNumeric = (raw: string): string => {
  const negative = raw.startsWith("-") ? "-" : "";
  const digitsAndDot = raw.replace(/[^\d.]/g, "");
  const firstDot = digitsAndDot.indexOf(".");
  if (firstDot === -1) return negative + digitsAndDot;
  return (
    negative +
    digitsAndDot.slice(0, firstDot + 1) +
    digitsAndDot.slice(firstDot + 1).replace(/\./g, "")
  );
};

const NumericQuestion = ({
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
    const clean = sanitizeNumeric(text);
    setLocalAnswer(clean);
    onAnswer(question.id, clean);
  };

  return (
    <TextInput
      style={[
        styles.fillBlankInput,
        {
          textAlign: "right",
          borderColor,
          color: foregroundColor,
        },
      ]}
      placeholder="Enter numeric answer..."
      placeholderTextColor={mutedColor}
      keyboardType="decimal-pad"
      returnKeyType="done"
      value={localAnswer}
      onChangeText={handleChange}
      editable={!disabled}
    />
  );
};

export default NumericQuestion;
