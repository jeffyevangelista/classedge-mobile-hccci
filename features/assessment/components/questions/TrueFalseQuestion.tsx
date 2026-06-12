import { Pressable, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import type { QuestionComponentProps } from "./types";

const TrueFalseQuestion = ({
  question,
  currentAnswer,
  onAnswer,
  disabled,
}: QuestionComponentProps) => {
  const handleSelect = (value: string) => {
    if (disabled) return;
    onAnswer(question.id, value);
  };

  return (
    <View accessibilityRole="radiogroup" className="flex-row gap-3">
      <TrueFalseOption
        label="True"
        icon="CheckIcon"
        selected={currentAnswer === "True"}
        disabled={!!disabled}
        onPress={() => handleSelect("True")}
      />
      <TrueFalseOption
        label="False"
        icon="XIcon"
        selected={currentAnswer === "False"}
        disabled={!!disabled}
        onPress={() => handleSelect("False")}
      />
    </View>
  );
};

interface TrueFalseOptionProps {
  label: string;
  icon: IconName;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}

// Keep both options neutral-tinted (accent on selected, no semantic green
// for "True" / red for "False") — semantic colors before the student
// answers would bias their choice toward whichever cue they read as
// "correct."
const TrueFalseOption = ({
  label,
  icon,
  selected,
  disabled,
  onPress,
}: TrueFalseOptionProps) => {
  const accentForegroundColor = useThemeColor("accent-foreground");
  const foregroundColor = useThemeColor("foreground");

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      android_ripple={{ color: "rgba(37, 99, 235, 0.12)" }}
      className={`relative flex-1 overflow-hidden px-3.5 py-4 rounded-xl items-center ${
        selected
          ? "border-2 border-accent bg-accent/10"
          : "border border-border bg-surface"
      } ${disabled ? "opacity-60" : "active:opacity-80"}`}
    >
      <View
        className={`w-9 h-9 rounded-xl items-center justify-center mb-1.5 ${
          selected ? "bg-accent" : "bg-default border border-border"
        }`}
      >
        <Icon
          name={icon}
          size={18}
          color={selected ? accentForegroundColor : foregroundColor}
        />
      </View>
      <AppText
        weight={selected ? "bold" : "semibold"}
        className="text-sm text-foreground"
      >
        {label}
      </AppText>
    </Pressable>
  );
};

export default TrueFalseQuestion;
