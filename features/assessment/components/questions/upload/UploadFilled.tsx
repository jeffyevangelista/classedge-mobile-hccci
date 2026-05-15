import { Image, Pressable, View } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { formatSize, typeLabel, type FileMeta } from "./fileMeta";

interface Props {
  uri: string;
  meta: FileMeta;
  onReplace: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

const docIconFor = (type: FileMeta["type"]): IconName => {
  switch (type) {
    case "pdf":
      return "FilePdf";
    case "doc":
      return "FileText";
    default:
      return "File";
  }
};

export const UploadFilled = ({
  uri,
  meta,
  onReplace,
  onRemove,
  disabled,
}: Props) => {
  const foregroundColor = useThemeColor("foreground");
  const sizeStr = formatSize(meta.size);
  const subtitle = sizeStr
    ? `${typeLabel(meta.type)} · ${sizeStr}`
    : typeLabel(meta.type);

  return (
    <View>
      <View className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-3">
        <View className="w-11 h-11 rounded-md overflow-hidden bg-default items-center justify-center">
          {meta.type === "image" ? (
            <Image
              source={{ uri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Icon
              name={docIconFor(meta.type)}
              size={22}
              color={foregroundColor}
            />
          )}
        </View>
        <View className="flex-1">
          <AppText
            weight="semibold"
            className="text-sm"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {meta.filename}
          </AppText>
          <AppText className="text-xs text-muted">{subtitle}</AppText>
        </View>
        {!disabled && (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove attachment"
            className="w-7 h-7 rounded-full items-center justify-center"
            hitSlop={10}
          >
            <Icon name="X" size={16} color={foregroundColor} />
          </Pressable>
        )}
      </View>
      {!disabled && (
        <View className="mt-2">
          <Button variant="tertiary" size="sm" onPress={onReplace}>
            <Button.Label>Replace attachment</Button.Label>
          </Button>
        </View>
      )}
    </View>
  );
};
