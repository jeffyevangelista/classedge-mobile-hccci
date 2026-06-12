import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

type Props = {
  graded: number;
  total: number;
};

export const GradingProgressBar = ({ graded, total }: Props) => {
  const pct = total > 0 ? Math.min(1, graded / total) : 0;
  const complete = pct >= 1;

  return (
    <View className="mb-3 px-1 max-w-3xl w-full mx-auto">
      {/* Single status line — drop the redundant "X%" since the bar
          already conveys it. A green check appears at 100% for an
          unambiguous "done" signal. */}
      <View className="flex-row items-center gap-1.5 mb-1.5">
        <AppText
          weight={complete ? "semibold" : "regular"}
          className={`text-xs ${complete ? "text-foreground" : "text-foreground/70"}`}
        >
          {graded} of {total} graded
        </AppText>
        {complete ? (
          <Icon name="CheckCircleIcon" size={14} className="text-success" />
        ) : null}
      </View>
      <View className="h-1.5 rounded-full bg-default-200 overflow-hidden">
        <View
          className={`h-full rounded-full ${complete ? "bg-success" : "bg-accent"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </View>
    </View>
  );
};

export default GradingProgressBar;
