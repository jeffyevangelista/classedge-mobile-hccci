import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { AttachmentFile } from "@/features/attachments/components/AttachmentFile";
import type { ResultProps } from "./types";

const getFilename = (path: string): string => {
  const cleaned = path.split("?")[0].split("#")[0];
  const last = cleaned.split("/").pop() ?? "attachment";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

/**
 * Upload questions: render the student's uploaded file via AttachmentFile
 * (handles previewing images/PDFs/videos and download retry). When no file
 * was uploaded, surface that explicitly so the student knows the entry
 * counts as blank for grading.
 */
export const ImageBasedResult = ({ uploadedFile }: ResultProps) => {
  const cleanedPath = (uploadedFile ?? "").trim();
  const hasFile = cleanedPath.length > 0;

  if (!hasFile) {
    return (
      <View className="rounded-xl p-3 border border-border bg-default">
        <AppText className="text-sm text-muted italic">
          No file uploaded.
        </AppText>
      </View>
    );
  }

  return (
    <AttachmentFile file={cleanedPath} fileName={getFilename(cleanedPath)} />
  );
};
