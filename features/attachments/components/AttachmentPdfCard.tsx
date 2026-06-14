import {
  ActivityIndicator,
  Pressable,
  View,
} from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { usePdfPreview } from "@/features/attachments/hooks/usePdfPreview";

// PDF attachments use a red identity, distinct from image (teal) and video
// (purple) so file types are recognizable at a glance.
const PDF_ICON_COLOR = "#ef4444";

interface Props {
  uri: string;
  fileName: string;
}

export const AttachmentPdfCard = ({ uri, fileName }: Props) => {
  const { openPdf, modal, opening } = usePdfPreview();
  const mutedColor = useThemeColor("muted");

  return (
    <>
      <Pressable
        onPress={() => openPdf(uri)}
        disabled={opening}
        accessibilityRole="button"
        accessibilityLabel={`Open PDF ${fileName}`}
        accessibilityState={{ disabled: opening, busy: opening }}
        android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
        className="flex-row items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3 active:opacity-70"
      >
        <View className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 items-center justify-center shrink-0">
          {opening ? (
            <ActivityIndicator color={PDF_ICON_COLOR} />
          ) : (
            <Icon name="FilePdfIcon" size={20} color={PDF_ICON_COLOR} />
          )}
        </View>
        <View className="flex-1">
          <AppText
            numberOfLines={1}
            ellipsizeMode="middle"
            className="text-sm"
          >
            {fileName}
          </AppText>
          <AppText className="text-xs text-muted mt-0.5">Tap to view</AppText>
        </View>
        <Icon name="ArrowSquareOutIcon" size={16} color={mutedColor} />
      </Pressable>

      {modal}
    </>
  );
};
