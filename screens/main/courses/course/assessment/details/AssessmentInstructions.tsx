import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { CollapsibleDescription } from "@/components/CollapsibleDescription";
import { AttachmentFile } from "@/features/attachments/components/AttachmentFile";

interface Props {
  text: string | undefined;
  filePath: string | undefined;
  /**
   * Suppress the "INSTRUCTIONS" section label. Use when this component is
   * rendered inside a tab whose label already names the section, to avoid
   * the duplicate header that would otherwise read "Instructions ›
   * INSTRUCTIONS".
   */
  hideHeader?: boolean;
}

const getFilename = (path: string): string => {
  const cleaned = path.split("?")[0].split("#")[0];
  const last = cleaned.split("/").pop() ?? "attachment";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

export const AssessmentInstructions = ({
  text,
  filePath,
  hideHeader = false,
}: Props) => {
  const trimmedText = text?.trim() ?? "";
  const hasText = trimmedText.length > 0;
  const cleanedFilePath = filePath?.trim() ?? "";
  const hasFile = cleanedFilePath.length > 0;

  if (!hasText && !hasFile) return null;

  return (
    <View>
      {hideHeader ? null : (
        <AppText
          weight="semibold"
          className="text-xs uppercase tracking-wider text-muted mb-2"
        >
          Instructions
        </AppText>
      )}
      <View className="gap-3">
        {hasText ? (
          <CollapsibleDescription
            text={trimmedText}
            textClassName="text-sm leading-relaxed"
            noun="instructions"
          />
        ) : null}
        {hasFile ? (
          <AttachmentFile
            file={cleanedFilePath}
            fileName={getFilename(cleanedFilePath)}
          />
        ) : null}
      </View>
    </View>
  );
};
