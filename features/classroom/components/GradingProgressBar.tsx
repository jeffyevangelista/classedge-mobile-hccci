import { Pressable, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

type Props = {
  graded: number;
  total: number;
  onPressApplyAll: () => void;
};

export const GradingProgressBar = ({
  graded,
  total,
  onPressApplyAll,
}: Props) => {
  const pct = total > 0 ? Math.min(1, graded / total) : 0;
  const foregroundColor = useThemeColor("foreground");

  return (
    <View className="flex-row items-center gap-3 mb-3 px-1 max-w-3xl w-full mx-auto">
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center justify-between">
          <AppText className="text-xs text-foreground/70">
            {graded} of {total} graded
          </AppText>
          <AppText className="text-xs text-foreground/70">
            {Math.round(pct * 100)}%
          </AppText>
        </View>
        <View className="h-1.5 rounded-full bg-default-200 overflow-hidden">
          <View
            className="h-full bg-accent rounded-full"
            style={{ width: `${pct * 100}%` }}
          />
        </View>
      </View>
      <Pressable
        onPress={onPressApplyAll}
        hitSlop={8}
        className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full bg-default-100 active:bg-default-200"
      >
        <Icon name="Stack" size={14} color={foregroundColor} />
        <AppText className="text-xs" weight="semibold">
          Apply to all
        </AppText>
      </Pressable>
    </View>
  );
};

export default GradingProgressBar;
