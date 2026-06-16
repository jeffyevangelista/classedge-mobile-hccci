import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import type { Filter } from "../types";

type Props = {
  value: Filter;
  onChange: (next: Filter) => void;
  counts: Record<Filter, number>;
};

const OPTIONS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "assessment", label: "Assessments" },
  { key: "material", label: "Materials" },
];

export const TimelineFilterChips = ({ value, onChange, counts }: Props) => {
  return (
    <View className="w-full max-w-3xl mx-auto px-2 mb-3 flex-row gap-2">
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${opt.label}, ${counts[opt.key]} items`}
            accessibilityState={{ selected: active }}
            android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
            className={`px-3 py-1.5 rounded-full active:opacity-80 ${
              active ? "bg-accent" : "bg-surface-secondary border border-border"
            }`}
          >
            <AppText
              weight="semibold"
              className={`text-xs ${
                active ? "text-accent-foreground" : "text-foreground"
              }`}
            >
              {opt.label} · {counts[opt.key]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
};
