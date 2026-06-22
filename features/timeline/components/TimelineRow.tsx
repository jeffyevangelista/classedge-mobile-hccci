import { Card, useThemeColor } from "heroui-native";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import type { TimelineItem, TimelineRowHighlight } from "../types";

type Props = {
  item: TimelineItem;
  onPress: () => void;
  dateLabel: string;
  highlightVariant?: TimelineRowHighlight;
  badges?: React.ReactNode;
};

export const TimelineRow = ({
  item,
  onPress,
  dateLabel,
  highlightVariant,
  badges,
}: Props) => {
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");
  const isAssessment = item.type === "assessment";

  const iconName = isAssessment ? "PencilLineIcon" : "BookOpenTextIcon";
  const iconColor = isAssessment ? accentColor : mutedColor;
  const iconBgClass = isAssessment ? "bg-accent-soft" : "bg-surface-secondary";

  const borderClass =
    highlightVariant === "today" || highlightVariant === "due-soon"
      ? "border-accent"
      : "border-border";

  const accessibilityLabel = `Open ${
    isAssessment ? "assessment" : "material"
  }: ${item.fileName}${highlightVariant === "overdue" ? " (overdue)" : ""}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="w-full max-w-3xl mx-auto active:opacity-80 rounded-xl overflow-hidden mb-1"
    >
      <Card
        className={`rounded-xl flex-row items-center gap-3 shadow-none border ${borderClass}`}
      >
        <View className={`p-2 rounded-full ${iconBgClass}`}>
          <Icon name={iconName} size={24} color={iconColor} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-lg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.fileName}
          </AppText>
          <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
            <AppText className="text-xs text-muted">{dateLabel}</AppText>
            {badges}
          </View>
        </View>
      </Card>
    </Pressable>
  );
};
