import { View, TouchableOpacity } from "react-native";
import { useThemeColor } from "heroui-native";
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
  const accentColor = useThemeColor("accent");
  const questionChoices = choices.filter(
    (c) => Number(c.questionId) === Number(question.id),
  );

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
    <View accessibilityRole="radiogroup">
      {questionChoices.map((choice, index) => {
        const selected = currentAnswer === String(choice.id);
        const letter = letterFor(index);
        return (
          <TouchableOpacity
            key={choice.id}
            activeOpacity={0.7}
            onPress={() => handleSelect(choice.id)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`Option ${letter}: ${choice.choiceText}`}
            className={`px-3 py-3 rounded-lg border mb-2 ${
              selected ? "border-accent bg-accent/10" : "border-border"
            }`}
          >
            <View className="flex-row items-center gap-3">
              <View
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  selected ? "bg-accent" : "border border-border bg-default"
                }`}
              >
                <AppText
                  weight="semibold"
                  className={`text-xs ${
                    selected ? "text-accent-foreground" : ""
                  }`}
                >
                  {letter}
                </AppText>
              </View>
              <AppText className="flex-1 text-sm">{choice.choiceText}</AppText>
              {selected ? (
                <Icon name="CheckIcon" size={18} color={accentColor} />
              ) : null}
            </View>
            {choice.choiceImage ? (
              <View className="mt-3 rounded-md overflow-hidden bg-default">
                <AttachmentImage
                  path={choice.choiceImage}
                  style={{ width: "100%", height: 160 }}
                  contentFit="contain"
                />
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default MultipleChoiceQuestion;
