import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const SectionHeader = ({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) => (
  <View className="flex-row items-center justify-between mb-3">
    <AppText weight="semibold" className="text-lg">
      {title}
    </AppText>
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
