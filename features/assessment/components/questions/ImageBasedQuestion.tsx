import { useState } from "react";
import { Alert } from "react-native";
import type { QuestionComponentProps } from "./types";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { UploadCard } from "./upload/UploadCard";
import type { UploadSource } from "./upload/SourcePickerSheet";

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
          onUpload(question.id, result.assets[0].uri);
        }
      } else if (source === "library") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission required", "Photo library access was denied.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          onUpload(question.id, result.assets[0].uri);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets[0]) {
          onUpload(question.id, result.assets[0].uri);
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
