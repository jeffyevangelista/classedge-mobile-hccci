import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/AppText";
import { AttachmentFile } from "@/features/attachments/components/AttachmentFile";

interface Props {
  text: string | undefined;
  filePath: string | undefined;
}

const COLLAPSE_THRESHOLD = 280;

const getFilename = (path: string): string => {
  const cleaned = path.split("?")[0].split("#")[0];
  const last = cleaned.split("/").pop() ?? "attachment";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

export const AssessmentInstructions = ({ text, filePath }: Props) => {
  const trimmedText = text?.trim() ?? "";
  const hasText = trimmedText.length > 0;
  const cleanedFilePath = filePath?.trim() ?? "";
  const hasFile = cleanedFilePath.length > 0;

  if (!hasText && !hasFile) return null;

  return (
    <View>
      <AppText weight="semibold" className="text-base mb-2">
        Instructions
      </AppText>
      <View className="gap-3">
        {hasText ? <InstructionText text={trimmedText} /> : null}
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

const InstructionText = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = text.length > COLLAPSE_THRESHOLD;

  return (
    <View>
      <AppText
        className="text-sm leading-relaxed"
        numberOfLines={!canCollapse || expanded ? undefined : 4}
      >
        {text}
      </AppText>
      {canCollapse ? (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Show less" : "Show more"}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <AppText weight="semibold" className="text-accent text-sm mt-2">
            {expanded ? "Show less" : "Show more"}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
};
