import { useThemeColor } from "heroui-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { getFileType } from "@/features/attachments/file-type";
import { useAttachment } from "@/features/attachments/hooks/useAttachment";
import { AttachmentImageCard } from "./AttachmentImageCard";
import { AttachmentPdfCard } from "./AttachmentPdfCard";
import { AttachmentVideoCard } from "./AttachmentVideoCard";

interface Props {
  file: string;
  fileName: string;
}

export const AttachmentFile = ({ file, fileName }: Props) => {
  const { uri, state, retry, progress } = useAttachment(file);
  const type = getFileType(file);
  const dangerColor = useThemeColor("danger");

  if (state === "unknown" || state === "queued" || state === "downloading") {
    const pct =
      state === "downloading" && progress != null
        ? Math.round(progress * 100)
        : null;
    return (
      <View className="w-full h-20 bg-surface-secondary rounded-xl overflow-hidden">
        <View className="flex-1 flex-row items-center gap-3 px-4">
          <ActivityIndicator />
          <View className="flex-1">
            <AppText className="text-sm text-muted">
              {state === "downloading" ? "Downloading…" : "Preparing file…"}
            </AppText>
            {pct != null ? (
              <AppText className="text-xs text-muted">{pct}%</AppText>
            ) : null}
          </View>
        </View>
        {state === "downloading" ? (
          <View className="h-1 bg-default-200 w-full">
            <View
              style={{
                width: progress != null ? `${progress * 100}%` : "100%",
                opacity: progress != null ? 1 : 0.3,
              }}
              className="h-full bg-accent"
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (state === "failed") {
    return (
      <View className="w-full h-20 bg-surface-secondary rounded-xl flex-row items-center gap-3 px-4">
        <Icon name="WarningCircleIcon" size={24} color={dangerColor} />
        <AppText className="flex-1 text-sm text-muted">
          Failed to load file
        </AppText>
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          android_ripple={{
            color: "rgba(255,255,255,0.15)",
            borderless: false,
          }}
          className="flex-row items-center gap-1 bg-danger px-3 py-1.5 rounded-lg active:opacity-80"
        >
          <Icon name="ArrowsClockwiseIcon" size={13} color="#fff" />
          <AppText className="text-white text-xs">Retry</AppText>
        </Pressable>
      </View>
    );
  }

  if (!uri) return null;

  if (type === "image") {
    return <AttachmentImageCard uri={uri} fileName={fileName} />;
  }
  if (type === "video") {
    return <AttachmentVideoCard uri={uri} fileName={fileName} />;
  }
  if (type === "pdf") {
    return <AttachmentPdfCard uri={uri} fileName={fileName} />;
  }

  return (
    <View className="w-full h-20 bg-surface-secondary rounded-xl items-center justify-center">
      <AppText className="text-sm text-muted">
        Cannot preview this file type
      </AppText>
    </View>
  );
};
