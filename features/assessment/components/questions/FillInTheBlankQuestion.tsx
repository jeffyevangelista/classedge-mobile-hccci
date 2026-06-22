import { useThemeColor } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { SaveIndicator, type SaveState } from "./SaveIndicator";
import type { QuestionComponentProps } from "./types";

const SAVED_DELAY_MS = 350;

const FillInTheBlankQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer);
  const [focused, setFocused] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(
    currentAnswer.length > 0 ? "saved" : "idle",
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
    setSaveState("editing");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveState(text.trim().length > 0 ? "saved" : "idle");
    }, SAVED_DELAY_MS);
  };

  const handleBlur = () => {
    setFocused(false);
    const trimmed = localAnswer.trim();
    if (trimmed !== localAnswer) {
      setLocalAnswer(trimmed);
      onAnswer(question.id, trimmed);
    }
  };

  return (
    <View>
      <TextInput
        style={{
          padding: focused ? 15 : 16,
          fontSize: 15,
          color: foregroundColor,
        }}
        className={`rounded-xl ${
          focused
            ? "border-2 border-accent bg-surface"
            : "border border-border bg-default"
        }`}
        placeholder="Type your answer…"
        placeholderTextColor={mutedColor}
        autoCorrect={false}
        returnKeyType="done"
        value={localAnswer}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        editable={!disabled}
      />
      <View className="mt-1.5">
        <SaveIndicator state={focused ? "editing" : saveState} />
      </View>
    </View>
  );
};

export default FillInTheBlankQuestion;
