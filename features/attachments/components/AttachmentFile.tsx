import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { useAttachment } from "@/features/attachments/hooks/useAttachment";
import { getFileType } from "@/features/attachments/file-type";
import { AttachmentImageCard } from "./AttachmentImageCard";
import { AttachmentVideoCard } from "./AttachmentVideoCard";
import { AttachmentPdfCard } from "./AttachmentPdfCard";

interface Props {
  file: string;
  fileName: string;
}

export const AttachmentFile = ({ file, fileName }: Props) => {
  const { uri, state, retry } = useAttachment(file);
  const type = getFileType(file);

  if (state === "unknown" || state === "queued" || state === "downloading") {
    return (
      <View className="w-full h-20 bg-default rounded-xl flex-row items-center gap-3 px-4">
        <ActivityIndicator />
        <AppText className="text-sm text-muted">
          {state === "downloading" ? "Downloading..." : "Preparing file..."}
        </AppText>
      </View>
    );
  }

  if (state === "failed") {
    return (
      <View className="w-full h-20 bg-default rounded-xl flex-row items-center gap-3 px-4">
        <Icon name="WarningCircleIcon" size={24} color="#ef4444" />
        <AppText className="flex-1 text-sm text-muted">
          Failed to load file
        </AppText>
        <TouchableOpacity
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          className="flex-row items-center gap-1 bg-red-500 px-3 py-1.5 rounded-lg"
        >
          <Icon name="ArrowsClockwiseIcon" size={13} color="#fff" />
          <AppText className="text-white text-xs">Retry</AppText>
        </TouchableOpacity>
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
    <View className="w-full h-20 bg-default rounded-xl items-center justify-center">
      <AppText className="text-sm text-muted">
        Cannot preview this file type
      </AppText>
    </View>
  );
};
