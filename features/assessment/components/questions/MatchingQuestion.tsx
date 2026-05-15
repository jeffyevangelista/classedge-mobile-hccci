import { useState, useEffect, useMemo } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { questionStyles as styles } from "./styles";
import type { MatchingProps } from "./types";

const letterFor = (i: number) => String.fromCharCode(65 + i);
const numberFor = (i: number) => String(i + 1);

const serialize = (pairings: Record<number, number>): string =>
  Object.entries(pairings)
    .map(([l, r]) => `${l}->${r}`)
    .join(",");

const parsePairings = (raw: string): Record<number, number> => {
  if (!raw || raw.trim().length === 0) return {};
  const result: Record<number, number> = {};
  for (const part of raw.split(",")) {
    const [l, r] = part.split("->").map((s) => s.trim());
    const lid = Number(l);
    const rid = Number(r);
    if (Number.isFinite(lid) && Number.isFinite(rid)) {
      result[lid] = rid;
    }
  }
  return result;
};

const MatchingQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
  choices,
}: MatchingProps) => {
  const questionChoices = useMemo(
    () => choices.filter((c) => Number(c.questionId) === Number(question.id)),
    [choices, question.id],
  );

  const leftItems = useMemo(
    () => questionChoices.filter((c) => c.isLeftSide),
    [questionChoices],
  );
  const rightItems = useMemo(
    () => questionChoices.filter((c) => !c.isLeftSide),
    [questionChoices],
  );

  const [pairings, setPairings] = useState<Record<number, number>>(() =>
    parsePairings(currentAnswer),
  );
  const [selectedLeftId, setSelectedLeftId] = useState<number | null>(null);
  const borderColor = useThemeColor("border");
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  useEffect(() => {
    setPairings(parsePairings(currentAnswer));
  }, [currentAnswer]);

  if (
    questionChoices.length === 0 ||
    leftItems.length === 0 ||
    rightItems.length === 0
  ) {
    return (
      <>
        <AppText style={styles.instructionText}>
          Format: "1 -&gt; 2" (match items)
        </AppText>
        <TextInput
          style={[
            styles.fillBlankInput,
            { borderColor, color: foregroundColor },
          ]}
          placeholder="e.g., 1 -> 2"
          placeholderTextColor={mutedColor}
          value={currentAnswer}
          onChangeText={(text) => onAnswer(question.id, text)}
          editable={!disabled}
        />
      </>
    );
  }

  const leftLabelById: Record<number, string> = {};
  leftItems.forEach((c, i) => {
    leftLabelById[c.id] = letterFor(i);
  });
  const rightLabelById: Record<number, string> = {};
  rightItems.forEach((c, i) => {
    rightLabelById[c.id] = numberFor(i);
  });

  const partnerOfLeft = (leftId: number): string | null => {
    const r = pairings[leftId];
    return r != null ? (rightLabelById[r] ?? null) : null;
  };
  const partnerOfRight = (rightId: number): string | null => {
    const entry = Object.entries(pairings).find(
      ([, r]) => Number(r) === rightId,
    );
    return entry ? (leftLabelById[Number(entry[0])] ?? null) : null;
  };

  const commit = (next: Record<number, number>) => {
    setPairings(next);
    onAnswer(question.id, serialize(next));
  };

  const handleLeftPress = (leftId: number) => {
    if (disabled) return;
    if (pairings[leftId] != null) {
      const next = { ...pairings };
      delete next[leftId];
      commit(next);
      return;
    }
    setSelectedLeftId((curr) => (curr === leftId ? null : leftId));
  };

  const handleRightPress = (rightId: number) => {
    if (disabled) return;
    const existing = Object.entries(pairings).find(
      ([, r]) => Number(r) === rightId,
    );
    if (existing) {
      const next = { ...pairings };
      delete next[Number(existing[0])];
      commit(next);
      return;
    }
    if (selectedLeftId == null) return;
    commit({ ...pairings, [selectedLeftId]: rightId });
    setSelectedLeftId(null);
  };

  return (
    <View>
      <AppText className="text-xs text-muted mb-3">
        Tap a left item, then tap its match on the right. Tap a paired item to
        unpair.
      </AppText>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-2">
          {leftItems.map((item) => {
            const label = leftLabelById[item.id];
            const isSelected = selectedLeftId === item.id;
            const partner = partnerOfLeft(item.id);
            const isPaired = partner != null;
            const isActive = isSelected || isPaired;
            return (
              <Pressable
                key={item.id}
                onPress={() => handleLeftPress(item.id)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Item ${label}: ${item.choiceText}`}
                accessibilityState={{ selected: isSelected, disabled }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className={`flex-row items-center gap-2 px-2 py-2 rounded-lg border ${
                  isActive ? "border-accent bg-accent/10" : "border-border"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${
                    isActive
                      ? "bg-accent"
                      : "border border-border bg-default"
                  }`}
                >
                  <AppText
                    weight="semibold"
                    className={`text-[10px] ${
                      isActive ? "text-accent-foreground" : ""
                    }`}
                  >
                    {label}
                  </AppText>
                </View>
                <AppText className="flex-1 text-sm" numberOfLines={2}>
                  {item.choiceText}
                </AppText>
                {isPaired ? (
                  <AppText weight="semibold" className="text-xs text-accent">
                    → {partner}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View className="flex-1 gap-2">
          {rightItems.map((item) => {
            const label = rightLabelById[item.id];
            const partner = partnerOfRight(item.id);
            const isPaired = partner != null;
            return (
              <Pressable
                key={item.id}
                onPress={() => handleRightPress(item.id)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Item ${label}: ${item.choiceText}`}
                accessibilityState={{ disabled }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className={`flex-row items-center gap-2 px-2 py-2 rounded-lg border ${
                  isPaired ? "border-accent bg-accent/10" : "border-border"
                }`}
              >
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${
                    isPaired
                      ? "bg-accent"
                      : "border border-border bg-default"
                  }`}
                >
                  <AppText
                    weight="semibold"
                    className={`text-[10px] ${
                      isPaired ? "text-accent-foreground" : ""
                    }`}
                  >
                    {label}
                  </AppText>
                </View>
                <AppText className="flex-1 text-sm" numberOfLines={2}>
                  {item.choiceText}
                </AppText>
                {isPaired ? (
                  <AppText weight="semibold" className="text-xs text-accent">
                    → {partner}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default MatchingQuestion;
