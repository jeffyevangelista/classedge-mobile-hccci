import { useThemeColor } from "heroui-native";
import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import type { ResultProps } from "./types";

const OPTIONS: Array<{ label: string; icon: IconName }> = [
  { label: "True", icon: "CheckIcon" },
  { label: "False", icon: "XIcon" },
];

export const TrueFalseResult = ({
  question,
  studentAnswer,
  isRevealed,
}: ResultProps) => {
  const accentColor = useThemeColor("accent");
  const accentForegroundColor = useThemeColor("accent-foreground");
  const _successColor = useThemeColor("success");
  const successForeground = useThemeColor("success-foreground");
  const _warningColor = useThemeColor("warning");
  const warningForeground = useThemeColor("warning-foreground");
  const mutedColor = useThemeColor("muted");
  const correct = (question.correctAnswer ?? "").trim();

  return (
    <View className="flex-row gap-3">
      {OPTIONS.map(({ label, icon }) => {
        const isStudent = studentAnswer === label;
        const isAnswer = correct === label;

        // State machine for the chip:
        //   pre-reveal → accent if student's pick, neutral otherwise
        //   post-reveal correct option → success
        //   post-reveal wrong pick      → warning
        //   post-reveal everything else → neutral
        let containerClass: string;
        let iconBg: string;
        let iconColor: string;
        let badge: string | null = null;

        if (!isRevealed) {
          containerClass = isStudent
            ? "border-2 border-accent bg-accent/10"
            : "border border-border bg-surface";
          iconBg = isStudent ? "bg-accent" : "bg-default border border-border";
          iconColor = isStudent ? accentForegroundColor : mutedColor;
          badge = isStudent ? "Your pick" : null;
        } else if (isAnswer) {
          containerClass = "border-2 border-success bg-success-soft";
          iconBg = "bg-success";
          iconColor = successForeground;
          badge = isStudent ? "Your pick · Correct" : "Correct";
        } else if (isStudent) {
          containerClass = "border-2 border-warning bg-warning-soft";
          iconBg = "bg-warning";
          iconColor = warningForeground;
          badge = "Your pick";
        } else {
          containerClass = "border border-border bg-surface";
          iconBg = "bg-default border border-border";
          iconColor = mutedColor;
        }

        // Suppress unused warning when colors don't fan out — value used in
        // child component below via prop reference.
        void accentColor;

        return (
          <View
            key={label}
            className={`flex-1 items-center px-3 py-3 rounded-xl ${containerClass}`}
          >
            <View
              className={`w-9 h-9 rounded-xl items-center justify-center mb-1.5 ${iconBg}`}
            >
              <Icon name={icon} size={18} color={iconColor} />
            </View>
            <AppText weight="bold" className="text-sm text-foreground">
              {label}
            </AppText>
            {badge ? (
              <AppText
                weight="bold"
                className="text-[10px] uppercase tracking-widest text-muted mt-1"
              >
                {badge}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};
