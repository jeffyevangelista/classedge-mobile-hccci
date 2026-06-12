import { TextInput, View } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useThemeColor } from "heroui-native";
import { SaveIndicator, type SaveState } from "./SaveIndicator";
import type { QuestionComponentProps } from "./types";

const SAVED_DELAY_MS = 350;

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
    const clean = sanitizeNumeric(text);
    setLocalAnswer(clean);
    onAnswer(question.id, clean);
    setSaveState("editing");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveState(clean.trim().length > 0 ? "saved" : "idle");
    }, SAVED_DELAY_MS);
  };

  return (
    <View>
      <TextInput
        style={{
          padding: focused ? 17 : 18,
          fontSize: 22,
          fontWeight: "700",
          textAlign: "right",
          color: foregroundColor,
          // Tabular-nums so the right-aligned answer doesn't shift width
          // as digits change.
          fontVariant: ["tabular-nums"],
        }}
        className={`rounded-xl ${
          focused
            ? "border-2 border-accent bg-surface"
            : "border border-border bg-default"
        }`}
        placeholder="0"
        placeholderTextColor={mutedColor}
        keyboardType="decimal-pad"
        returnKeyType="done"
        value={localAnswer}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
      />
      <View className="mt-1.5">
        <SaveIndicator state={focused ? "editing" : saveState} />
      </View>
    </View>
  );
};

export default NumericQuestion;
