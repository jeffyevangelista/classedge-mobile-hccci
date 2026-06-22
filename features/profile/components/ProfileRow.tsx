import { useThemeColor } from "heroui-native";
import { forwardRef, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

type ProfileRowProps = {
  icon: IconName;
  label: string;
  /** Override the icon color. Defaults to the theme accent. */
  iconColor?: string;
  /** Override the label color. Defaults to foreground. */
  labelClassName?: string;
  /** Optional element rendered on the right of the row (chevron, switch, etc). */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "switch";
  accessibilityState?: { checked?: boolean };
};

/**
 * Shared row used in the profile screen. Standardizes the
 * icon + label + trailing layout so the four call sites
 * (nav link, theme toggle, resync, logout) stay in sync.
 */
export const ProfileRow = forwardRef<View, ProfileRowProps>(
  (
    {
      icon,
      label,
      iconColor,
      labelClassName,
      trailing,
      onPress,
      accessibilityLabel,
      accessibilityRole = "button",
      accessibilityState,
    },
    ref,
  ) => {
    const accentColor = useThemeColor("accent");
    const color = iconColor ?? accentColor;

    return (
      <Pressable
        ref={ref}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={accessibilityState}
        onPress={onPress}
        className="active:opacity-70"
      >
        <View className="flex-row items-center p-3 rounded-2xl">
          <Icon name={icon} size={28} color={color} />
          <AppText
            weight="semibold"
            className={`text-base ml-4 flex-1 ${labelClassName ?? ""}`}
          >
            {label}
          </AppText>
          {trailing}
        </View>
      </Pressable>
    );
  },
);
ProfileRow.displayName = "ProfileRow";

export default ProfileRow;
