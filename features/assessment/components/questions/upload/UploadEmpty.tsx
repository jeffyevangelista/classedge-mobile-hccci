import { Pressable, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

interface Props {
  onAdd: () => void;
  disabled?: boolean;
  hasError?: boolean;
}

/**
 * Empty-state attachment drop zone. The whole card is the press target so
 * "tap to add" is one gesture instead of "find the Add button, then tap."
 * On error the card tints warning-soft so the next tap visually retries
 * (the error label sits in UploadCard below the zone).
 */
export const UploadEmpty = ({ onAdd, disabled, hasError }: Props) => {
  const accentColor = useThemeColor("accent");
  const warningColor = useThemeColor("warning");

  return (
    <Pressable
      onPress={onAdd}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Add an attachment"
      android_ripple={{ color: "rgba(37, 99, 235, 0.12)" }}
      className={`rounded-xl py-6 px-4 items-center justify-center ${
        hasError
          ? "bg-warning-soft border border-warning/40"
          : "border border-border bg-default"
      } ${disabled ? "opacity-60" : "active:opacity-80"}`}
    >
      <View
        className={`w-12 h-12 rounded-2xl items-center justify-center mb-2 ${
          hasError ? "bg-warning/20" : "bg-accent-soft"
        }`}
      >
        <Icon
          name="PlusIcon"
          size={22}
          color={hasError ? warningColor : accentColor}
        />
      </View>
      <AppText weight="semibold" className="text-sm text-foreground">
        Tap to add an attachment
      </AppText>
      <AppText className="text-xs text-muted mt-0.5">
        Photo or PDF · Up to 25 MB
      </AppText>
    </Pressable>
  );
};
