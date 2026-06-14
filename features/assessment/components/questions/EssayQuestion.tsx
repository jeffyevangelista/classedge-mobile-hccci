import { TextInput, View } from "react-native";
import { useState, useEffect, useMemo, useRef } from "react";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { SaveIndicator, type SaveState } from "./SaveIndicator";
import type { QuestionComponentProps } from "./types";

const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
};

// Lag a hair behind QuestionList's 250ms debounced save so the "Saved"
// indicator only appears after the change has actually been flushed.
const SAVED_DELAY_MS = 350;

const EssayQuestion = ({
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

  useEffect(() => {
    setLocalAnswer(currentAnswer);
  }, [currentAnswer]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  const handleChange = (text: string) => {
    setLocalAnswer(text);
    onAnswer(question.id, text);
    setSaveState("editing");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveState(text.trim().length > 0 ? "saved" : "idle");
    }, SAVED_DELAY_MS);
  };

  const { words, characters } = useMemo(
    () => ({
      words: countWords(localAnswer),
      characters: localAnswer.length,
    }),
    [localAnswer],
  );

  return (
    <View>
      <AppText
        weight="bold"
        className="text-[10px] uppercase tracking-widest text-muted mb-1"
      >
        Your answer
      </AppText>
      <TextInput
        // borderWidth + padding switch together so the box doesn't shift
        // sizes when the accent border kicks in on focus.
        style={{
          minHeight: 140,
          padding: focused ? 15 : 16,
          fontSize: 15,
          color: foregroundColor,
          textAlignVertical: "top",
        }}
        className={`rounded-xl ${
          focused
            ? "border-2 border-accent bg-surface"
            : "border border-border bg-default"
        }`}
        multiline
        numberOfLines={6}
        placeholder="Write your response here…"
        placeholderTextColor={mutedColor}
        autoCapitalize="sentences"
        value={localAnswer}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
      />
      <View className="flex-row items-center justify-between mt-1.5">
        <SaveIndicator state={focused ? "editing" : saveState} />
        <AppText
          className="text-[11px] text-muted"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {words} {words === 1 ? "word" : "words"} · {characters}{" "}
          {characters === 1 ? "character" : "characters"}
        </AppText>
      </View>
    </View>
  );
};

export default EssayQuestion;
