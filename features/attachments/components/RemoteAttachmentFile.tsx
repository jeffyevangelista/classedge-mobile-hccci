import { Pressable, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import * as WebBrowser from "expo-web-browser";
import { getFileType } from "@/features/attachments/file-type";
import { AttachmentImageCard } from "./AttachmentImageCard";
import { AttachmentVideoCard } from "./AttachmentVideoCard";
import { AttachmentPdfCard } from "./AttachmentPdfCard";

interface Props {
  /** Direct remote URL — bypasses the PowerSync attachment pipeline. */
  url: string;
  fileName: string;
}

// Twin of `AttachmentFile`, but for files that come straight from a
// REST response (no local `attachments_local` row). Routes by extension
// the same way and reuses the same per-type card components so the
// visual treatment stays consistent. Use this on REST-only screens
// like the teacher-side LessonScreen, where wiring the file into the
// PowerSync attachment pipeline would require a separate schema +
// watcher + sync-rules refactor.
export const RemoteAttachmentFile = ({ url, fileName }: Props) => {
  const type = getFileType(url);
  const mutedColor = useThemeColor("muted");

  if (type === "image") {
    return <AttachmentImageCard uri={url} fileName={fileName} />;
  }
  if (type === "video") {
    return <AttachmentVideoCard uri={url} fileName={fileName} />;
  }
  if (type === "pdf") {
    return <AttachmentPdfCard uri={url} fileName={fileName} />;
  }

  // Other / unknown — render a tappable generic card that opens the URL
  // in the system browser. Mirrors the visual weight of the image / pdf
  // / video cards so it doesn't look like a stub.
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(url)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${fileName}`}
      accessibilityHint="Opens in browser"
      android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
      className="flex-row items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3 active:opacity-70"
    >
      <View className="w-10 h-10 rounded-lg bg-default items-center justify-center shrink-0">
        <Icon name="FileIcon" size={20} color={mutedColor} />
      </View>
      <View className="flex-1">
        <AppText numberOfLines={1} ellipsizeMode="middle" className="text-sm">
          {fileName}
        </AppText>
        <AppText className="text-xs text-muted mt-0.5">Tap to open</AppText>
      </View>
      <Icon name="ArrowSquareOutIcon" size={16} color={mutedColor} />
    </Pressable>
  );
};

export default RemoteAttachmentFile;
