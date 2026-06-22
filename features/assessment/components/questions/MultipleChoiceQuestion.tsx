import { useThemeColor } from "heroui-native";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { AttachmentImage } from "@/features/attachments/components/AttachmentImage";
import { questionStyles as styles } from "./styles";
import type { MultipleChoiceProps } from "./types";

const letterFor = (index: number): string => String.fromCharCode(65 + index);

const MultipleChoiceQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
  choices,
}: MultipleChoiceProps) => {
  const _accentColor = useThemeColor("accent");
  const accentForegroundColor = useThemeColor("accent-foreground");
  // A valid choice has either text OR an image — image-only choices are
  // intentional. Skip rows that have neither so teacher data-entry blanks
  // don't render as empty cards.
  const questionChoices = choices.filter((c) => {
    if (Number(c.questionId) !== Number(question.id)) return false;
    const hasText =
      typeof c.choiceText === "string" && c.choiceText.trim().length > 0;
    const hasImage =
      typeof c.choiceImage === "string" && c.choiceImage.trim().length > 0;
    return hasText || hasImage;
  });

  if (questionChoices.length === 0) {
    return (
      <AppText style={styles.emptyChoices}>
        This question has no answer choices yet. Please contact your teacher.
      </AppText>
    );
  }

  const handleSelect = (choiceId: number) => {
    if (disabled) return;
    onAnswer(question.id, String(choiceId));
  };

  return (
    <View accessibilityRole="radiogroup" className="gap-2">
      {questionChoices.map((choice, index) => {
        const selected = currentAnswer === String(choice.id);
        const letter = letterFor(index);
        const hasText =
          typeof choice.choiceText === "string" &&
          choice.choiceText.trim().length > 0;
        return (
          <Pressable
            key={choice.id}
            onPress={() => handleSelect(choice.id)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={
              hasText
                ? `Option ${letter}: ${choice.choiceText}`
                : `Option ${letter}: image choice`
            }
            android_ripple={{ color: "rgba(37, 99, 235, 0.12)" }}
            className={`relative overflow-hidden px-3.5 py-3.5 rounded-xl ${
              selected
                ? "border-2 border-accent bg-accent/10"
                : "border border-border bg-surface"
            } ${disabled ? "opacity-60" : "active:opacity-80"}`}
          >
            {/* Left accent strip — only on selected. Sits flush against the
                rounded corner; overflow-hidden on the Pressable clips it
                cleanly. Pulls the eye to the chosen answer even on small
                screens where the tint alone might read as ambient. */}
            {selected ? (
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
            <View className="flex-row items-center gap-3">
              <View
                className={`w-8 h-8 rounded-xl items-center justify-center ${
                  selected ? "bg-accent" : "bg-default border border-border"
                }`}
              >
                <AppText
                  weight="bold"
                  className={`text-xs ${
                    selected ? "text-accent-foreground" : "text-foreground"
                  }`}
                >
                  {letter}
                </AppText>
              </View>
              {hasText ? (
                <AppText
                  className={`flex-1 text-sm ${
                    selected ? "text-foreground" : "text-foreground"
                  }`}
                  weight={selected ? "semibold" : "regular"}
                >
                  {choice.choiceText}
                </AppText>
              ) : (
                <View className="flex-1" />
              )}
              {selected ? (
                <View className="w-6 h-6 rounded-full bg-accent items-center justify-center">
                  <Icon
                    name="CheckIcon"
                    size={14}
                    color={accentForegroundColor}
                  />
                </View>
              ) : null}
            </View>
            {choice.choiceImage ? (
              <View className="mt-3 rounded-lg overflow-hidden bg-default">
                <AttachmentImage
                  path={choice.choiceImage}
                  style={{ width: "100%", height: 160 }}
                  contentFit="contain"
                />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

export default MultipleChoiceQuestion;
