import { TextInput, View } from "react-native";
import { useState, useEffect, useMemo } from "react";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { QuestionComponentProps } from "./types";

const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
};

const EssayQuestion = ({
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

  const borderColor = useThemeColor("border");
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  const { words, characters } = useMemo(
    () => ({
      words: countWords(localAnswer),
      characters: localAnswer.length,
    }),
    [localAnswer],
  );

  return (
    <View>
      <TextInput
        style={[
          styles.essayInput,
          { borderColor, color: foregroundColor },
        ]}
        multiline
        numberOfLines={6}
        placeholder="Write your response here…"
        placeholderTextColor={mutedColor}
        autoCapitalize="sentences"
        value={localAnswer}
        onChangeText={handleChange}
        editable={!disabled}
      />
      <AppText className="text-xs text-muted mt-1 text-right">
        {words} {words === 1 ? "word" : "words"} · {characters}{" "}
        {characters === 1 ? "character" : "characters"}
      </AppText>
    </View>
  );
};

export default EssayQuestion;
