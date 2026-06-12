import { Pressable, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useImage } from "@/providers/ImageProvider";

// Image attachments use a teal identity, distinct from video (purple) and
// PDF (red) so file types are recognizable at a glance.
const IMAGE_ICON_COLOR = "#0d9488";

interface Props {
  uri: string;
  fileName: string;
}

export const AttachmentImageCard = ({ uri, fileName }: Props) => {
  const { showImage } = useImage();
  const mutedColor = useThemeColor("muted");

  return (
    <Pressable
      onPress={() => showImage(uri)}
      accessibilityRole="button"
      accessibilityLabel={`View image ${fileName}`}
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="flex-row items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3 active:opacity-70"
    >
      <View className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/50 items-center justify-center shrink-0">
        <Icon name="ImageIcon" size={20} color={IMAGE_ICON_COLOR} />
      </View>
      <View className="flex-1">
        <AppText
          numberOfLines={1}
          ellipsizeMode="tail"
          className="text-sm"
        >
          {fileName}
        </AppText>
        <AppText className="text-xs text-muted mt-0.5">Tap to view</AppText>
      </View>
      <Icon name="ArrowsOutIcon" size={16} color={mutedColor} />
    </Pressable>
  );
};
