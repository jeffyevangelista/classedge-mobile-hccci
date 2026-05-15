import { View } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";

interface Props {
  onAdd: () => void;
  disabled?: boolean;
}

export const UploadEmpty = ({ onAdd, disabled }: Props) => {
  const foregroundColor = useThemeColor("foreground");
  return (
    <View className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-3">
      <View className="w-10 h-10 rounded-md bg-default items-center justify-center">
        <Icon name="Paperclip" size={20} color={foregroundColor} />
      </View>
      <View className="flex-1">
        <AppText weight="semibold" className="text-sm">
          No attachment
        </AppText>
        <AppText className="text-xs text-muted">
          Add a photo or document
        </AppText>
      </View>
      {!disabled && (
        <Button variant="primary" size="sm" onPress={onAdd}>
          <Button.Label>Add</Button.Label>
        </Button>
      )}
    </View>
  );
};
