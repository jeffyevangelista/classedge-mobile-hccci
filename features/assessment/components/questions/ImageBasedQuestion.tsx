import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";
import type { QuestionComponentProps } from "./types";
import type { UploadSource } from "./upload/SourcePickerSheet";
import { UploadCard } from "./upload/UploadCard";

// Server-side limit; keep client cap aligned with what the upload
// endpoint will accept so users don't burn a slow upload before being
// rejected.
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_LABEL = "25 MB";

// `mimeType` can be missing on some Android pickers — when present we
// validate, otherwise we trust the OS picker's `type` filter below.
const isAllowedDocMime = (mime?: string | null): boolean => {
  if (!mime) return true;
  return mime.startsWith("image/") || mime === "application/pdf";
};

const ImageBasedQuestion = ({
  question,
  currentUpload,
  onUpload,
  disabled,
}: QuestionComponentProps) => {
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const handlePickSource = async (source: UploadSource): Promise<void> => {
    if (disabled || !onUpload || picking) return;
    setError(null);
    setPicking(true);

    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission required", "Camera access was denied.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          if (asset.fileSize != null && asset.fileSize > MAX_BYTES) {
            setError(`Photo is too large. Max ${MAX_LABEL}.`);
            return;
          }
          onUpload(question.id, asset.uri);
        }
      } else if (source === "library") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Permission required",
            "Photo library access was denied.",
          );
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          if (asset.fileSize != null && asset.fileSize > MAX_BYTES) {
            setError(`Image is too large. Max ${MAX_LABEL}.`);
            return;
          }
          onUpload(question.id, asset.uri);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          // Hint to the OS picker; we still re-validate the returned
          // asset's mime and size below since Android can ignore this
          // filter on some devices.
          type: ["image/*", "application/pdf"],
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          if (!isAllowedDocMime(asset.mimeType)) {
            setError("Only images and PDFs are allowed.");
            return;
          }
          if (asset.size != null && asset.size > MAX_BYTES) {
            setError(`File is too large. Max ${MAX_LABEL}.`);
            return;
          }
          onUpload(question.id, asset.uri);
        }
      }
    } catch (err) {
      console.error("[ImageBasedQuestion] Pick failed:", err);
      setError("Couldn't attach. Try again.");
    } finally {
      setPicking(false);
    }
  };

  const handleRemove = () => {
    if (disabled || !onUpload) return;
    setError(null);
    onUpload(question.id, "");
  };

  return (
    <UploadCard
      uri={currentUpload}
      disabled={disabled}
      picking={picking}
      errorMessage={error}
      onPickSource={handlePickSource}
      onRemove={handleRemove}
    />
  );
};

export default ImageBasedQuestion;
