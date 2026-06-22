import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

type SectionHeaderProps = {
  title: string;
  iconName?: IconName;
  actionLabel?: string;
  onAction?: () => void;
};

export const SectionHeader = ({
  title,
  iconName,
  actionLabel,
  onAction,
}: SectionHeaderProps) => (
  <View className="flex-row items-center justify-between mb-3">
    <View className="flex-row items-center gap-2">
      {iconName ? (
        <View className="w-6 h-6 rounded-md bg-accent-soft items-center justify-center">
          <Icon
            name={iconName}
            size={14}
            weight="fill"
            className="text-accent"
          />
        </View>
      ) : null}
      <AppText weight="semibold" className="text-lg">
        {title}
      </AppText>
    </View>
    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        className="active:opacity-60"
      >
        <AppText weight="semibold" className="text-sm text-accent">
          {actionLabel}
        </AppText>
      </Pressable>
    ) : null}
  </View>
);
