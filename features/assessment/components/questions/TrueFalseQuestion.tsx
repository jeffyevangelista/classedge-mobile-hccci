import { View, TouchableOpacity } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { questionStyles as styles } from "./styles";
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
    <View accessibilityRole="radiogroup" style={styles.trueFalseContainer}>
      <TrueFalseOption
        label="True"
        icon="CheckIcon"
        selected={currentAnswer === "True"}
        disabled={disabled}
        onPress={() => handleSelect("True")}
      />
      <TrueFalseOption
        label="False"
        icon="XIcon"
        selected={currentAnswer === "False"}
        disabled={disabled}
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

const TrueFalseOption = ({
  label,
  icon,
  selected,
  disabled,
  onPress,
}: TrueFalseOptionProps) => {
  const accentColor = useThemeColor("accent");
  const foregroundColor = useThemeColor("foreground");
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      className={`flex-1 flex-row items-center justify-center gap-2 px-3 py-3 rounded-lg border ${
        selected ? "border-accent bg-accent/10" : "border-border"
      }`}
    >
      <Icon
        name={icon}
        size={18}
        color={selected ? accentColor : foregroundColor}
      />
      <AppText weight="semibold" className="text-sm">
        {label}
      </AppText>
    </TouchableOpacity>
  );
};

export default TrueFalseQuestion;
