import { useThemeColor } from "heroui-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, TextInput, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { questionStyles as styles } from "./styles";
import type { MatchingProps } from "./types";

const letterFor = (i: number) => String.fromCharCode(65 + i);
const numberFor = (i: number) => String(i + 1);

const serialize = (pairings: Record<number, number>): string =>
  Object.entries(pairings)
    .map(([l, r]) => `${l}->${r}`)
    .join(",");

// Single-pair rule: only the first valid mapping is kept. The question
// only ever holds one pair at a time, so even legacy answers with multiple
// `A->1,B->2` segments load as just the first pair.
const parsePairings = (raw: string): Record<number, number> => {
  if (!raw || raw.trim().length === 0) return {};
  for (const part of raw.split(",")) {
    const [l, r] = part.split("->").map((s) => s.trim());
    const lid = Number(l);
    const rid = Number(r);
    if (Number.isFinite(lid) && Number.isFinite(rid)) {
      return { [lid]: rid };
    }
  }
  return {};
};

const MatchingQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
  choices,
}: MatchingProps) => {
  // Skip placeholder/empty choice rows — teachers occasionally leave a
  // blank choice in the DB and we don't want a labelless card on screen.
  const questionChoices = useMemo(
    () =>
      choices.filter(
        (c) =>
          Number(c.questionId) === Number(question.id) &&
          typeof c.choiceText === "string" &&
          c.choiceText.trim().length > 0,
      ),
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

  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");
  const borderColor = useThemeColor("border");
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");

  useEffect(() => {
    setPairings(parsePairings(currentAnswer));
  }, [currentAnswer]);

  // Gentle opacity pulse on the selected-but-unpaired left card to draw
  // the eye toward the right column where the next tap should land. Only
  // runs when something is selected; loop is torn down on deselect.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (selectedLeftId == null) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [selectedLeftId, pulse]);

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

  // Once a pair is set the question is "locked" — the only legal action
  // is tapping the paired left or right to unpair. Every other tap is a
  // no-op so the student can't sneak in a second pair or switch lefts
  // mid-flight.
  const hasPair = Object.keys(pairings).length > 0;

  const handleLeftPress = (leftId: number) => {
    if (disabled) return;
    if (pairings[leftId] != null) {
      // Tapping the paired left unpairs.
      commit({});
      setSelectedLeftId(null);
      return;
    }
    if (hasPair) {
      // Locked — must unpair first.
      return;
    }
    setSelectedLeftId((curr) => (curr === leftId ? null : leftId));
  };

  const handleRightPress = (rightId: number) => {
    if (disabled) return;
    const isPairedRight = Object.values(pairings).some(
      (r) => Number(r) === rightId,
    );
    if (isPairedRight) {
      // Tapping the paired right unpairs.
      commit({});
      setSelectedLeftId(null);
      return;
    }
    if (hasPair) {
      // Locked — must unpair first.
      return;
    }
    if (selectedLeftId == null) return;
    commit({ [selectedLeftId]: rightId });
    setSelectedLeftId(null);
  };

  const pairedCount = Object.keys(pairings).length;
  // Single-pair semantics: the question is "done" once any pair is set.
  const allPaired = pairedCount > 0;
  const isSelecting = selectedLeftId != null;

  return (
    <View>
      {/* Header band — swaps between three states:
            - selecting → accent hint "Tap a match on the right"
            - paired    → success banner "Match set"
            - otherwise → static instruction
          Single-pair rule: only one left + one right at a time. */}
      {isSelecting ? (
        <View className="flex-row items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-accent-soft border border-accent/30">
          <Icon name="CaretRightIcon" size={14} color={accentColor} />
          <AppText weight="semibold" className="text-xs text-accent">
            Tap a match on the right
          </AppText>
        </View>
      ) : allPaired ? (
        <View className="flex-row items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-success-soft border border-success/30">
          <Icon name="CheckIcon" size={14} color={successColor} />
          <AppText weight="semibold" className="text-xs text-success">
            Match set
          </AppText>
        </View>
      ) : (
        <AppText className="text-xs text-muted mb-3">
          Pick one item on the left and match it to one on the right. Tap a
          paired item to unpair.
        </AppText>
      )}

      <View className="flex-row gap-3">
        <View className="flex-1 gap-2">
          {leftItems.map((item) => {
            const label = leftLabelById[item.id];
            const isSelected = selectedLeftId === item.id;
            const partner = partnerOfLeft(item.id);
            const isPaired = partner != null;
            const isActive = isSelected || isPaired;

            const card = (
              <View
                className={`relative overflow-hidden flex-row items-center gap-2 px-3 py-3 rounded-xl ${
                  isActive
                    ? "border-2 border-accent bg-accent/10"
                    : "border border-border bg-surface"
                }`}
              >
                {isActive ? (
                  <View
                    className="bg-accent"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                    }}
                  />
                ) : null}
                <View
                  className={`w-7 h-7 rounded-xl items-center justify-center ${
                    isActive ? "bg-accent" : "bg-default border border-border"
                  }`}
                >
                  <AppText
                    weight="bold"
                    className={`text-[11px] ${
                      isActive ? "text-accent-foreground" : "text-foreground"
                    }`}
                  >
                    {label}
                  </AppText>
                </View>
                <AppText
                  className="flex-1 text-sm text-foreground"
                  weight={isActive ? "semibold" : "regular"}
                  numberOfLines={2}
                >
                  {item.choiceText}
                </AppText>
                {isPaired ? (
                  <View className="w-6 h-6 rounded-lg bg-accent items-center justify-center">
                    <AppText
                      weight="bold"
                      className="text-[11px] text-accent-foreground"
                    >
                      {partner}
                    </AppText>
                  </View>
                ) : isSelected ? (
                  <AppText
                    weight="bold"
                    className="text-[10px] uppercase tracking-widest text-accent"
                  >
                    Pick →
                  </AppText>
                ) : null}
              </View>
            );

            // Lock non-paired lefts once a pair is set — visually faded
            // and non-interactive until the student unpairs.
            const isLocked = hasPair && !isPaired;
            return (
              <Pressable
                key={item.id}
                onPress={() => handleLeftPress(item.id)}
                disabled={disabled || isLocked}
                accessibilityRole="button"
                accessibilityLabel={`Item ${label}: ${item.choiceText}`}
                accessibilityState={{
                  selected: isSelected,
                  disabled: disabled || isLocked,
                }}
                android_ripple={{ color: "rgba(37, 99, 235, 0.12)" }}
                className={`rounded-xl ${
                  disabled || isLocked ? "opacity-40" : "active:opacity-80"
                }`}
              >
                {isSelected ? (
                  <Animated.View style={{ opacity: pulse }}>
                    {card}
                  </Animated.View>
                ) : (
                  card
                )}
              </Pressable>
            );
          })}
        </View>
        <View className="flex-1 gap-2">
          {rightItems.map((item) => {
            const label = rightLabelById[item.id];
            const partner = partnerOfRight(item.id);
            const isPaired = partner != null;
            // While selecting, every unpaired right card is a candidate
            // target — give them a soft accent ring so the eye lands on
            // the right column instead of bouncing around.
            const isAvailableTarget = isSelecting && !isPaired;

            // Lock non-paired rights once a pair is set.
            const isLocked = hasPair && !isPaired;
            return (
              <Pressable
                key={item.id}
                onPress={() => handleRightPress(item.id)}
                disabled={disabled || isLocked}
                accessibilityRole="button"
                accessibilityLabel={`Item ${label}: ${item.choiceText}`}
                accessibilityState={{ disabled: disabled || isLocked }}
                android_ripple={{ color: "rgba(37, 99, 235, 0.12)" }}
                className={`rounded-xl ${
                  disabled || isLocked ? "opacity-40" : "active:opacity-80"
                }`}
              >
                <View
                  className={`relative overflow-hidden flex-row items-center gap-2 px-3 py-3 rounded-xl ${
                    isPaired
                      ? "border-2 border-accent bg-accent/10"
                      : isAvailableTarget
                        ? "border-2 border-accent/40 bg-surface"
                        : "border border-border bg-surface"
                  }`}
                >
                  {isPaired ? (
                    <View
                      className="bg-accent"
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                      }}
                    />
                  ) : null}
                  <View
                    className={`w-7 h-7 rounded-xl items-center justify-center ${
                      isPaired ? "bg-accent" : "bg-default border border-border"
                    }`}
                  >
                    <AppText
                      weight="bold"
                      className={`text-[11px] ${
                        isPaired ? "text-accent-foreground" : "text-foreground"
                      }`}
                    >
                      {label}
                    </AppText>
                  </View>
                  <AppText
                    className="flex-1 text-sm text-foreground"
                    weight={isPaired ? "semibold" : "regular"}
                    numberOfLines={2}
                  >
                    {item.choiceText}
                  </AppText>
                  {isPaired ? (
                    <View className="w-6 h-6 rounded-lg bg-accent items-center justify-center">
                      <AppText
                        weight="bold"
                        className="text-[11px] text-accent-foreground"
                      >
                        {partner}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default MatchingQuestion;
