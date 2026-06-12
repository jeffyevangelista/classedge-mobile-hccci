import { Image, Pressable, View } from "react-native";
import { useThemeColor } from "heroui-native";
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
      return "FilePdfIcon";
    case "doc":
      return "FileTextIcon";
    default:
      return "FileIcon";
  }
};

// Tile color hints at file type without requiring the student to read the
// subtitle: PDFs sit on a danger-soft red tile, generic docs on
// accent-soft, images get neutral default since the thumbnail itself
// carries the recognition.
const tileBgClassFor = (type: FileMeta["type"]): string => {
  switch (type) {
    case "pdf":
      return "bg-danger-soft";
    case "doc":
      return "bg-accent-soft";
    default:
      return "bg-default";
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
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");

  const sizeStr = formatSize(meta.size);
  const subtitle = sizeStr
    ? `${typeLabel(meta.type)} · ${sizeStr}`
    : typeLabel(meta.type);

  const tileBg = tileBgClassFor(meta.type);
  const tileIconColor =
    meta.type === "pdf"
      ? dangerColor
      : meta.type === "doc"
        ? accentColor
        : foregroundColor;

  return (
    <View
      className={`rounded-xl border border-border overflow-hidden bg-surface ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <View className="flex-row items-stretch">
        <View className={`w-20 h-20 items-center justify-center ${tileBg}`}>
          {meta.type === "image" ? (
            <Image
              source={{ uri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Icon
              name={docIconFor(meta.type)}
              size={28}
              color={tileIconColor}
            />
          )}
        </View>

        <View className="flex-1 min-w-0 p-3 justify-center">
          <AppText
            weight="semibold"
            className="text-sm text-foreground"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {meta.filename}
          </AppText>
          <AppText className="text-[11px] text-muted mt-0.5">{subtitle}</AppText>
        </View>

        {!disabled ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove attachment"
            hitSlop={10}
            android_ripple={{
              color: "rgba(185, 28, 28, 0.15)",
              borderless: true,
            }}
            className="w-9 h-9 rounded-full bg-danger-soft items-center justify-center self-start m-2.5 active:opacity-70"
          >
            <Icon name="XIcon" size={14} color={dangerColor} />
          </Pressable>
        ) : null}
      </View>

      {!disabled ? (
        <Pressable
          onPress={onReplace}
          accessibilityRole="button"
          accessibilityLabel="Replace attachment"
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          className="flex-row items-center justify-center gap-1.5 py-2.5 bg-default border-t border-border active:opacity-80"
        >
          <Icon
            name="ArrowsClockwiseIcon"
            size={13}
            color={foregroundColor}
          />
          <AppText weight="semibold" className="text-xs text-foreground">
            Replace attachment
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
};
