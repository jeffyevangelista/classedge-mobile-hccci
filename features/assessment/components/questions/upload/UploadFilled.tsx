import { Image, Pressable, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";
import { useAttachment } from "@/features/attachments/hooks/useAttachment";
import { useImagePreview } from "@/features/attachments/hooks/useImagePreview";
import { usePdfPreview } from "@/features/attachments/hooks/usePdfPreview";
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
  const mutedColor = useThemeColor("muted");
  const { openImage, modal: imageModal } = useImagePreview();
  const { openPdf, modal: pdfModal } = usePdfPreview();

  // Once PowerSync uploads the picker file, the row's `uploaded_file`
  // field flips from the picker's `file://` URI to a server-relative
  // path (e.g. "uploadDocuments/<id>.pdf"). At that point the local
  // picker cache is gone and we have to resolve the path through the
  // attachments queue, which downloads it back into a stable local
  // cache. `extractAttachmentId` (inside useAttachment) already no-ops
  // for `file://` URIs, so we can call it unconditionally.
  const isLocalFile = uri.startsWith("file://");
  const remote = useAttachment(uri);
  const previewUri = isLocalFile ? uri : (remote.uri ?? null);
  const remoteLoading =
    !isLocalFile &&
    (remote.state === "queued" ||
      remote.state === "downloading" ||
      remote.state === "unknown");
  const remoteFailed = !isLocalFile && remote.state === "failed";

  const supportsPreview = meta.type === "image" || meta.type === "pdf";
  const canPreview = supportsPreview && previewUri != null;

  const sizeStr = formatSize(meta.size);
  const baseSubtitle = sizeStr
    ? `${typeLabel(meta.type)} · ${sizeStr}`
    : typeLabel(meta.type);
  const previewSuffix = supportsPreview
    ? canPreview
      ? " · Tap to preview"
      : remoteLoading
        ? " · Preparing preview…"
        : remoteFailed
          ? " · Preview unavailable"
          : ""
    : "";
  const subtitle = `${baseSubtitle}${previewSuffix}`;

  const tileBg = tileBgClassFor(meta.type);
  const tileIconColor =
    meta.type === "pdf"
      ? dangerColor
      : meta.type === "doc"
        ? accentColor
        : foregroundColor;

  const handlePreview = () => {
    if (!previewUri) return;
    if (meta.type === "image") {
      openImage(previewUri);
    } else if (meta.type === "pdf") {
      openPdf(previewUri);
    }
  };

  return (
    <View
      className={`rounded-xl border border-border overflow-hidden bg-surface ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <View className="flex-row items-stretch">
        <Pressable
          onPress={handlePreview}
          disabled={disabled || !canPreview}
          accessibilityRole={canPreview ? "button" : undefined}
          accessibilityLabel={
            canPreview ? `Preview ${meta.filename}` : undefined
          }
          android_ripple={
            canPreview ? { color: "rgba(0,0,0,0.05)" } : undefined
          }
          className={`flex-1 flex-row items-stretch ${
            canPreview ? "active:opacity-70" : ""
          }`}
        >
          <View className={`w-20 h-20 items-center justify-center ${tileBg}`}>
            {meta.type === "image" && previewUri ? (
              <Image
                source={{ uri: previewUri }}
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
            <AppText className="text-[11px] text-muted mt-0.5">
              {subtitle}
            </AppText>
          </View>

          {canPreview ? (
            <View className="justify-center pr-2">
              <Icon name="ArrowsOutIcon" size={14} color={mutedColor} />
            </View>
          ) : null}
        </Pressable>

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
            className="w-9 h-9 rounded-full bg-danger-soft items-center justify-center self-center mr-2.5 active:opacity-70"
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

      {imageModal}
      {pdfModal}
    </View>
  );
};
