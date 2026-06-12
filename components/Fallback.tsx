import { Pressable, View } from "react-native";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

export type FallbackVariant = "empty" | "error" | "offline";
export type FallbackDensity = "screen" | "inline";

interface FallbackProps {
  variant?: FallbackVariant;
  density?: FallbackDensity;
  icon?: IconName;
  title?: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}

type VariantTokens = {
  icon: IconName;
  title: string;
  chipBg: string;
  iconClass: string;
};

const VARIANTS: Record<FallbackVariant, VariantTokens> = {
  empty: {
    icon: "FolderOpenIcon",
    title: "Nothing here yet",
    chipBg: "bg-accent-soft",
    iconClass: "text-accent",
  },
  error: {
    icon: "WarningCircleIcon",
    title: "Couldn't load this",
    chipBg: "bg-danger-soft",
    iconClass: "text-danger",
  },
  offline: {
    icon: "CloudSlashIcon",
    title: "You're offline",
    chipBg: "bg-default",
    iconClass: "text-muted",
  },
};

const Fallback = ({
  variant = "empty",
  density = "screen",
  icon,
  title,
  description,
  action,
}: FallbackProps) => {
  const tokens = VARIANTS[variant];
  const resolvedIcon = icon ?? tokens.icon;
  const resolvedTitle = title ?? tokens.title;

  if (density === "inline") {
    return (
      <View className="flex-row items-center gap-3 p-3 rounded-xl bg-default">
        <View
          className={`w-9 h-9 rounded-xl items-center justify-center ${tokens.chipBg}`}
        >
          <Icon name={resolvedIcon} size={18} className={tokens.iconClass} />
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-sm text-foreground"
            numberOfLines={1}
          >
            {resolvedTitle}
          </AppText>
          {description ? (
            <AppText className="text-xs text-muted" numberOfLines={2}>
              {description}
            </AppText>
          ) : null}
        </View>
        {action ? <FallbackButton {...action} size="sm" /> : null}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-6 py-12 gap-4">
      <View
        className={`w-16 h-16 rounded-2xl items-center justify-center ${tokens.chipBg}`}
      >
        <Icon name={resolvedIcon} size={28} className={tokens.iconClass} />
      </View>
      <View className="items-center gap-1 max-w-sm">
        <AppText
          weight="semibold"
          className="text-center text-lg text-foreground"
        >
          {resolvedTitle}
        </AppText>
        {description ? (
          <AppText className="text-center text-sm text-muted">
            {description}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <View className="mt-1">
          <FallbackButton {...action} size="md" />
        </View>
      ) : null}
    </View>
  );
};

const FallbackButton = ({
  label,
  onPress,
  size,
}: {
  label: string;
  onPress: () => void;
  size: "sm" | "md";
}) => {
  const padding = size === "sm" ? "px-3 py-1" : "px-5 py-2";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className={`rounded-full bg-default border border-border active:opacity-80 ${padding}`}
    >
      <AppText weight="semibold" className={`text-foreground ${textSize}`}>
        {label}
      </AppText>
    </Pressable>
  );
};

export default Fallback;
